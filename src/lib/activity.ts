import { desc, gt } from "drizzle-orm";
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

/** Newest-first feed; pass `afterId` to poll only rows newer than the last one seen. */
export function listActivity(db: Db, opts: { afterId?: number; limit?: number } = {}): Activity[] {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  const q = db.select().from(activity);
  return (opts.afterId ? q.where(gt(activity.id, opts.afterId)) : q)
    .orderBy(desc(activity.id))
    .limit(limit)
    .all();
}
