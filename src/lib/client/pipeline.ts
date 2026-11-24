// Pure helpers for the Pipeline board (tested in pipeline.test.ts).
import { STAGES } from "@/lib/types";
import type { Activity, ActorKind, ID, LeadView, Stage } from "@/lib/types";

export function groupByStage(leads: LeadView[]): Record<Stage, LeadView[]> {
  const out = Object.fromEntries(STAGES.map((s) => [s, [] as LeadView[]])) as Record<Stage, LeadView[]>;
  for (const l of leads) out[l.stage]?.push(l);
  for (const s of STAGES) out[s].sort((a, b) => b.fitScore - a.fitScore);
  return out;
}

/** Who last moved each lead's stage, from move_stage activity (any order). */
export function lastStageMovers(activity: Activity[]): Map<ID, { actorKind: ActorKind; at: string }> {
  const out = new Map<ID, { actorKind: ActorKind; at: string }>();
  for (const a of activity) {
    if (a.tool !== "move_stage" || a.leadId == null) continue;
    const prev = out.get(a.leadId);
    if (!prev || a.createdAt > prev.at) out.set(a.leadId, { actorKind: a.actorKind, at: a.createdAt });
  }
  return out;
}
