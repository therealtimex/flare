import { and, desc, gt } from "drizzle-orm";
import type { Db } from "./db";
import { activity } from "./db/schema";
import type { Activity, ActorKind, EntityType } from "./types";

export interface ActivityInput {
  actorKind: ActorKind;
  tool: string;
  summary: string;
  entityType?: EntityType | null;
  entityId?: number | null;
  leadId?: number | null;
  data?: Record<string, unknown> | null;
}

export function logActivity(db: Db, a: ActivityInput): Activity {
  return db
    .insert(activity)
    .values({
      actorKind: a.actorKind,
      tool: a.tool,
      summary: a.summary.slice(0, 500),
      entityType: a.entityType ?? null,
      entityId: a.entityId ?? null,
      leadId: a.leadId ?? null,
      data: a.data ?? null,
    })
    .returning()
    .get();
}

/** Newest-first feed; pass `afterId` (or `since`, ISO) to poll only newer rows. */
export function listActivity(db: Db, opts: { afterId?: number; since?: string; limit?: number } = {}): Activity[] {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  const conds = [];
  if (opts.afterId) conds.push(gt(activity.id, opts.afterId));
  if (opts.since) conds.push(gt(activity.createdAt, opts.since));
  return db
    .select()
    .from(activity)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(activity.id))
    .limit(limit)
    .all();
}
