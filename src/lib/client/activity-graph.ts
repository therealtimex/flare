// Turns the activity feed into a node graph for the Agent Thinking panel:
// actors (agent, rep) link to the kinds of things they touched. Layout is a
// fixed radial slot per kind, so nodes never move as the feed updates.
import type { ActorKind } from "@/lib/types";

export interface ActivityLike {
  id: string | number;
  actorKind: ActorKind;
  tool: string;
  summary: string;
  createdAt: string;
  /** Present on server rows (lib/types Activity); preferred over the tool name. */
  entityType?: string | null;
}

export const GRAPH_KINDS = [
  "product", "icp", "account", "person", "signal", "school",
  "graph", "lead", "message", "note", "credits", "other",
] as const;
export type GraphKind = (typeof GRAPH_KINDS)[number];

const TOOL_KIND: Record<string, GraphKind> = {
  get_product: "product",
  "product.save": "product",
  save_icp: "icp",
  "icp.expansion": "icp",
  add_account: "account",
  add_person: "person",
  add_signal: "signal",
  add_edge: "graph",
  query_graph: "graph",
  upsert_lead: "lead",
  list_leads: "lead",
  move_stage: "lead",
  draft_message: "message",
  log_note: "note",
  "credits.topup": "credits",
};

const isKind = (s: string | null | undefined): s is GraphKind => !!s && (GRAPH_KINDS as readonly string[]).includes(s);

export function kindOf(a: Pick<ActivityLike, "tool" | "entityType">): GraphKind {
  if (isKind(a.entityType)) return a.entityType;
  return TOOL_KIND[a.tool] ?? a.tool.split(/[._]/).find(isKind) ?? "other";
}

export const VIEW = { w: 320, h: 260, cx: 160, cy: 120, r: 88 } as const;

export function slot(kind: GraphKind): { x: number; y: number } {
  const angle = (GRAPH_KINDS.indexOf(kind) / GRAPH_KINDS.length) * 2 * Math.PI - Math.PI / 2;
  return { x: Math.round(VIEW.cx + VIEW.r * Math.cos(angle)), y: Math.round(VIEW.cy + VIEW.r * Math.sin(angle)) };
}

const ACTOR_POS: Record<ActorKind, { x: number; y: number }> = {
  agent: { x: VIEW.cx, y: VIEW.cy },
  // Off both axes so rep never sits on an agent edge.
  rep: { x: VIEW.cx - 44, y: VIEW.cy + 30 },
};

export interface GraphNode {
  id: string;
  kind: GraphKind | ActorKind;
  count: number;
  x: number;
  y: number;
  /** Newest activity on this node. */
  last: ActivityLike;
}

export interface GraphEdge {
  id: string;
  from: ActorKind;
  to: GraphKind;
  count: number;
  /** Steps since this edge was last used: 0 = the current step. */
  age: number;
}

export interface ActivityGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  current: ActivityLike | null;
  currentNode: GraphKind | null;
}

/** `activities` newest first, as the feed returns them. */
export function buildActivityGraph(activities: ActivityLike[]): ActivityGraph {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();

  activities.forEach((a, age) => {
    const kind = kindOf(a);
    for (const [id, k, pos] of [
      [a.actorKind, a.actorKind, ACTOR_POS[a.actorKind]],
      [kind, kind, slot(kind)],
    ] as const) {
      const n = nodes.get(id);
      if (n) n.count++;
      else nodes.set(id, { id, kind: k, count: 1, ...pos, last: a });
    }
    const eid = `${a.actorKind}>${kind}`;
    const e = edges.get(eid);
    if (e) e.count++;
    else edges.set(eid, { id: eid, from: a.actorKind, to: kind, count: 1, age });
  });

  const current = activities[0] ?? null;
  return {
    nodes: [...nodes.values()],
    // Oldest first so the newest edges paint on top.
    edges: [...edges.values()].sort((a, b) => b.age - a.age),
    current,
    currentNode: current ? kindOf(current) : null,
  };
}
