import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActionError, decideMessage } from "./actions";
import type { Db } from "./db";
import { credits, messages, people, usageEvents } from "./db/schema";
import { createTestDb } from "./db/test-db";
import {
  balanceOf,
  flexpriceConfig,
  InsufficientCreditsError,
  meter,
  sendToFlexprice,
  spendCredits,
  usageSummary,
  type Fetch,
} from "./metering";
import { dispatchRun, RunError } from "./runs";
import { invoke } from "./tools/registry";
import { TOOLS } from "./tools/tools";
import { listActivity } from "./activity";

let db: Db;
let cleanup: () => void;
beforeEach(() => ({ db, cleanup } = createTestDb()));
afterEach(() => {
  vi.unstubAllEnvs();
  cleanup();
});

const SRC = [{ url: "https://example.com" }];
const setBalance = (n: number) => db.update(credits).set({ balance: n }).where(eq(credits.id, 1)).run();
const call = (tool: string, input: unknown) => invoke(TOOLS, db, tool, input, "agent");
const CFG = { apiKey: "test-key", apiUrl: "https://fp.example/v1", customerId: "flare-demo" };

describe("credits", () => {
  it("spendCredits is atomic and never goes below zero", () => {
    setBalance(2);
    expect(spendCredits(db, 2)).toBe(0);
    expect(() => spendCredits(db, 1)).toThrow(InsufficientCreditsError);
    expect(balanceOf(db)).toBe(0);
  });

  it("add_person charges 1 credit for a new contact, none for an update, and is gated at 0", () => {
    const acct = call("add_account", { name: "Acme", sources: SRC });
    expect(acct.ok).toBe(true);
    const r = call("add_person", { name: "Kim", accountId: 1, sources: SRC });
    expect(r).toMatchObject({ ok: true, result: { creditsCharged: 1 } });
    expect(balanceOf(db)).toBe(99);
    call("add_person", { name: "Kim", accountId: 1, title: "CTO", sources: SRC });
    expect(balanceOf(db)).toBe(99);

    setBalance(0);
    const blocked = call("add_person", { name: "Lee", accountId: 1, sources: SRC });
    expect(blocked).toMatchObject({ ok: false, code: "insufficient_credits" });
    expect(db.select().from(people).where(eq(people.name, "Lee")).get()).toBeUndefined();
    expect(db.select().from(usageEvents).all()).toHaveLength(1);
    expect(listActivity(db)[0]).toMatchObject({ tool: "add_person", summary: expect.stringMatching(/Out of credits/) });
  });

  it("quarantined contacts are free; promoting one with a source charges once", () => {
    call("add_account", { name: "Acme", sources: SRC });
    const q = call("add_person", { name: "Uncited", accountId: 1 });
    expect(q).toMatchObject({ ok: true, result: { quarantined: true, creditsCharged: 0 } });
    expect(balanceOf(db)).toBe(100);
    setBalance(0);
    expect(call("add_person", { name: "Uncited2", accountId: 1 })).toMatchObject({ ok: true, result: { quarantined: true } });
    setBalance(5);
    const promoted = call("add_person", { name: "Uncited", accountId: 1, sources: SRC });
    expect(promoted).toMatchObject({ ok: true, result: { quarantined: false, creditsCharged: 1 } });
    expect(call("add_person", { name: "Uncited", accountId: 1, title: "CTO", sources: SRC })).toMatchObject({ result: { creditsCharged: 0 } });
    expect(balanceOf(db)).toBe(4);
    expect(usageSummary(db).events.lead_enriched).toEqual({ count: 1, units: 1 });
  });

  it("query_graph is metered", () => {
    call("add_person", { name: "Kim", sources: SRC });
    call("query_graph", { personId: 1 });
    expect(usageSummary(db).events).toMatchObject({ lead_enriched: { count: 1 }, graph_query: { count: 1 } });
    expect(balanceOf(db)).toBe(98);
  });

  it("approving a message meters outreach_sent once, and returns 402 when out of credits", () => {
    call("add_account", { name: "Acme", sources: SRC });
    call("add_person", { name: "Kim", accountId: 1, sources: SRC });
    call("upsert_lead", { personId: 1, fitScore: 80, rationale: "fit" });
    call("draft_message", { leadId: 1, channel: "linkedin", body: "hi" });
    decideMessage(db, 1, { status: "approved" });
    decideMessage(db, 1, { status: "approved" }); // already approved: no second charge
    expect(usageSummary(db).events.outreach_sent).toEqual({ count: 1, units: 1 });

    call("draft_message", { leadId: 1, channel: "linkedin", variant: "B", body: "hey" });
    setBalance(0);
    let err: unknown;
    try {
      decideMessage(db, 2, { status: "approved" });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ActionError);
    expect((err as ActionError).status).toBe(402);
    expect(db.select().from(messages).where(eq(messages.id, 2)).get()?.status).toBe("draft");
  });

  it("runs are blocked with 402 when the balance is 0", async () => {
    setBalance(0);
    await expect(dispatchRun(db, { baseUrl: "http://x" })).rejects.toMatchObject({ status: 402 });
    await expect(dispatchRun(db, { baseUrl: "http://x" })).rejects.toBeInstanceOf(RunError);
  });
});

