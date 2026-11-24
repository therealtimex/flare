import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ActionError,
  creditsView,
  decideExpansion,
  decideMessage,
  listOutbox,
  messagePatch,
  moveStageAsRep,
  parseOr400,
  saveProduct,
  topUpCredits,
} from "./actions";
import { listActivity } from "./activity";
import type { Db } from "./db";
import { createTestDb } from "./db/test-db";
import { invoke } from "./tools/registry";
import { TOOLS } from "./tools/tools";

let db: Db;
let productId: number;
let cleanup: () => void;
beforeEach(() => ({ db, productId, cleanup } = createTestDb()));
afterEach(() => cleanup());

const SRC = [{ url: "https://example.com" }];
const ok = (tool: string, input: unknown): any => {
  const r = invoke(TOOLS, db, tool, input, "agent");
  if (!r.ok) throw new Error(r.error);
  return r.result;
};

function leadWithDraft() {
  const acct = ok("add_account", { name: "Acme", sources: SRC }).account;
  const sig = ok("add_signal", { accountId: acct.id, kind: "funding", summary: "Series A", sources: SRC }).signal;
  const person = ok("add_person", { name: "Kim", accountId: acct.id, email: "kim@acme.com", sources: SRC }).person;
  const lead = ok("upsert_lead", { personId: person.id, fitScore: 70, rationale: "fit" }).lead;
  const msg = ok("draft_message", { leadId: lead.id, channel: "email", subject: "Hi", body: "Congrats on the Series A", signalsUsed: [sig.id] }).message;
  return { lead, msg, sig };
}

describe("rep actions", () => {
  it("saveProduct updates the product and logs a rep activity", () => {
    const p = saveProduct(db, productId, { name: "Flare Demo", description: "d", customers: ["Acme"] });
    expect(p).toMatchObject({ id: productId, name: "Flare Demo", customers: ["Acme"], website: "https://flexprice.io" });
    expect(listActivity(db)[0]).toMatchObject({ actorKind: "rep", tool: "product.save" });
    expect(() => saveProduct(db, 999, { name: "x", description: "", customers: [] })).toThrow(ActionError);
  });

  it("decideExpansion accepts/adjusts an expansion and survives an agent re-save", () => {
    const icpInput = {
      industries: ["AI"], sizeBands: ["51-200"], personas: ["CTO"],
      confidence: { industries: 1, sizeBands: 1, personas: 1, triggers: 0 },
      expansions: [{ segment: "Dev tools", rationale: "r", sources: SRC }],
    };
    ok("save_icp", icpInput);
    const exp = decideExpansion(db, "exp-dev-tools", { status: "accepted", rationale: "rep note" });
    expect(exp).toMatchObject({ status: "accepted", rationale: "rep note" });
    expect(listActivity(db)[0].summary).toBe("Adjusted expansion: Dev tools");
    const again = ok("save_icp", icpInput).icp;
    expect(again.expansions[0].status).toBe("accepted");
    expect(() => decideExpansion(db, "exp-nope", { status: "dismissed" })).toThrow(/not found/);
  });

  it("approve/reject record decidedBy; editing an approved message sends it back to draft; sent is locked", () => {
    const { msg } = leadWithDraft();
    const a = decideMessage(db, msg.id, { status: "approved" });
    expect(a).toMatchObject({ status: "approved", decidedBy: "rep" });
    expect(a.decidedAt).toBeTruthy();
    const e = decideMessage(db, msg.id, { body: "New copy" });
    expect(e).toMatchObject({ status: "draft", body: "New copy", decidedBy: null });
    expect(listActivity(db)[0].summary).toMatch(/back to draft/);
    const both = decideMessage(db, msg.id, { body: "Final", status: "approved", decidedBy: "Dana" });
    expect(both).toMatchObject({ status: "approved", decidedBy: "Dana", body: "Final" });
    expect(listActivity(db)[0]).toMatchObject({ tool: "message.approve", actorKind: "rep" });
    expect(decideMessage(db, msg.id, { status: "rejected" }).status).toBe("rejected");
    db.$client.prepare("update messages set status='sent' where id=?").run(msg.id);
    expect(() => decideMessage(db, msg.id, { status: "approved" })).toThrow(/already sent/);
    expect(() => parseOr400(messagePatch, {})).toThrow(/Nothing to change/);
  });

  it("listOutbox joins lead, person, account and the signals used", () => {
    const { sig } = leadWithDraft();
    const [item] = listOutbox(db, { status: "draft" });
    expect(item).toMatchObject({ status: "draft", person: { name: "Kim" }, account: { name: "Acme" }, lead: { tier: "B", stage: "matched" } });
    expect(item.signals.map((s) => s.id)).toEqual([sig.id]);
    expect(listOutbox(db, { status: "approved" })).toHaveLength(0);
  });

  it("moveStageAsRep moves without approval and attributes to rep", () => {
    const { lead } = leadWithDraft();
    const moved = moveStageAsRep(db, lead.id, { stage: "replied" });
    expect(moved).toMatchObject({ stage: "replied", ownerKind: "rep" });
    expect(listActivity(db)[0]).toMatchObject({ actorKind: "rep", tool: "move_stage" });
    expect(() => moveStageAsRep(db, 999, { stage: "replied" })).toThrow(ActionError);
  });

  it("credits view and top-up", () => {
    expect(creditsView(db)).toMatchObject({ balance: 100, allotment: 100 });
    const c = topUpCredits(db, 50);
    expect(c).toMatchObject({ balance: 150, allotment: 150 });
    expect(listActivity(db)[0]).toMatchObject({ actorKind: "rep", tool: "credits.topup" });
  });
});
