import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetMockStore,
  decideExpansion,
  decideMessage,
  editMessage,
  getCredits,
  getIcp,
  listActivity,
  listLeads,
  listOutbox,
  moveStage,
  runGtmAgent,
  subscribe,
  topUpCredits,
} from "./api";

beforeEach(() => __resetMockStore());
afterEach(() => vi.unstubAllGlobals());

describe("ICP and credits", () => {
  it("decides an expansion, logs a rep activity and notifies subscribers", async () => {
    const seen = vi.fn();
    const off = subscribe(seen);
    await decideExpansion("exp-1", "accepted");
    off();
    const icp = await getIcp(1);
    expect(icp?.expansions.find((e) => e.id === "exp-1")?.status).toBe("accepted");
    const [latest] = await listActivity(1);
    expect(latest.actorKind).toBe("rep");
    expect(latest.summary).toMatch(/Accepted expansion/);
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it("adjust patches segment text", async () => {
    await decideExpansion("exp-2", "accepted", { segment: "Franchise operators (25+ locations)" });
    const icp = await getIcp(1);
    expect(icp?.expansions.find((e) => e.id === "exp-2")?.segment).toBe("Franchise operators (25+ locations)");
    expect((await listActivity(1))[0].summary).toMatch(/Adjusted/);
  });

  it("rejects unknown expansions", async () => {
    await expect(decideExpansion("nope", "dismissed")).rejects.toThrow(/Unknown expansion/);
  });

  it("tops up credits", async () => {
    const before = (await getCredits()).balance;
    const after = await topUpCredits(100);
    expect(after.balance).toBe(before + 100);
    expect(after.allotment).toBeGreaterThanOrEqual(after.balance);
  });
});

describe("leads", () => {
  it("lists leads best fit first with citations attached", async () => {
    const leads = await listLeads();
    expect(leads.length).toBeGreaterThan(0);
    for (let i = 1; i < leads.length; i++) expect(leads[i - 1].fitScore).toBeGreaterThanOrEqual(leads[i].fitScore);
    expect(leads.every((l) => l.sources.length > 0)).toBe(true);
  });

  it("moveStage changes stage and records a rep move with from/to", async () => {
    await moveStage(3, "contacted");
    expect((await listLeads()).find((l) => l.id === 3)?.stage).toBe("contacted");
    const [a] = await listActivity(1);
    expect(a).toMatchObject({ actorKind: "rep", tool: "move_stage", leadId: 3, data: { from: "matched", to: "contacted" } });
  });
});

describe("outbox HITL gate", () => {
  it("lists drafts with lead and signal context", async () => {
    const items = await listOutbox();
    const first = items.find((m) => m.id === 1)!;
    expect(first.lead.person.name).toBeTruthy();
    expect(first.signalSummaries.map((s) => s.id)).toEqual([1, 2]);
  });

  it("approve applies edits, records the rep decision, and never marks sent", async () => {
    const m = await decideMessage(1, "approved", { subject: "Edited", body: "New body" });
    expect(m).toMatchObject({ status: "approved", subject: "Edited", body: "New body", decidedBy: "rep" });
    expect(m.decidedAt).toBeTruthy();
    expect((await listOutbox()).some((x) => x.status === "sent")).toBe(false);
    const [a] = await listActivity(1);
    expect(a).toMatchObject({ actorKind: "rep", tool: "approve_message", entityId: 1 });
  });

  it("reject parks the draft; decided messages can't be re-decided or edited", async () => {
    await decideMessage(2, "rejected");
    await expect(decideMessage(2, "approved")).rejects.toThrow(/already rejected/);
    await expect(editMessage(2, { subject: "x", body: "y" })).rejects.toThrow(/only drafts/);
  });

  it("editMessage saves a draft without deciding it", async () => {
    const m = await editMessage(3, { subject: null, body: "Shorter note" });
    expect(m).toMatchObject({ status: "draft", body: "Shorter note", decidedBy: null });
  });
});

describe("runGtmAgent", () => {
  const base = "http://localhost:3020";
  const stub = (impl: () => Promise<Response>) => vi.stubGlobal("fetch", vi.fn(impl));

  it("reports dispatched when the endpoint dispatches, and logs a run row", async () => {
    stub(async () => Response.json({ mode: "dispatched", brief: "B" }));
    expect(await runGtmAgent(1, base)).toEqual({ ok: true, mode: "dispatched", brief: "B" });
    expect((await listActivity(1))[0]).toMatchObject({ tool: "run_dispatch", actorKind: "rep" });
  });

  it("passes through server fallback with its brief", async () => {
    stub(async () => Response.json({ mode: "fallback", brief: "B2", reason: "no cli" }));
    expect(await runGtmAgent(1, base)).toEqual({ ok: true, mode: "fallback", brief: "B2", reason: "no cli" });
    expect((await listActivity(1))[0].summary).toMatch(/fallback/);
  });

  it("falls back to a local brief on 404 or network error", async () => {
    stub(async () => new Response("nf", { status: 404 }));
    const r = await runGtmAgent(1, base);
    expect(r.ok && r.mode).toBe("fallback");
    if (r.ok) expect(r.brief).toContain("product 1");
    stub(async () => {
      throw new TypeError("network");
    });
    expect((await runGtmAgent(1, base)).ok).toBe(true);
  });

  it("surfaces credit gate (402) as an error", async () => {
    stub(async () => Response.json({ error: "Out of credits" }, { status: 402 }));
    expect(await runGtmAgent(1, base)).toEqual({ ok: false, error: "Out of credits" });
  });
});
