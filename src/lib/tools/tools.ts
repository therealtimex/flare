// The Flare agent tools. Keep agent/SKILL.md in sync with names and rules here.
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { accounts, edges, icps, leads, messages, people, products, schools, signals } from "../db/schema";
import type { Db } from "../db";
import { warmPaths } from "../graph";
import { meter } from "../metering";
import {
  addSources,
  creditBalance,
  getIcp,
  getProduct,
  listLeadViews,
  quarantineCounts,
} from "../queries";
import {
  CHANNELS,
  EDGE_TYPES,
  EMAIL_STATUSES,
  ENTITY_TYPES,
  SIGNAL_KINDS,
  STAGES,
  TIERS,
  VARIANTS,
  type EntityType,
  type Expansion,
  type Tier,
} from "../types";
import { defineTool, ToolError, type ToolDef } from "./registry";

const nowIso = () => new Date().toISOString();
const idSchema = z.number().int().positive();
/** Public web URL: http(s) only (rendered as links in the UI). */
export const httpUrl = z
  .string()
  .url()
  .refine((u) => /^https?:\/\//i.test(u), { message: "must be an http(s) URL" });
const sourcesSchema = z
  .array(
    z.object({
      url: httpUrl.describe("Public page that supports the record"),
      quote: z.string().max(1000).optional().describe("Short supporting excerpt from the page"),
    }),
  )
  .default([])
  .describe("Citations. At least one URL is required, or the record is quarantined and hidden from leads.");

const CITATION_WARNING = (what: string) =>
  `${what} saved in QUARANTINE: no source URL. It is hidden from leads until you call again with sources[] containing ≥1 URL.`;

export function normalizeDomain(d: string | undefined | null): string | null {
  if (!d) return null;
  const v = d
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0];
  return v || null;
}

