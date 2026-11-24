// Read helpers shared by agent tools and UI API routes.
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "./db";
import { accounts, credits, icps, leads, messages, people, products, signals, sources } from "./db/schema";
import type { EntityType, Icp, LeadView, Message, Product, QuarantineCounts, SourceRef, Stage } from "./types";

export function getProduct(db: Db, productId?: number): Product | undefined {
  const q = db.select().from(products);
  return productId ? q.where(eq(products.id, productId)).get() : q.orderBy(asc(products.id)).get();
}

export function getIcp(db: Db, productId: number): Icp | undefined {
  return db.select().from(icps).where(eq(icps.productId, productId)).orderBy(desc(icps.id)).get();
}

export function addSources(db: Db, entityType: EntityType, entityId: number, refs: SourceRef[]): number {
  if (!refs.length) return 0;
  const existing = new Set(
    db
      .select({ url: sources.url })
      .from(sources)
      .where(and(eq(sources.entityType, entityType), eq(sources.entityId, entityId)))
      .all()
      .map((r) => r.url),
  );
  const fresh = refs.filter((r) => !existing.has(r.url));
  if (fresh.length)
    db.insert(sources)
      .values(fresh.map((r) => ({ entityType, entityId, url: r.url, quote: r.quote ?? null })))
      .run();
  return fresh.length;
}

export function sourceCount(db: Db, entityType: EntityType, entityId: number): number {
  return db
    .select({ n: count() })
    .from(sources)
    .where(and(eq(sources.entityType, entityType), eq(sources.entityId, entityId)))
    .get()!.n;
}

export function quarantineCounts(db: Db): QuarantineCounts {
  const n = (t: typeof accounts | typeof people | typeof signals) =>
    db.select({ n: count() }).from(t).where(eq(t.status, "quarantine")).get()!.n;
  return { accounts: n(accounts), people: n(people), signals: n(signals) };
}

export function creditBalance(db: Db): number {
  return db.select().from(credits).where(eq(credits.id, 1)).get()?.balance ?? 0;
}

/** Leads joined with person, account, active signals and all citations. Quarantined people are excluded. */
export function listLeadViews(db: Db, opts: { productId?: number; stage?: Stage; leadIds?: number[] } = {}): LeadView[] {
  const conds = [eq(people.status, "active")];
  if (opts.productId) conds.push(eq(leads.productId, opts.productId));
  if (opts.stage) conds.push(eq(leads.stage, opts.stage));
  if (opts.leadIds) conds.push(inArray(leads.id, opts.leadIds.length ? opts.leadIds : [-1]));
  const rows = db
    .select({ lead: leads, person: people, account: accounts })
    .from(leads)
    .innerJoin(people, eq(leads.personId, people.id))
    .leftJoin(accounts, eq(people.accountId, accounts.id))
    .where(and(...conds))
    .orderBy(desc(leads.fitScore), asc(leads.id))
    .all();
  if (!rows.length) return [];

  const accountIds = [...new Set(rows.map((r) => r.account?.id).filter((x): x is number => !!x))];
  const sigs = accountIds.length
    ? db
        .select()
        .from(signals)
        .where(and(inArray(signals.accountId, accountIds), eq(signals.status, "active")))
        .orderBy(desc(signals.id))
        .all()
    : [];
  const personIds = rows.map((r) => r.person.id);
  const signalIds = sigs.map((s) => s.id);
  const srcs = db
    .select()
    .from(sources)
    .where(
      and(
        inArray(sources.entityType, ["person", "account", "signal"]),
        inArray(sources.entityId, [...new Set([...personIds, ...accountIds, ...signalIds])]),
      ),
    )
    .all();

  return rows.map(({ lead, person, account }) => {
    const leadSignals = account ? sigs.filter((s) => s.accountId === account.id) : [];
    const sigIds = new Set(leadSignals.map((s) => s.id));
    return {
      ...lead,
      person,
      account: account ?? null,
      signals: leadSignals,
      sources: srcs.filter(
        (s) =>
          (s.entityType === "person" && s.entityId === person.id) ||
          (s.entityType === "account" && account && s.entityId === account.id) ||
          (s.entityType === "signal" && sigIds.has(s.entityId)),
      ),
    };
  });
}

export function listMessages(db: Db, opts: { leadId?: number; status?: Message["status"] } = {}): Message[] {
  const conds = [];
  if (opts.leadId) conds.push(eq(messages.leadId, opts.leadId));
  if (opts.status) conds.push(eq(messages.status, opts.status));
  return db
    .select()
    .from(messages)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(messages.leadId), asc(messages.step), asc(messages.variant))
    .all();
}
