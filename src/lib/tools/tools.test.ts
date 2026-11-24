import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../db";
import { activity, messages, sources } from "../db/schema";
import { createTestDb } from "../db/test-db";
import { listLeadViews, quarantineCounts } from "../queries";
import { invoke, manifest, type InvokeResult } from "./registry";
import { normalizeDomain, tierFor, TOOLS } from "./tools";

let db: Db;
let productId: number;
let cleanup: () => void;

beforeEach(() => {
  ({ db, productId, cleanup } = createTestDb());
});
afterEach(() => cleanup());

const SRC = [{ url: "https://example.com/news", quote: "raised a Series B" }];

function call(tool: string, input: unknown, actor: "agent" | "rep" = "agent"): any {
  const r: InvokeResult = invoke(TOOLS, db, tool, input, actor);
  return r;
}
function ok(tool: string, input: unknown, actor: "agent" | "rep" = "agent") {
  const r = call(tool, input, actor);
  if (!r.ok) throw new Error(`${tool} failed: ${r.error}`);
  return r;
}
const activityCount = () => db.select().from(activity).all().length;

function setupLead() {
  const acct = ok("add_account", { name: "Acme AI", domain: "https://www.Acme.ai/about", sources: SRC }).result.account;
  const sig = ok("add_signal", { accountId: acct.id, kind: "funding", summary: "Series B $40M", date: "2026-10-01", sources: SRC }).result.signal;
  const person = ok("add_person", { name: "Jo Rivera", title: "VP Eng", accountId: acct.id, sources: SRC }).result.person;
  const lead = ok("upsert_lead", { personId: person.id, fitScore: 82, rationale: "AI infra, Series B" }).result.lead;
  return { acct, sig, person, lead };
}

describe("registry", () => {
  it("manifest lists every tool with a JSON schema", () => {
    const m = manifest(TOOLS);
    expect(m.map((t) => t.name)).toEqual(
      expect.arrayContaining(["get_product", "save_icp", "add_account", "add_person", "add_signal", "add_edge", "upsert_lead", "draft_message", "move_stage", "query_graph", "log_note", "list_leads"]),
    );
    const addPerson = m.find((t) => t.name === "add_person")!.inputSchema as { properties: Record<string, unknown>; required: string[] };
    expect(addPerson.required).toEqual(["name"]);
    expect(addPerson.properties.sources).toMatchObject({ type: "array", default: [] });
  });

  it("rejects unknown tools and invalid input, logging an activity row for invalid input", () => {
    expect(call("nope", {})).toMatchObject({ ok: false, code: "unknown_tool" });
    const before = activityCount();
    expect(call("add_account", { domain: "x.com" })).toMatchObject({ ok: false, code: "invalid_input" });
    expect(activityCount()).toBe(before + 1);
  });

  it("writes exactly one activity row per successful call, attributed to the actor", () => {
    const before = activityCount();
    ok("log_note", { summary: "Starting ICP research" });
    const rows = db.select().from(activity).all();
    expect(rows).toHaveLength(before + 1);
    expect(rows.at(-1)).toMatchObject({ actorKind: "agent", tool: "log_note", summary: "Starting ICP research" });
  });
});