export function tierFor(score: number): Tier {
  return score >= 75 ? "A" : score >= 50 ? "B" : "C";
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "segment";

function requireRow<T>(row: T | undefined, what: string, id: number): T {
  if (!row) throw new ToolError(`${what} #${id} not found`, "not_found");
  return row;
}

function entityExists(db: Db, type: EntityType, id: number): boolean {
  const table = { person: people, account: accounts, school: schools, product: products, lead: leads, signal: signals, message: messages, icp: icps }[type];
  if (!table) return false;
  return !!db.select({ id: table.id }).from(table).where(eq(table.id, id)).get();
}

function ensureEdge(db: Db, e: { fromType: EntityType; fromId: number; toType: EntityType; toId: number; type: (typeof EDGE_TYPES)[number]; meta?: Record<string, unknown> | null }) {
  const found = db
    .select()
    .from(edges)
    .where(
      and(
        eq(edges.fromType, e.fromType),
        eq(edges.fromId, e.fromId),
        eq(edges.toType, e.toType),
        eq(edges.toId, e.toId),
        eq(edges.type, e.type),
      ),
    )
    .get();
  if (found) return { edge: found, created: false };
  return { edge: db.insert(edges).values({ ...e, meta: e.meta ?? null }).returning().get(), created: true };
}

// ---------------------------------------------------------------------------

const getProductTool = defineTool({
  name: "get_product",
  description:
    "Read the product you are selling, its current ICP (if saved), lead count, quarantine counts and credit balance. Call this first.",
  input: z.object({ productId: idSchema.optional().describe("Defaults to the first product") }),
  handler: ({ productId }, { db }) => {
    const product = getProduct(db, productId);
    if (!product) throw new ToolError(productId ? `Product #${productId} not found` : "No product exists yet", "not_found");
    const icp = getIcp(db, product.id) ?? null;
    const leadCount = db.select({ n: sql<number>`count(*)` }).from(leads).where(eq(leads.productId, product.id)).get()!.n;
    return {
      result: { product, icp, leadCount, quarantine: quarantineCounts(db), credits: creditBalance(db) },
      summary: `Read product "${product.name}"${icp ? " and its ICP" : " (no ICP yet)"}`,
      entityType: "product",
      entityId: product.id,
    };
  },
});

const saveIcpTool = defineTool({
  name: "save_icp",
  description:
    "Save (create or replace) the inferred ICP for a product, with a 0–1 confidence per field and expansion segments (each with rationale + source URLs). Expansion status set by the rep (accepted/dismissed) is preserved when the same segment is saved again.",
  input: z.object({
    productId: idSchema.optional().describe("Defaults to the first product"),
    industries: z.array(z.string().min(1)).min(1),
    sizeBands: z.array(z.string().min(1)).min(1).describe('Employee bands, e.g. "51-200"'),
    personas: z.array(z.string().min(1)).min(1).describe('Buyer titles, e.g. "VP Engineering"'),
    triggers: z.array(z.string().min(1)).default([]).describe("Buying triggers, e.g. 'raised Series A in last 6 months'"),
    confidence: z.object({
      industries: z.number().min(0).max(1),
      sizeBands: z.number().min(0).max(1),
      personas: z.number().min(0).max(1),
      triggers: z.number().min(0).max(1),
    }),
    expansions: z
      .array(
        z.object({
          segment: z.string().min(1),
          rationale: z.string().min(1),
          sources: z.array(z.object({ url: httpUrl, quote: z.string().optional() })).default([]),
        }),
      )
      .default([]),
  }),
  handler: (input, { db }) => {
    const product = getProduct(db, input.productId);
    if (!product) throw new ToolError("Product not found", "not_found");
    const prev = getIcp(db, product.id);
    const prevStatus = new Map((prev?.expansions ?? []).map((e) => [e.id, e.status]));
    const warnings: string[] = [];
    const expansions: Expansion[] = input.expansions.map((e) => {
      const id = `exp-${slug(e.segment)}`;
      if (!e.sources.length) warnings.push(`Expansion "${e.segment}" has no source URL; judges expect cited expansions.`);
      return { id, segment: e.segment, rationale: e.rationale, sources: e.sources, status: prevStatus.get(id) ?? "suggested" };
    });
    const values = {
      industries: input.industries,
      sizeBands: input.sizeBands,
      personas: input.personas,
      triggers: input.triggers,
      confidence: input.confidence,
      expansions,
    };
    const icp = prev
      ? db.update(icps).set({ ...values, updatedAt: nowIso() }).where(eq(icps.id, prev.id)).returning().get()
      : db.insert(icps).values({ productId: product.id, ...values }).returning().get();
    return {
      result: { icp },
      warnings,
      summary: `${prev ? "Updated" : "Saved"} ICP: ${input.industries.slice(0, 3).join(", ")} · ${input.personas.slice(0, 2).join(", ")} · ${expansions.length} expansion(s)`,
      entityType: "icp",
      entityId: icp.id,
    };
  },
});

const addAccountTool = defineTool({
  name: "add_account",
  description:
    "Add or update a target company (deduped by domain, then name). Requires sources[] with ≥1 URL; without it the account is quarantined. Calling again with sources promotes a quarantined account.",
  input: z.object({
    name: z.string().min(1),
    domain: z.string().optional().describe("e.g. acme.com"),
    industry: z.string().optional(),
    size: z.string().optional().describe('Employee band or count, e.g. "51-200"'),
    hq: z.string().optional().describe("City, Country"),
    sources: sourcesSchema,
  }),
  handler: (input, { db }) => {
    const domain = normalizeDomain(input.domain);
    const existing =
      (domain ? db.select().from(accounts).where(eq(accounts.domain, domain)).get() : undefined) ??
      db.select().from(accounts).where(sql`lower(${accounts.name}) = lower(${input.name})`).get();
    const hasSource = input.sources.length > 0;
    const patch = {
      name: input.name,
      ...(domain ? { domain } : {}),
      ...(input.industry ? { industry: input.industry } : {}),
      ...(input.size ? { size: input.size } : {}),
      ...(input.hq ? { hq: input.hq } : {}),
    };
    let account;
    if (existing) {
      account = db
        .update(accounts)
        .set({ ...patch, ...(hasSource ? { status: "active" as const } : {}) })
        .where(eq(accounts.id, existing.id))
        .returning()
        .get();
    } else {
      account = db.insert(accounts).values({ ...patch, status: hasSource ? "active" : "quarantine" }).returning().get();
    }
    addSources(db, "account", account.id, input.sources);
    const warnings = account.status === "quarantine" ? [CITATION_WARNING(`Account "${account.name}"`)] : [];
    return {
      result: { account, created: !existing, quarantined: account.status === "quarantine" },
      warnings,
      summary: `${existing ? "Updated" : "Added"} account ${account.name}${account.domain ? ` (${account.domain})` : ""}${account.status === "quarantine" ? " — QUARANTINED (no source)" : ` · ${input.sources.length} source(s)`}`,
      entityType: "account",
      entityId: account.id,
    };
  },
});

const addPersonTool = defineTool({
  name: "add_person",
  description:
    "Add or update a contact at an account (deduped by LinkedIn URL, then name+account). Requires sources[] with ≥1 URL, else quarantined (hidden from leads). Also records a works_at edge. emailStatus: 'verified' only when a public page states that exact address (cite it); 'pattern' when built from the company's email pattern (cite the page showing the pattern). No third-party enrichment or verifier APIs.",
  input: z.object({
    name: z.string().min(1),
    title: z.string().optional(),
    accountId: idSchema.optional(),
    accountDomain: z.string().optional().describe("Alternative to accountId: domain of an existing account"),
    linkedinUrl: httpUrl.optional(),
    email: z.string().email().optional(),
    emailStatus: z.enum(EMAIL_STATUSES).optional(),
    sources: sourcesSchema,
  }),
  handler: (input, { db }) => {
    let accountId = input.accountId ?? null;
    if (!accountId && input.accountDomain) {
      const d = normalizeDomain(input.accountDomain);
      const a = d ? db.select().from(accounts).where(eq(accounts.domain, d)).get() : undefined;
      if (!a) throw new ToolError(`No account with domain "${input.accountDomain}". Call add_account first.`, "not_found");
      accountId = a.id;
    }
    if (accountId) requireRow(db.select().from(accounts).where(eq(accounts.id, accountId)).get(), "Account", accountId);

    const existing =
      (input.linkedinUrl ? db.select().from(people).where(eq(people.linkedinUrl, input.linkedinUrl)).get() : undefined) ??
      db
        .select()
        .from(people)
        .where(
          and(
            sql`lower(${people.name}) = lower(${input.name})`,
            accountId ? eq(people.accountId, accountId) : sql`${people.accountId} IS NULL`,
          ),
        )
        .get();
    const hasSource = input.sources.length > 0;
    // Credit gate: a cited (active) contact costs 1 credit, charged once: on creation, or when a
    // quarantined contact is promoted by a cited update. Quarantined saves are free.
    // Throws insufficient_credits inside the transaction, so nothing is saved.
    const usage = hasSource && (!existing || existing.status === "quarantine") ? meter(db, { event: "lead_enriched" }) : null;
    const patch = {
      name: input.name,
      ...(input.title ? { title: input.title } : {}),
      ...(accountId ? { accountId } : {}),
      ...(input.linkedinUrl ? { linkedinUrl: input.linkedinUrl } : {}),
      ...(input.email ? { email: input.email, emailStatus: input.emailStatus ?? "unverified" } : {}),
      ...(!input.email && input.emailStatus ? { emailStatus: input.emailStatus } : {}),
    };
    const person = existing
      ? db
          .update(people)
          .set({ ...patch, ...(hasSource ? { status: "active" as const } : {}) })
          .where(eq(people.id, existing.id))
          .returning()
          .get()
      : db.insert(people).values({ ...patch, status: hasSource ? "active" : "quarantine" }).returning().get();
    addSources(db, "person", person.id, input.sources);
    if (person.accountId)
      ensureEdge(db, { fromType: "person", fromId: person.id, toType: "account", toId: person.accountId, type: "works_at", meta: input.title ? { title: input.title } : null });

    const warnings = person.status === "quarantine" ? [CITATION_WARNING(`Person "${person.name}"`)] : [];
    return {
      result: { person, created: !existing, quarantined: person.status === "quarantine", creditsCharged: usage ? usage.units : 0 },
      warnings,
      summary: `${existing ? "Updated" : "Added"} ${person.name}${person.title ? `, ${person.title}` : ""}${person.status === "quarantine" ? " — QUARANTINED (no source)" : ""}${person.email ? ` · email ${person.emailStatus}` : ""}`,
      entityType: "person",
      entityId: person.id,
    };
  },
});

const addSignalTool = defineTool({
  name: "add_signal",
  description:
    "Record a buying signal for an account (funding, hiring, exec_hire, tech_change, ...). Requires sources[] with ≥1 URL, else quarantined. Deduped by account+kind+summary.",
  input: z.object({
    accountId: idSchema,
    kind: z.enum(SIGNAL_KINDS),
    summary: z.string().min(1).max(500),
    date: z.string().optional().describe("ISO date the signal happened, e.g. 2026-10-02"),
    sources: sourcesSchema,
  }),
  handler: (input, { db }) => {
    const account = requireRow(db.select().from(accounts).where(eq(accounts.id, input.accountId)).get(), "Account", input.accountId);
    const hasSource = input.sources.length > 0;
    const existing = db
      .select()
      .from(signals)
      .where(and(eq(signals.accountId, account.id), eq(signals.kind, input.kind), eq(signals.summary, input.summary)))
      .get();
    const signal = existing
      ? db
          .update(signals)
          .set({ ...(input.date ? { date: input.date } : {}), ...(hasSource ? { status: "active" as const } : {}) })
          .where(eq(signals.id, existing.id))
          .returning()
          .get()
      : db
          .insert(signals)
          .values({ accountId: account.id, kind: input.kind, summary: input.summary, date: input.date ?? null, status: hasSource ? "active" : "quarantine" })
          .returning()
          .get();
    addSources(db, "signal", signal.id, input.sources);
    const warnings = signal.status === "quarantine" ? [CITATION_WARNING("Signal")] : [];
    return {
      result: { signal, created: !existing, quarantined: signal.status === "quarantine" },
      warnings,
      summary: `Signal @ ${account.name}: [${input.kind}] ${input.summary}${signal.status === "quarantine" ? " — QUARANTINED (no source)" : ""}`,
      entityType: "signal",
      entityId: signal.id,
    };
  },
});

const addEdgeTool = defineTool({
  name: "add_edge",
  description:
    "Add a relationship edge for the graph (deduped). For past employers or schools that are not in the DB yet, give toType 'account' or 'school' with toName instead of toId. Cite the page that shows the relationship in sources[]: an account created by name without a source is quarantined, and quarantined people/accounts never appear in warm paths.",
  input: z.object({
    fromType: z.enum(ENTITY_TYPES),
    fromId: idSchema,
    type: z.enum(EDGE_TYPES),
    toType: z.enum(ENTITY_TYPES),
    toId: idSchema.optional(),
    toName: z.string().min(1).optional().describe("Used when toId is omitted (toType account or school only)"),
    meta: z.record(z.unknown()).optional().describe('e.g. {"title":"AE","from":"2019","to":"2022"}'),
    sources: sourcesSchema,
  }),
  handler: (input, { db }) => {
    if (!entityExists(db, input.fromType, input.fromId)) throw new ToolError(`${input.fromType} #${input.fromId} not found`, "not_found");
    const warnings: string[] = [];
    let toId = input.toId;
    if (!toId) {
      if (!input.toName) throw new ToolError("Give toId, or toName with toType account|school", "invalid_input");
      if (input.toType === "school") {
        const s =
          db.select().from(schools).where(sql`lower(${schools.name}) = lower(${input.toName})`).get() ??
          db.insert(schools).values({ name: input.toName }).returning().get();
        toId = s.id;
      } else if (input.toType === "account") {
        const cited = input.sources.length > 0;
        let a = db.select().from(accounts).where(sql`lower(${accounts.name}) = lower(${input.toName})`).get();
        if (!a) {
          a = db.insert(accounts).values({ name: input.toName, status: cited ? "active" : "quarantine" }).returning().get();
          if (!cited) warnings.push(`Created graph-only account "${a.name}" in QUARANTINE (no source); it is excluded from warm paths until cited.`);
        } else if (a.status === "quarantine" && cited) {
          a = db.update(accounts).set({ status: "active" }).where(eq(accounts.id, a.id)).returning().get();
        }
        addSources(db, "account", a.id, input.sources);
        toId = a.id;
      } else throw new ToolError("toName only works with toType account or school", "invalid_input");
    } else if (!entityExists(db, input.toType, toId)) throw new ToolError(`${input.toType} #${toId} not found`, "not_found");

    const { edge, created } = ensureEdge(db, { fromType: input.fromType, fromId: input.fromId, toType: input.toType, toId, type: input.type, meta: input.meta ?? null });
    return {
      result: { edge, created },
      warnings,
      summary: `Edge ${input.fromType}#${input.fromId} —${input.type}→ ${input.toType}#${toId}${input.toName ? ` (${input.toName})` : ""}${created ? "" : " (exists)"}`,
      entityType: input.fromType,
      entityId: input.fromId,
    };
  },
});

const upsertLeadTool = defineTool({
  name: "upsert_lead",
  description:
    "Create or update the lead for a person × product with a 0–100 fit score, tier (A/B/C; derived from score if omitted: ≥75 A, ≥50 B) and a rationale that cites the ICP fields and signals it matched. Quarantined people cannot become leads. Stage is not changed here (use move_stage).",
  input: z.object({
    personId: idSchema,
    productId: idSchema.optional().describe("Defaults to the first product"),
    fitScore: z.number().min(0).max(100),
    tier: z.enum(TIERS).optional(),
    rationale: z.string().min(1),
  }),
  handler: (input, { db, actorKind }) => {
    const person = requireRow(db.select().from(people).where(eq(people.id, input.personId)).get(), "Person", input.personId);
    if (person.status === "quarantine")
      throw new ToolError(`Person #${person.id} is quarantined (no source). Call add_person with sources[] first.`, "citation_required");
    const product = getProduct(db, input.productId);
    if (!product) throw new ToolError("Product not found", "not_found");
    const tier = input.tier ?? tierFor(input.fitScore);
    const existing = db.select().from(leads).where(and(eq(leads.personId, person.id), eq(leads.productId, product.id))).get();
    const lead = existing
      ? db
          .update(leads)
          .set({ fitScore: input.fitScore, tier, rationale: input.rationale, updatedAt: nowIso() })
          .where(eq(leads.id, existing.id))
          .returning()
          .get()
      : db
          .insert(leads)
          .values({ personId: person.id, productId: product.id, fitScore: input.fitScore, tier, rationale: input.rationale, ownerKind: actorKind })
          .returning()
          .get();
    ensureEdge(db, { fromType: "person", fromId: person.id, toType: "product", toId: product.id, type: "matched_to", meta: { fitScore: input.fitScore } });
    return {
      result: { lead, created: !existing },
      summary: `${existing ? "Rescored" : "Matched"} ${person.name}: fit ${Math.round(input.fitScore)} · tier ${tier}`,
      entityType: "lead",
      entityId: lead.id,
      leadId: lead.id,
    };
  },
});

const listLeadsTool = defineTool({
  name: "list_leads",
  description: "List leads (best fit first) with person, account, active signals and citations. Use before drafting messages.",
  input: z.object({
    productId: idSchema.optional(),
    stage: z.enum(STAGES).optional(),
    limit: z.number().int().min(1).max(100).default(25),
  }),
  handler: (input, { db }) => {
    const rows = listLeadViews(db, { productId: input.productId, stage: input.stage }).slice(0, input.limit);
    return { result: { leads: rows }, summary: `Listed ${rows.length} lead(s)` };
  },
});

const draftMessageTool = defineTool({
  name: "draft_message",
  description:
    "Draft one outreach message for a lead (email or linkedin, step 1–3, variant A/B). Always saved as status 'draft' for HITL review: only a human rep can approve it in the Outbox, and nothing is sent without approval. Personalize on the lead's signals and pass their ids in signalsUsed. Re-drafting the same lead/channel/step/variant replaces the draft; it fails if that message is already approved or sent.",
  input: z.object({
    leadId: idSchema,
    channel: z.enum(CHANNELS),
    step: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
    variant: z.enum(VARIANTS).default("A"),
    subject: z.string().max(200).optional().describe("Required for email"),
    body: z.string().min(1).max(5000),
    signalsUsed: z.array(idSchema).default([]).describe("Ids of the signals this copy references"),
  }),
  handler: (input, { db }) => {
    const lead = requireRow(db.select().from(leads).where(eq(leads.id, input.leadId)).get(), "Lead", input.leadId);
    const person = db.select().from(people).where(eq(people.id, lead.personId)).get()!;
    if (input.channel === "email" && !input.subject) throw new ToolError("Email drafts need a subject", "invalid_input");
    for (const sid of input.signalsUsed) {
      const s = db.select({ id: signals.id, status: signals.status }).from(signals).where(eq(signals.id, sid)).get();
      if (!s) throw new ToolError(`Signal #${sid} not found`, "not_found");
      if (s.status === "quarantine")
        throw new ToolError(`Signal #${sid} is quarantined (no source); cite it with add_signal before using it in copy.`, "citation_required");
    }
    const warnings: string[] = [];
    if (!input.signalsUsed.length) warnings.push("No signalsUsed: judges expect signal-personalized copy.");
    if (input.channel === "email" && !person.email) warnings.push(`${person.name} has no email on file yet.`);

    const existing = db
      .select()
      .from(messages)
      .where(and(eq(messages.leadId, lead.id), eq(messages.channel, input.channel), eq(messages.step, input.step), eq(messages.variant, input.variant)))
      .get();
    if (existing && (existing.status === "approved" || existing.status === "sent"))
      throw new ToolError(`Message #${existing.id} is already ${existing.status}; it cannot be redrafted.`, "locked");
    const values = {
      subject: input.channel === "email" ? (input.subject ?? null) : null,
      body: input.body,
      signalsUsed: input.signalsUsed,
      status: "draft" as const,
      decidedBy: null,
      decidedAt: null,
    };
    const message = existing
      ? db.update(messages).set({ ...values, updatedAt: nowIso() }).where(eq(messages.id, existing.id)).returning().get()
      : db.insert(messages).values({ leadId: lead.id, channel: input.channel, step: input.step, variant: input.variant, ...values }).returning().get();
    return {
      result: { message, created: !existing },
      warnings,
      summary: `Drafted ${input.channel} step ${input.step}/${input.variant} for ${person.name}${input.signalsUsed.length ? ` using ${input.signalsUsed.length} signal(s)` : ""} → awaiting approval`,
      entityType: "message",
      entityId: message.id,
      leadId: lead.id,
    };
  },
});

const moveStageTool = defineTool({
  name: "move_stage",
  description:
    "Move a lead to a pipeline stage: matched → contacted → replied → meeting_booked → closed_won | closed_lost. The agent may only move a lead to 'contacted' (or later) once a rep has approved at least one message for it. The actor (agent/rep) of every move is recorded in activity for attribution; the lead's ownerKind (who sourced it) does not change.",
  input: z.object({
    leadId: idSchema,
    stage: z.enum(STAGES),
    note: z.string().max(500).optional(),
  }),
  handler: (input, { db, actorKind }) => {
    const lead = requireRow(db.select().from(leads).where(eq(leads.id, input.leadId)).get(), "Lead", input.leadId);
    const person = db.select().from(people).where(eq(people.id, lead.personId)).get()!;
    const from = lead.stage;
    if (actorKind === "agent" && input.stage !== "matched" && input.stage !== "closed_lost") {
      const approved = db
        .select({ id: messages.id })
        .from(messages)
        .where(and(eq(messages.leadId, lead.id), sql`${messages.status} IN ('approved','sent')`))
        .get();
      if (!approved)
        throw new ToolError(
          `Lead #${lead.id} has no approved message. A rep must approve outreach in the Outbox before the lead can move to ${input.stage}.`,
          "approval_required",
        );
    }
    const updated =
      from === input.stage
        ? lead
        : db
            .update(leads)
            .set({ stage: input.stage, updatedAt: nowIso() })
            .where(eq(leads.id, lead.id))
            .returning()
            .get();
    return {
      result: { lead: updated, from, to: input.stage, changed: from !== input.stage },
      summary: `${person.name}: ${from} → ${input.stage}${input.note ? ` (${input.note})` : ""}`,
      entityType: "lead",
      entityId: lead.id,
      leadId: lead.id,
      data: { from, to: input.stage, note: input.note ?? null },
    };
  },
});

const queryGraphTool = defineTool({
  name: "query_graph",
  description:
    "Find warm-intro paths from a person to other people through shared employers (current or past) and schools. maxHops counts edges: 2 = shared employer/school, 4 = colleague-of-colleague. Optionally restrict to one targetPersonId.",
  input: z.object({
    personId: idSchema,
    targetPersonId: idSchema.optional(),
    maxHops: z.number().int().min(2).max(4).default(4),
    limit: z.number().int().min(1).max(100).default(20),
  }),
  handler: (input, { db }) => {
    const person = requireRow(db.select().from(people).where(eq(people.id, input.personId)).get(), "Person", input.personId);
    if (person.status === "quarantine")
      throw new ToolError(`Person #${person.id} is quarantined (no source). Cite them with add_person first.`, "citation_required");
    meter(db, { event: "graph_query" });
    const paths = warmPaths(db, input);
    return {
      result: { paths },
      summary: `Graph: ${paths.length} warm path(s) from ${person.name}${paths[0] ? ` — best: ${paths[0].summary}` : ""}`,
      entityType: "person",
      entityId: person.id,
    };
  },
});

const logNoteTool = defineTool({
  name: "log_note",
  description: "Write a short progress note to the Agent Thinking panel (what you are doing and why). Use between steps.",
  input: z.object({
    summary: z.string().min(1).max(500),
    leadId: idSchema.optional(),
    entityType: z.enum(ENTITY_TYPES).optional(),
    entityId: idSchema.optional(),
  }),
  handler: (input) => ({
    result: { ok: true },
    summary: input.summary,
    leadId: input.leadId,
    entityType: input.entityType,
    entityId: input.entityId,
  }),
});

export const TOOLS: ToolDef[] = [
  getProductTool,
  saveIcpTool,
  addAccountTool,
  addPersonTool,
  addSignalTool,
  addEdgeTool,
  upsertLeadTool,
  listLeadsTool,
  draftMessageTool,
  moveStageTool,
  queryGraphTool,
  logNoteTool,
];