describe("flexprice", () => {
  it("without a key, events are recorded locally as not_configured and nothing is sent", () => {
    const fetchImpl = vi.fn() as unknown as Fetch;
    const row = meter(db, { event: "graph_query" }, { config: flexpriceConfig({}), fetchImpl });
    expect(row.flexpriceStatus).toBe("not_configured");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(usageSummary(db, {}).flexprice).toBe("not_configured");
  });

  it("sends the documented event shape with x-api-key and records sent/failed", async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const okFetch = (async (url: string, init: RequestInit) => {
      seen.push({ url, init });
      return new Response('{"message":"Event accepted for processing"}', { status: 202 });
    }) as unknown as Fetch;
    const row = meter(db, { event: "lead_enriched", leadId: 4 }, { config: CFG, send: false });
    expect(row.flexpriceStatus).toBe("pending");
    expect(await sendToFlexprice(db, row, CFG, okFetch)).toBe("sent");
    expect(seen[0].url).toBe("https://fp.example/v1/events");
    expect((seen[0].init.headers as Record<string, string>)["x-api-key"]).toBe("test-key");
    const body = JSON.parse(String(seen[0].init.body));
    expect(body).toMatchObject({ event_name: "lead_enriched", external_customer_id: "flare-demo", source: "flare", properties: { units: "1", lead_id: "4" } });
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(db.select().from(usageEvents).where(eq(usageEvents.id, row.id)).get()?.flexpriceStatus).toBe("sent");

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const bad = (async () => new Response("no", { status: 500 })) as unknown as Fetch;
    const down = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as Fetch;
    const r2 = meter(db, { event: "graph_query" }, { config: CFG, send: false });
    expect(await sendToFlexprice(db, r2, CFG, bad)).toBe("failed");
    expect(await sendToFlexprice(db, r2, CFG, down)).toBe("failed");
    expect(warn.mock.calls.flat().join(" ")).not.toContain("test-key");
    warn.mockRestore();
    expect(usageSummary(db, { FLEXPRICE_API_KEY: "x" })).toMatchObject({ flexprice: "configured", byStatus: { sent: 1, failed: 1 } });
  });

  it("meter() sends in the background when a key is configured", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 202 })) as unknown as Fetch;
    const row = meter(db, { event: "outreach_sent" }, { config: CFG, fetchImpl });
    await vi.waitFor(() => expect(db.select().from(usageEvents).where(eq(usageEvents.id, row.id)).get()?.flexpriceStatus).toBe("sent"));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