describe("tools", () => {
  it("get_product returns the seeded product, credits and quarantine counts", () => {
    const r = ok("get_product", {});
    expect(r.result).toMatchObject({ product: { id: productId, name: "Flexprice" }, icp: null, credits: 100, quarantine: { accounts: 0 } });
    expect(call("get_product", { productId: 999 })).toMatchObject({ ok: false, code: "not_found" });
  });

  it("save_icp upserts and preserves rep decisions on expansions", () => {
    const input = {
      industries: ["AI infrastructure"],
      sizeBands: ["51-200"],
      personas: ["VP Engineering"],
      triggers: ["usage-based pricing launch"],
      confidence: { industries: 0.8, sizeBands: 0.6, personas: 0.7, triggers: 0.5 },
      expansions: [{ segment: "Dev tools", rationale: "same metering need", sources: SRC }, { segment: "Fintech APIs", rationale: "per-call pricing" }],
    };
    const first = ok("save_icp", input);
    expect(first.warnings[0]).toMatch(/Fintech APIs/);
    const icp = first.result.icp;
    expect(icp.expansions.map((e: { id: string }) => e.id)).toEqual(["exp-dev-tools", "exp-fintech-apis"]);
    // simulate a rep accepting one expansion, then the agent re-saves
    db.$client.prepare("update icps set expansions = json_set(expansions, '$[0].status', 'accepted') where id = ?").run(icp.id);
    const again = ok("save_icp", { ...input, industries: ["AI infra", "MLOps"] }).result.icp;
    expect(again.id).toBe(icp.id);
    expect(again.industries).toEqual(["AI infra", "MLOps"]);
    expect(again.expansions[0].status).toBe("accepted");
  });

  it("add_account dedupes by normalized domain and enforces the citation gate", () => {
    const q = ok("add_account", { name: "Beta Corp", domain: "beta.io" });
    expect(q.result.quarantined).toBe(true);
    expect(q.warnings[0]).toMatch(/QUARANTINE/);
    expect(quarantineCounts(db).accounts).toBe(1);
    const promoted = ok("add_account", { name: "Beta Corp", domain: "https://www.beta.io/", industry: "SaaS", sources: SRC });
    expect(promoted.result).toMatchObject({ created: false, quarantined: false, account: { id: q.result.account.id, industry: "SaaS", status: "active" } });
    expect(quarantineCounts(db).accounts).toBe(0);
    expect(normalizeDomain("HTTPS://WWW.Foo.com/x?y")).toBe("foo.com");
  });

  it("add_person requires a source to be a lead, records works_at, and resolves accountDomain", () => {
    const acct = ok("add_account", { name: "Acme AI", domain: "acme.ai", sources: SRC }).result.account;
    const p = ok("add_person", { name: "No Cite", accountDomain: "acme.ai", email: "nc@acme.ai", emailStatus: "pattern" });
    expect(p.result.person).toMatchObject({ accountId: acct.id, status: "quarantine", emailStatus: "pattern" });
    expect(call("upsert_lead", { personId: p.result.person.id, fitScore: 90, rationale: "x" })).toMatchObject({ ok: false, code: "citation_required" });
    expect(call("add_person", { name: "X", accountDomain: "missing.com", sources: SRC })).toMatchObject({ ok: false, code: "not_found" });
    const edges = db.$client.prepare("select type from edges where from_type='person' and from_id=?").all(p.result.person.id);
    expect(edges).toEqual([{ type: "works_at" }]);
  });

  it("add_signal stores cited signals, dedupes, and quarantines uncited ones", () => {
    const acct = ok("add_account", { name: "Acme AI", sources: SRC }).result.account;
    const s1 = ok("add_signal", { accountId: acct.id, kind: "hiring", summary: "Hiring 5 SREs", sources: SRC });
    const s2 = ok("add_signal", { accountId: acct.id, kind: "hiring", summary: "Hiring 5 SREs", sources: SRC });
    expect(s2.result).toMatchObject({ created: false, signal: { id: s1.result.signal.id } });
    expect(db.select().from(sources).where(eq(sources.entityType, "signal")).all()).toHaveLength(1);
    expect(ok("add_signal", { accountId: acct.id, kind: "news", summary: "rumor" }).result.quarantined).toBe(true);
    expect(call("add_signal", { accountId: 999, kind: "news", summary: "x", sources: SRC })).toMatchObject({ code: "not_found" });
  });

  it("add_edge links to existing nodes or creates schools / graph-only accounts by name", () => {
    const { person } = setupLead();
    const e = ok("add_edge", { fromType: "person", fromId: person.id, type: "studied_at", toType: "school", toName: "Stanford University" });
    expect(e.result.created).toBe(true);
    expect(ok("add_edge", { fromType: "person", fromId: person.id, type: "studied_at", toType: "school", toName: "stanford university" }).result.created).toBe(false);
    const pe = ok("add_edge", { fromType: "person", fromId: person.id, type: "previously_employed_at", toType: "account", toName: "OldCo" });
    expect(pe.warnings[0]).toMatch(/graph-only/);
    expect(call("add_edge", { fromType: "person", fromId: 999, type: "works_at", toType: "account", toId: 1 })).toMatchObject({ code: "not_found" });
  });

  it("upsert_lead derives tier, upserts, and shows in lead views with citations", () => {
    const { lead, person } = setupLead();
    expect(lead).toMatchObject({ tier: "A", stage: "matched", ownerKind: "agent", fitScore: 82 });
    const again = ok("upsert_lead", { personId: person.id, fitScore: 55, rationale: "rescored" }).result;
    expect(again).toMatchObject({ created: false, lead: { id: lead.id, tier: "B" } });
    expect([tierFor(75), tierFor(50), tierFor(49.9)]).toEqual(["A", "B", "C"]);
    const [view] = listLeadViews(db);
    expect(view.person.name).toBe("Jo Rivera");
    expect(view.signals).toHaveLength(1);
    expect(view.sources.map((s) => s.entityType).sort()).toEqual(["account", "person", "signal"]);
  });

  it("list_leads returns lead views", () => {
    setupLead();
    expect(ok("list_leads", {}).result.leads).toHaveLength(1);
    expect(ok("list_leads", { stage: "contacted" }).result.leads).toHaveLength(0);
  });

  it("draft_message always creates drafts, validates signals, and locks approved messages", () => {
    const { lead, sig } = setupLead();
    expect(call("draft_message", { leadId: lead.id, channel: "email", body: "hi" })).toMatchObject({ code: "invalid_input" });
    const d = ok("draft_message", { leadId: lead.id, channel: "email", subject: "Congrats", body: "Saw the Series B", signalsUsed: [sig.id] });
    expect(d.result.message).toMatchObject({ status: "draft", step: 1, variant: "A", signalsUsed: [sig.id] });
    const li = ok("draft_message", { leadId: lead.id, channel: "linkedin", body: "hi", subject: "ignored" });
    expect(li.result.message.subject).toBeNull();
    expect(li.warnings[0]).toMatch(/signalsUsed/);
    expect(call("draft_message", { leadId: lead.id, channel: "email", subject: "s", body: "b", signalsUsed: [999] })).toMatchObject({ code: "not_found" });
    db.update(messages).set({ status: "approved", decidedBy: "rep" }).where(eq(messages.id, d.result.message.id)).run();
    expect(call("draft_message", { leadId: lead.id, channel: "email", subject: "s", body: "b" })).toMatchObject({ ok: false, code: "locked" });
  });

  it("move_stage needs an approved message for the agent, records from/to, and rep takes ownership", () => {
    const { lead } = setupLead();
    expect(call("move_stage", { leadId: lead.id, stage: "contacted" })).toMatchObject({ ok: false, code: "approval_required" });
    const m = ok("draft_message", { leadId: lead.id, channel: "email", subject: "s", body: "b" }).result.message;
    db.update(messages).set({ status: "approved" }).where(eq(messages.id, m.id)).run();
    const r = ok("move_stage", { leadId: lead.id, stage: "contacted" });
    expect(r.result).toMatchObject({ from: "matched", to: "contacted", changed: true, lead: { ownerKind: "agent" } });
    const rep = ok("move_stage", { leadId: lead.id, stage: "meeting_booked" }, "rep");
    expect(rep.result.lead).toMatchObject({ stage: "meeting_booked", ownerKind: "rep" });
    const last = db.select().from(activity).all().at(-1)!;
    expect(last).toMatchObject({ actorKind: "rep", tool: "move_stage", leadId: lead.id, data: { from: "contacted", to: "meeting_booked" } });
  });

  it("query_graph finds warm paths through a shared past employer", () => {
    const { person } = setupLead();
    const other = ok("add_person", { name: "Sam Lee", sources: SRC }).result.person;
    ok("add_edge", { fromType: "person", fromId: person.id, type: "previously_employed_at", toType: "account", toName: "Stripe" });
    ok("add_edge", { fromType: "person", fromId: other.id, type: "previously_employed_at", toType: "account", toName: "Stripe" });
    const r = ok("query_graph", { personId: person.id, maxHops: 2 });
    expect(r.result.paths).toHaveLength(1);
    expect(r.result.paths[0]).toMatchObject({ hops: 2, edgeTypes: ["previously_employed_at", "previously_employed_at"] });
    expect(r.result.paths[0].nodes.map((n: { label: string }) => n.label)).toEqual(["Jo Rivera", "Stripe", "Sam Lee"]);
    expect(r.result.paths[0].summary).toContain("Stripe");
  });

  it("log_note writes a note to the activity feed", () => {
    ok("log_note", { summary: "Scoring 6 leads", leadId: 3 });
    expect(db.select().from(activity).all().at(-1)).toMatchObject({ tool: "log_note", summary: "Scoring 6 leads", leadId: 3 });
  });
});
