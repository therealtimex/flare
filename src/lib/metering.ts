// Usage metering + credit-gated execution (C3).
// Every billable event is recorded locally in usage_events and costs credits
// (atomic decrement; never below 0). When FLEXPRICE_API_KEY is set the event is
// also sent to Flexprice's events API (POST {FLEXPRICE_API_URL}/events, header
// x-api-key). Sending is fail-soft and async: the app never fails or waits on
// Flexprice, and the key is never logged or returned.
import { count, eq, sql } from "drizzle-orm";
import type { Db } from "./db";
import { credits, usageEvents } from "./db/schema";
import type { FlexpriceStatus, UsageEvent, UsageEventName } from "./types";
import { USAGE_EVENTS } from "./types";

/** Credits charged per unit of each billable event. */
export const CREDIT_COST: Record<UsageEventName, number> = {
  lead_enriched: 1,
  outreach_sent: 1,
  graph_query: 1,
};

export class InsufficientCreditsError extends Error {
  readonly code = "insufficient_credits";
  constructor(
    public readonly needed: number,
    public readonly balance: number,
  ) {
    super(`Out of credits: this needs ${needed} credit(s) and the balance is ${balance}. Ask the rep to top up credits in Flare.`);
  }
}

export interface FlexpriceConfig {
  apiKey: string | null;
  apiUrl: string;
  customerId: string;
}

export function flexpriceConfig(env: Record<string, string | undefined> = process.env): FlexpriceConfig {
  // Unit tests never talk to the real Flexprice, even if a key is in the shell env.
  const underTest = env === process.env && !!env.VITEST;
  return {
    apiKey: underTest ? null : env.FLEXPRICE_API_KEY?.trim() || null,
    apiUrl: (env.FLEXPRICE_API_URL || "https://api.cloud.flexprice.io/v1").replace(/\/$/, ""),
    customerId: env.FLEXPRICE_CUSTOMER_ID || "flare-demo",
  };
}

/** Atomically spend credits; throws InsufficientCreditsError (nothing spent) if the balance is too low. */
export function spendCredits(db: Db, amount: number): number {
  if (amount <= 0) return balanceOf(db);
  const res = db
    .update(credits)
    .set({ balance: sql`${credits.balance} - ${amount}`, updatedAt: new Date().toISOString() })
    .where(sql`${credits.id} = 1 AND ${credits.balance} >= ${amount}`)
    .run();
  if (res.changes === 0) throw new InsufficientCreditsError(amount, balanceOf(db));
  return balanceOf(db);
}

export function balanceOf(db: Db): number {
  return db.select().from(credits).where(eq(credits.id, 1)).get()?.balance ?? 0;
}

/** Throws InsufficientCreditsError unless `amount` credits are available (does not spend). */
export function requireCredits(db: Db, amount = 1): void {
  const balance = balanceOf(db);
  if (balance < amount) throw new InsufficientCreditsError(amount, balance);
}

export type Fetch = typeof fetch;

/**
 * Charge credits and record a billable event. Call inside the caller's
 * transaction: if the charge fails nothing is recorded. The Flexprice send is
 * scheduled after the current synchronous work (i.e. after commit).
 */
export function meter(
  db: Db,
  e: { event: UsageEventName; units?: number; leadId?: number | null },
  opts: { config?: FlexpriceConfig; fetchImpl?: Fetch; send?: boolean } = {},
): UsageEvent {
  const units = e.units ?? 1;
  spendCredits(db, CREDIT_COST[e.event] * units);
  const cfg = opts.config ?? flexpriceConfig();
  const row = db
    .insert(usageEvents)
    .values({ event: e.event, units, leadId: e.leadId ?? null, flexpriceStatus: cfg.apiKey ? "pending" : "not_configured" })
    .returning()
    .get();
  if (cfg.apiKey && opts.send !== false) {
    setTimeout(() => void sendToFlexprice(db, row, cfg, opts.fetchImpl).catch(() => {}), 0);
  }
  return row;
}

/** POST one event to Flexprice and store the outcome on the usage row. Never throws. */
export async function sendToFlexprice(db: Db, row: UsageEvent, cfg: FlexpriceConfig, fetchImpl: Fetch = fetch): Promise<FlexpriceStatus> {
  if (!cfg.apiKey) return "not_configured";
  let status: FlexpriceStatus = "failed";
  try {
    const res = await fetchImpl(`${cfg.apiUrl}/events`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": cfg.apiKey },
      body: JSON.stringify({
        event_name: row.event,
        external_customer_id: cfg.customerId,
        event_id: `flare-${row.id}-${row.createdAt}`,
        source: "flare",
        timestamp: row.createdAt.replace(/\.\d{3}Z$/, "Z"),
        properties: { units: String(row.units), ...(row.leadId ? { lead_id: String(row.leadId) } : {}) },
      }),
      signal: AbortSignal.timeout(5000),
    });
    status = res.ok ? "sent" : "failed";
    if (!res.ok) console.warn(`[flexprice] ${row.event} #${row.id} rejected: HTTP ${res.status}`);
  } catch (err) {
    console.warn(`[flexprice] ${row.event} #${row.id} not sent: ${err instanceof Error ? err.name : "error"}`);
  }
  try {
    db.update(usageEvents).set({ flexpriceStatus: status }).where(eq(usageEvents.id, row.id)).run();
  } catch {
    /* DB closed (tests / shutdown) */
  }
  return status;
}

export interface UsageSummary {
  balance: number;
  flexprice: "configured" | "not_configured";
  costs: Record<UsageEventName, number>;
  events: Record<UsageEventName, { count: number; units: number }>;
  byStatus: Record<FlexpriceStatus, number>;
}

export function usageSummary(db: Db, env?: Record<string, string | undefined>): UsageSummary {
  const events = Object.fromEntries(USAGE_EVENTS.map((e) => [e, { count: 0, units: 0 }])) as UsageSummary["events"];
  for (const r of db
    .select({ event: usageEvents.event, n: count(), units: sql<number>`coalesce(sum(${usageEvents.units}),0)` })
    .from(usageEvents)
    .groupBy(usageEvents.event)
    .all())
    events[r.event] = { count: r.n, units: r.units };
  const byStatus = { pending: 0, sent: 0, failed: 0, not_configured: 0 } as UsageSummary["byStatus"];
  for (const r of db.select({ s: usageEvents.flexpriceStatus, n: count() }).from(usageEvents).groupBy(usageEvents.flexpriceStatus).all())
    byStatus[r.s] = r.n;
  return {
    balance: balanceOf(db),
    flexprice: flexpriceConfig(env).apiKey ? "configured" : "not_configured",
    costs: CREDIT_COST,
    events,
    byStatus,
  };
}
