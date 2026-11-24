// C4 analytics: stage funnel, conversion by industry and tier, message variant
// split and agent-vs-rep attribution. Computed in memory (demo-sized data).
import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "./db";
import { accounts, activity, leads, messages, people } from "./db/schema";
import { usageSummary } from "./metering";
import { STAGES, TIERS, VARIANTS, type ActorKind, type Analytics, type Conversion, type Stage } from "./types";

export type { Analytics, Conversion };

/** Funnel order; closed_lost is an exit, not a step. */
export const FUNNEL: Stage[] = ["matched", "contacted", "replied", "meeting_booked", "closed_won"];

const rank = (s: Stage) => FUNNEL.indexOf(s);

export function computeAnalytics(db: Db, productId?: number): Analytics {
  const rows = db
    .select({ lead: leads, industry: accounts.industry })
    .from(leads)
    .innerJoin(people, eq(leads.personId, people.id))
    .leftJoin(accounts, eq(people.accountId, accounts.id))
    .where(and(eq(people.status, "active"), productId ? eq(leads.productId, productId) : undefined))
    .all();
  const leadIds = rows.map((r) => r.lead.id);

  // Highest funnel stage each lead ever held (from move_stage history + current stage).
  const best = new Map<number, number>(rows.map((r) => [r.lead.id, Math.max(0, rank(r.lead.stage))]));
  const lost = new Set(rows.filter((r) => r.lead.stage === "closed_lost").map((r) => r.lead.id));
  const moves = leadIds.length
    ? db.select().from(activity).where(and(eq(activity.tool, "move_stage"), inArray(activity.leadId, leadIds))).all()
    : [];
  const stageMovesBy: Record<ActorKind, number> = { agent: 0, rep: 0 };
  for (const m of moves) {
    const d = (m.data ?? {}) as { from?: Stage; to?: Stage };
    if (d.from !== d.to) stageMovesBy[m.actorKind] += 1;
    for (const s of [d.from, d.to]) if (s && rank(s) >= 0) best.set(m.leadId!, Math.max(best.get(m.leadId!) ?? 0, rank(s)));
  }
  const reached = (id: number, s: Stage) => (best.get(id) ?? 0) >= rank(s);

  const conv = (ids: number[]): Conversion => {
    const c = (s: Stage) => ids.filter((id) => reached(id, s)).length;
    const contacted = c("contacted");
    const replied = c("replied");
    const won = c("closed_won");
    return {
      leads: ids.length,
      contacted,
      replied,
      meetingBooked: c("meeting_booked"),
      won,
      lost: ids.filter((id) => lost.has(id)).length,
      replyRate: contacted ? replied / contacted : 0,
      winRate: ids.length ? won / ids.length : 0,
    };
  };

  const byStage = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<Stage, number>;
  for (const r of rows) byStage[r.lead.stage] += 1;

  const industries = new Map<string, number[]>();
  for (const r of rows) {
    const k = r.industry?.trim() || "Unknown";
    industries.set(k, [...(industries.get(k) ?? []), r.lead.id]);
  }

  const msgs = leadIds.length
    ? db
        .select({ leadId: messages.leadId, variant: messages.variant, status: messages.status })
        .from(messages)
        .where(inArray(messages.leadId, leadIds))
        .all()
    : [];
  const byVariant = VARIANTS.map((variant) => {
    const vm = msgs.filter((m) => m.variant === variant);
    const n = (s: string) => vm.filter((m) => m.status === s).length;
    const vLeads = [...new Set(vm.filter((m) => m.status === "approved" || m.status === "sent").map((m) => m.leadId))];
    const replied = vLeads.filter((id) => reached(id, "replied")).length;
    return {
      variant,
      drafted: vm.length,
      approved: n("approved"),
      rejected: n("rejected"),
      sent: n("sent"),
      leads: vLeads.length,
      replied,
      replyRate: vLeads.length ? replied / vLeads.length : 0,
    };
  });
  const usage = usageSummary(db);

  const approvals = leadIds.length
    ? db.select({ id: activity.id }).from(activity).where(and(eq(activity.tool, "message.approve"), inArray(activity.leadId, leadIds))).all().length
    : 0;

  const reachedCounts = FUNNEL.map((stage) => leadIds.filter((id) => reached(id, stage)).length);
  const funnelSteps = FUNNEL.map((stage, i) => ({
    stage,
    count: byStage[stage],
    reached: reachedCounts[i],
    rate: rows.length ? reachedCounts[i] / rows.length : 0,
    toNext: i === FUNNEL.length - 1 ? null : reachedCounts[i] ? reachedCounts[i + 1] / reachedCounts[i] : 0,
  }));

  return {
    totals: { leads: rows.length, byStage },
    funnel: funnelSteps,
    closedLost: byStage.closed_lost,
    overallConversion: funnelSteps[0].reached ? funnelSteps[funnelSteps.length - 1].reached / funnelSteps[0].reached : 0,
    byIndustry: [...industries.entries()]
      .map(([industry, ids]) => ({ industry, ...conv(ids) }))
      .sort((a, b) => b.leads - a.leads || a.industry.localeCompare(b.industry)),
    byTier: TIERS.map((tier) => ({ tier, ...conv(rows.filter((r) => r.lead.tier === tier).map((r) => r.lead.id)) })),
    byVariant,
    attribution: {
      leadsSourcedBy: {
        agent: rows.filter((r) => r.lead.ownerKind === "agent").length,
        rep: rows.filter((r) => r.lead.ownerKind === "rep").length,
      },
      stageMovesBy,
      approvalsBy: { rep: approvals },
    },
    credits: {
      balance: usage.balance,
      unitsUsed: Object.fromEntries(Object.entries(usage.events).map(([k, v]) => [k, v.units])) as Analytics["credits"]["unitsUsed"],
      flexprice: {
        configured: usage.flexprice === "configured",
        sent: usage.byStatus.sent,
        failed: usage.byStatus.failed,
        pending: usage.byStatus.pending,
        notConfigured: usage.byStatus.not_configured,
      },
    },
  };
}
