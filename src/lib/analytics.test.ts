import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decideMessage, moveStageAsRep } from "./actions";
import { computeAnalytics } from "./analytics";
import type { Db } from "./db";
import { createTestDb } from "./db/test-db";
import { invoke } from "./tools/registry";
import { TOOLS } from "./tools/tools";

let db: Db;
let cleanup: () => void;
beforeEach(() => ({ db, cleanup } = createTestDb()));
afterEach(() => cleanup());

const SRC = [{ url: "https://example.com" }];
const ok = (tool: string, input: unknown): any => {
  const r = invoke(TOOLS, db, tool, input, "agent");
  if (!r.ok) throw new Error(r.error);
  return r.result;
};

function lead(name: string, industry: string, score: number) {
  const a = ok("add_account", { name: `${name} Co`, industry, sources: SRC }).account;
  const p = ok("add_person", { name, accountId: a.id, sources: SRC }).person;
  return ok("upsert_lead", { personId: p.id, fitScore: score, rationale: "fit" }).lead;
}

describe("analytics", () => {
  it("computes funnel, industry/tier conversion, variant split and attribution", () => {
    const a = lead("Ann", "AI infra", 90); // A
    const b = lead("Bo", "AI infra", 60); // B
    const c = lead("Cy", "Fintech", 30); // C
    ok("add_person", { name: "Uncited" }); // quarantined, never counted

    const mA = ok("draft_message", { leadId: a.id, channel: "linkedin", variant: "A", body: "a" }).message;
    const mB = ok("draft_message", { leadId: b.id, channel: "linkedin", variant: "B", body: "b" }).message;
    decideMessage(db, mA.id, { status: "approved" });
    decideMessage(db, mB.id, { status: "approved" });
    ok("move_stage", { leadId: a.id, stage: "contacted" }); // agent
    ok("move_stage", { leadId: b.id, stage: "contacted" }); // agent
    moveStageAsRep(db, a.id, { stage: "replied" });
    moveStageAsRep(db, a.id, { stage: "closed_won" });
    moveStageAsRep(db, b.id, { stage: "closed_lost" });

    const r = computeAnalytics(db);
    expect(r.totals.leads).toBe(3);
    expect(r.totals.byStage).toMatchObject({ matched: 1, closed_won: 1, closed_lost: 1 });
    expect(r.funnel.map((f) => f.reached)).toEqual([3, 2, 1, 1, 1]); // meeting_booked counted as passed on the way to won
    expect(r.byIndustry[0]).toMatchObject({ industry: "AI infra", leads: 2, contacted: 2, replied: 1, won: 1, lost: 1, replyRate: 0.5 });
    expect(r.byTier.find((t) => t.tier === "C")).toMatchObject({ leads: 1, contacted: 0, replyRate: 0 });
    expect(r.funnel.map((f) => f.count)).toEqual([1, 0, 0, 0, 1]);
    expect(r.funnel.map((f) => f.toNext)).toEqual([2 / 3, 0.5, 1, 1, null]);
    expect(r.closedLost).toBe(1);
    expect(r.overallConversion).toBeCloseTo(1 / 3);
    ok("draft_message", { leadId: c.id, channel: "linkedin", variant: "B", body: "c" });
    const r2 = computeAnalytics(db);
    expect(r2.byVariant).toEqual([
      { variant: "A", drafted: 1, approved: 1, rejected: 0, sent: 0, leads: 1, replied: 1, replyRate: 1 },
      { variant: "B", drafted: 2, approved: 1, rejected: 0, sent: 0, leads: 1, replied: 0, replyRate: 0 },
    ]);
    // 4 new people (incl. quarantined) + 2 approvals = 6 credits used, all local (no key under test)
    expect(r2.credits).toEqual({
      balance: 94,
      unitsUsed: { lead_enriched: 4, outreach_sent: 2, graph_query: 0 },
      flexprice: { configured: false, sent: 0, failed: 0, pending: 0, notConfigured: 6 },
    });
    expect(r.attribution).toEqual({ leadsSourcedBy: { agent: 3, rep: 0 }, stageMovesBy: { agent: 2, rep: 3 }, approvalsBy: { rep: 2 } });
  });

  it("is empty-safe", () => {
    const r = computeAnalytics(db);
    expect(r.totals.leads).toBe(0);
    expect(r.funnel.every((f) => f.rate === 0)).toBe(true);
    expect(r.byVariant[0].replyRate).toBe(0);
    expect(r.overallConversion).toBe(0);
    expect(r.funnel[0].toNext).toBe(0);
    expect(JSON.stringify(r)).not.toMatch(/NaN|Infinity/);
  });
});
