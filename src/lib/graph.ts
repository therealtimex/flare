// Warm-intro paths: walk employer/school edges (both directions) from a person
// with a recursive CTE and return paths that end at another person.
// 2 hops = shared employer/school (A → Org ← B); 4 hops = colleague of a colleague.
import { inArray, sql } from "drizzle-orm";
import type { Db } from "./db";
import { accounts, people, schools } from "./db/schema";
import type { EdgeType, EntityType } from "./types";

export const WARM_EDGE_TYPES: EdgeType[] = ["works_at", "previously_employed_at", "studied_at"];

export interface PathNode {
  type: EntityType;
  id: number;
  label: string;
}

export interface WarmPath {
  hops: number;
  nodes: PathNode[];
  edgeTypes: EdgeType[];
  /** Human summary, e.g. "Ada Lovelace ↔ Acme (works_at / previously_employed_at) ↔ Bob Smith". */
  summary: string;
}

export interface WarmPathQuery {
  personId: number;
  targetPersonId?: number;
  maxHops?: number;
  limit?: number;
}

export function warmPaths(db: Db, q: WarmPathQuery): WarmPath[] {
  const maxHops = Math.min(Math.max(q.maxHops ?? 4, 2), 4);
  const limit = Math.min(Math.max(q.limit ?? 20, 1), 100);
  const start = `person:${q.personId}`;
  const target = q.targetPersonId ? `person:${q.targetPersonId}` : null;
  const types = sql.join(
    WARM_EDGE_TYPES.map((t) => sql`${t}`),
    sql`, `,
  );

  const rows = db.all<{ path: string; etypes: string; hops: number }>(sql`
    WITH RECURSIVE
      e(a, b, etype) AS (
        SELECT from_type || ':' || from_id, to_type || ':' || to_id, type FROM edges WHERE type IN (${types})
        UNION ALL
        SELECT to_type || ':' || to_id, from_type || ':' || from_id, type FROM edges WHERE type IN (${types})
      ),
      walk(node, path, etypes, hops) AS (
        SELECT ${start}, ',' || ${start} || ',', ',', 0
        UNION ALL
        SELECT e.b, walk.path || e.b || ',', walk.etypes || e.etype || ',', walk.hops + 1
        FROM walk JOIN e ON e.a = walk.node
        WHERE walk.hops < ${maxHops} AND instr(walk.path, ',' || e.b || ',') = 0
      )
    SELECT path, etypes, hops FROM walk
    WHERE hops > 0 AND node LIKE 'person:%' AND (${target} IS NULL OR node = ${target})
    ORDER BY hops, path
    LIMIT ${limit}
  `);

  const parsed = rows.map((r) => ({
    hops: r.hops,
    keys: r.path.split(",").filter(Boolean),
    edgeTypes: r.etypes.split(",").filter(Boolean) as EdgeType[],
  }));

  const ids: Record<string, Set<number>> = { person: new Set(), account: new Set(), school: new Set() };
  for (const p of parsed)
    for (const k of p.keys) {
      const [t, id] = k.split(":");
      ids[t]?.add(Number(id));
    }
  const labels = new Map<string, string>();
  const put = (t: string, rows: { id: number; name: string }[]) => rows.forEach((r) => labels.set(`${t}:${r.id}`, r.name));
  if (ids.person.size) put("person", db.select({ id: people.id, name: people.name }).from(people).where(inArray(people.id, [...ids.person])).all());
  if (ids.account.size) put("account", db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(inArray(accounts.id, [...ids.account])).all());
  if (ids.school.size) put("school", db.select({ id: schools.id, name: schools.name }).from(schools).where(inArray(schools.id, [...ids.school])).all());

  return parsed.map((p) => {
    const nodes = p.keys.map((k) => {
      const [type, id] = k.split(":");
      return { type: type as EntityType, id: Number(id), label: labels.get(k) ?? k };
    });
    const parts: string[] = [nodes[0].label];
    for (let i = 1; i < nodes.length; i++) parts.push(`(${p.edgeTypes[i - 1]})`, nodes[i].label);
    return { hops: p.hops, nodes, edgeTypes: p.edgeTypes, summary: parts.join(" → ") };
  });
}
