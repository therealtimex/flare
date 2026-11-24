// Rep (human) actions behind the UI routes. Each writes an activity row with
// actorKind "rep". Agents never reach these: the agent API is /api/agent-tools.
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "./db";
import { logActivity } from "./activity";
import { accounts, credits, icps, leads, messages, people, products, signals } from "./db/schema";
import { flexpriceConfig, InsufficientCreditsError, meter } from "./metering";
import { invoke } from "./tools/registry";
import { TOOLS } from "./tools/tools";
import {
  EXPANSION_STATUSES,
  STAGES,
  type CreditsView,
  type Expansion,
  type Lead,
  type Message,
  type OutboxItem,
  type Product,
} from "./types";

export class ActionError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
  ) {
    super(message);
  }
}

const nowIso = () => new Date().toISOString();

/** Parse with zod or throw a 400 ActionError. */
export function parseOr400<S extends z.ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  const r = schema.safeParse(value);
  if (!r.success) throw new ActionError(r.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "), 400);
  return r.data;
}

// ---------- product ----------

export const productInput = z.object({
  name: z.string().trim().min(1),
  description: z.string().default(""),
  website: z.string().nullable().optional(),
  pricing: z.string().nullable().optional(),
  customers: z.array(z.string()).default([]),
});

export function saveProduct(db: Db, id: number | null, input: z.infer<typeof productInput>): Product {
  let product: Product;
  if (id) {
    const found = db.select().from(products).where(eq(products.id, id)).get();
    if (!found) throw new ActionError(`Product #${id} not found`, 404);
    // Omitted optional fields (website, pricing) keep their stored value.
    const patch = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
    product = db.update(products).set({ ...patch, updatedAt: nowIso() }).where(eq(products.id, id)).returning().get();
  } else {
    product = db.insert(products).values({ ...input, website: input.website ?? null, pricing: input.pricing ?? null }).returning().get();
  }
  logActivity(db, { actorKind: "rep", tool: "product.save", summary: `Saved product brief: ${product.name}`, entityType: "product", entityId: product.id });
  return product;
}

// ---------- ICP expansions ----------

export const expansionInput = z.object({
  status: z.enum(EXPANSION_STATUSES),
  segment: z.string().trim().min(1).optional(),
  rationale: z.string().trim().min(1).optional(),
});

export function decideExpansion(db: Db, expansionId: string, input: z.infer<typeof expansionInput>, productId?: number): Expansion {
  const rows = db
    .select()
    .from(icps)
    .where(productId ? eq(icps.productId, productId) : undefined)
    .orderBy(desc(icps.id))
    .all();
  const icp = rows.find((r) => r.expansions.some((e) => e.id === expansionId));
  if (!icp) throw new ActionError(`Expansion ${expansionId} not found`, 404);
  const adjusted = input.segment !== undefined || input.rationale !== undefined;
  const expansions = icp.expansions.map((e) =>
    e.id === expansionId
      ? { ...e, status: input.status, ...(input.segment ? { segment: input.segment } : {}), ...(input.rationale ? { rationale: input.rationale } : {}) }
      : e,
  );
  db.update(icps).set({ expansions, updatedAt: nowIso() }).where(eq(icps.id, icp.id)).run();
  const exp = expansions.find((e) => e.id === expansionId)!;
  const verb = adjusted ? "Adjusted" : input.status === "accepted" ? "Accepted" : input.status === "dismissed" ? "Dismissed" : "Reset";
  logActivity(db, { actorKind: "rep", tool: "icp.expansion", summary: `${verb} expansion: ${exp.segment}`, entityType: "icp", entityId: icp.id, data: { expansionId, status: input.status } });
  return exp;
}

// ---------- outbox (HITL gate) ----------

export const messagePatch = z
  .object({
    subject: z.string().max(200).nullable().optional(),
    body: z.string().min(1).max(5000).optional(),
    status: z.enum(["approved", "rejected", "draft"]).optional(),
    decidedBy: z.string().trim().min(1).max(80).optional(),
  })
  .refine((v) => v.subject !== undefined || v.body !== undefined || v.status !== undefined, { message: "Nothing to change" });

/**
 * Rules: sent messages are immutable. Approve/reject sets decidedBy/decidedAt.
 * Editing the copy of an approved message without re-approving sends it back
 * to draft, so nothing leaves with text the rep did not approve.
 */
export function decideMessage(db: Db, id: number, patch: z.infer<typeof messagePatch>): Message {
  try {
    return db.transaction(() => decideMessageTx(db, id, patch));
  } catch (e) {
    if (e instanceof InsufficientCreditsError) throw new ActionError(e.message, 402);
    throw e;
  }
}

