import { describe, expect, it } from "vitest";
import { buildActivityGraph, kindOf, slot, type ActivityLike } from "./activity-graph";

const act = (id: number, tool: string, actorKind: ActivityLike["actorKind"] = "agent", entityType?: string): ActivityLike => ({
  id,
  tool,
  actorKind,
  summary: tool,
  createdAt: `2026-11-24T19:40:${String(id).padStart(2, "0")}.000Z`,
  entityType,
});

describe("kindOf", () => {
  it("maps known tools, falls back to entityType, tool words, then other", () => {
    expect(kindOf(act(1, "add_person"))).toBe("person");
    expect(kindOf(act(1, "icp.expansion"))).toBe("icp");
    expect(kindOf(act(1, "approve_message"))).toBe("message");
    expect(kindOf(act(1, "move_stage", "agent", "account"))).toBe("account");
    expect(kindOf(act(1, "flare"))).toBe("other");
  });
});

describe("buildActivityGraph", () => {
  // Newest first, as the feed returns it.
  const feed = [act(5, "add_person"), act(4, "product.save", "rep"), act(3, "add_person"), act(2, "add_account"), act(1, "get_product")];
  const g = buildActivityGraph(feed);

  it("counts nodes and edges per actor and kind", () => {
    const byId = Object.fromEntries(g.nodes.map((n) => [n.id, n]));
    expect(byId.agent.count).toBe(4);
    expect(byId.rep.count).toBe(1);
    expect(byId.person.count).toBe(2);
    expect(byId.product.count).toBe(2);
    expect(g.edges.find((e) => e.id === "agent>person")).toMatchObject({ count: 2, age: 0 });
    expect(g.edges.find((e) => e.id === "rep>product")).toMatchObject({ count: 1, age: 1 });
  });

  it("marks the newest step current and paints it last", () => {
    expect(g.currentNode).toBe("person");
    expect(g.current?.id).toBe(5);
    expect(g.edges.at(-1)?.id).toBe("agent>person");
  });

  it("keeps each kind in the same place whatever the feed order", () => {
    const again = buildActivityGraph([...feed].reverse());
    const pos = (graph: typeof g, id: string) => graph.nodes.find((n) => n.id === id);
    expect(pos(again, "person")).toMatchObject(slot("person"));
    expect(pos(g, "person")).toMatchObject(slot("person"));
  });

  it("handles an empty feed", () => {
    expect(buildActivityGraph([])).toEqual({ nodes: [], edges: [], current: null, currentNode: null });
  });
});
