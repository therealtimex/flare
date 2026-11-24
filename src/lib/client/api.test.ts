import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetMockStore, decideExpansion, getCredits, getIcp, listActivity, runGtmAgent, subscribe, topUpCredits } from "./api";

beforeEach(() => __resetMockStore());
afterEach(() => vi.unstubAllGlobals());

describe("mock-backed mutations", () => {
  it("decides an expansion, logs a rep activity and notifies subscribers", async () => {
    const seen = vi.fn();
    const off = subscribe(seen);
    await decideExpansion("exp_1", "accepted");
    off();
    const icp = await getIcp("prod_demo");
    expect(icp?.expansions.find((e) => e.id === "exp_1")?.status).toBe("accepted");
    const [latest] = await listActivity(1);
    expect(latest.actorKind).toBe("rep");
    expect(latest.summary).toMatch(/Accepted expansion/);
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it("adjust patches segment text", async () => {
    await decideExpansion("exp_2", "accepted", { segment: "Franchise operators (25+ locations)" });
    const icp = await getIcp("prod_demo");
    expect(icp?.expansions.find((e) => e.id === "exp_2")?.segment).toBe("Franchise operators (25+ locations)");
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

describe("runGtmAgent", () => {
  const base = "http://localhost:3020";
  const stub = (impl: () => Promise<Response>) => vi.stubGlobal("fetch", vi.fn(impl));

  it("reports dispatched when the endpoint dispatches", async () => {
    stub(async () => Response.json({ mode: "dispatched", brief: "B" }));
    expect(await runGtmAgent("prod_demo", base)).toEqual({ ok: true, mode: "dispatched", brief: "B" });
  });

  it("passes through server fallback with its brief", async () => {
    stub(async () => Response.json({ mode: "fallback", brief: "B2", reason: "no cli" }));
    expect(await runGtmAgent("prod_demo", base)).toEqual({ ok: true, mode: "fallback", brief: "B2", reason: "no cli" });
  });

  it("falls back to a local brief on 404 or network error", async () => {
    stub(async () => new Response("nf", { status: 404 }));
    const r = await runGtmAgent("prod_demo", base);
    expect(r.ok && r.mode).toBe("fallback");
    if (r.ok) expect(r.brief).toContain("prod_demo");
    stub(async () => {
      throw new TypeError("network");
    });
    expect((await runGtmAgent("prod_demo", base)).ok).toBe(true);
  });

  it("surfaces credit gate (402) as an error", async () => {
    stub(async () => Response.json({ error: "Out of credits" }, { status: 402 }));
    expect(await runGtmAgent("prod_demo", base)).toEqual({ ok: false, error: "Out of credits" });
  });
});