function decideMessageTx(db: Db, id: number, patch: z.infer<typeof messagePatch>): Message {
  const msg = db.select().from(messages).where(eq(messages.id, id)).get();
  if (!msg) throw new ActionError(`Message #${id} not found`, 404);
  if (msg.status === "sent") throw new ActionError(`Message #${id} was already sent and cannot change`, 409);
  const edited = (patch.body !== undefined && patch.body !== msg.body) || (patch.subject !== undefined && patch.subject !== msg.subject);
  const status = patch.status ?? (edited && msg.status === "approved" ? "draft" : msg.status);
  const deciding = patch.status === "approved" || patch.status === "rejected";
  // Approval queues the message for sending: metered as outreach_sent and credit-gated.
  if (status === "approved" && msg.status !== "approved") meter(db, { event: "outreach_sent", leadId: msg.leadId });
  const updated = db
    .update(messages)
    .set({
      ...(patch.body !== undefined ? { body: patch.body } : {}),
      ...(patch.subject !== undefined ? { subject: patch.subject } : {}),
      status,
      ...(deciding ? { decidedBy: patch.decidedBy ?? "rep", decidedAt: nowIso() } : {}),
      ...(status === "draft" ? { decidedBy: null, decidedAt: null } : {}),
      updatedAt: nowIso(),
    })
    .where(eq(messages.id, id))
    .returning()
    .get();
  const lead = db.select().from(leads).where(eq(leads.id, msg.leadId)).get();
  const person = lead ? db.select().from(people).where(eq(people.id, lead.personId)).get() : undefined;
  const who = person?.name ?? `lead #${msg.leadId}`;
  const label = `${msg.channel} step ${msg.step}/${msg.variant}`;
  const summary =
    patch.status === "approved"
      ? `Approved ${label} to ${who}${edited ? " (edited)" : ""}`
      : patch.status === "rejected"
        ? `Rejected ${label} to ${who}`
        : `Edited ${label} to ${who}${msg.status === "approved" && status === "draft" ? " — back to draft, needs re-approval" : ""}`;
  logActivity(db, {
    actorKind: "rep",
    tool: patch.status === "approved" ? "message.approve" : patch.status === "rejected" ? "message.reject" : "message.edit",
    summary,
    entityType: "message",
    entityId: id,
    leadId: msg.leadId,
    data: { from: msg.status, to: status, edited },
  });
  return updated;
}

export function listOutbox(db: Db, opts: { status?: Message["status"]; leadId?: number } = {}): OutboxItem[] {
  const conds = [];
  if (opts.status) conds.push(eq(messages.status, opts.status));
  if (opts.leadId) conds.push(eq(messages.leadId, opts.leadId));
  const rows = db
    .select({ m: messages, l: leads, p: people, a: accounts })
    .from(messages)
    .innerJoin(leads, eq(messages.leadId, leads.id))
    .innerJoin(people, eq(leads.personId, people.id))
    .leftJoin(accounts, eq(people.accountId, accounts.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(leads.fitScore), messages.leadId, messages.step, messages.variant)
    .all();
  const sigIds = [...new Set(rows.flatMap((r) => r.m.signalsUsed))];
  const sigs = sigIds.length ? db.select().from(signals).where(inArray(signals.id, sigIds)).all() : [];
  return rows.map(({ m, l, p, a }) => ({
    ...m,
    lead: { id: l.id, fitScore: l.fitScore, tier: l.tier, stage: l.stage, ownerKind: l.ownerKind },
    person: { id: p.id, name: p.name, title: p.title, email: p.email, emailStatus: p.emailStatus, linkedinUrl: p.linkedinUrl },
    account: a ? { id: a.id, name: a.name, domain: a.domain } : null,
    signals: sigs.filter((s) => m.signalsUsed.includes(s.id)),
  }));
}

// ---------- pipeline ----------

export const stageInput = z.object({ stage: z.enum(STAGES), note: z.string().max(500).optional() });

export function moveStageAsRep(db: Db, leadId: number, input: z.infer<typeof stageInput>): Lead {
  const r = invoke(TOOLS, db, "move_stage", { leadId, ...input }, "rep");
  if (!r.ok) throw new ActionError(r.error, r.code === "not_found" ? 404 : 400);
  return (r.result as { lead: Lead }).lead;
}

// ---------- credits ----------

export function creditsView(db: Db): CreditsView {
  const row = db.select().from(credits).where(eq(credits.id, 1)).get();
  return {
    balance: row?.balance ?? 0,
    allotment: row?.allotment ?? 0,
    flexprice: flexpriceConfig().apiKey ? "configured" : "not_configured",
  };
}

export const topUpInput = z.object({ amount: z.number().int().min(1).max(10_000) });

export function topUpCredits(db: Db, amount: number): CreditsView {
  const row = db.select().from(credits).where(eq(credits.id, 1)).get();
  const balance = (row?.balance ?? 0) + amount;
  const allotment = Math.max(row?.allotment ?? 0, balance);
  db.insert(credits)
    .values({ id: 1, balance, allotment })
    .onConflictDoUpdate({ target: credits.id, set: { balance, allotment, updatedAt: nowIso() } })
    .run();
  logActivity(db, { actorKind: "rep", tool: "credits.topup", summary: `Topped up ${amount} credits (balance ${balance})`, data: { amount, balance } });
  return creditsView(db);
}
