import { describe, expect, it } from "vitest";
import { mockActivity, mockLeads } from "@/lib/mock/data";
import { STAGES } from "@/lib/types";
import type { Activity } from "@/lib/types";
import { groupByStage, lastStageMovers } from "./pipeline";

describe("groupByStage", () => {
  it("has every stage column and places each lead once, best fit first", () => {
    const g = groupByStage(mockLeads);
    expect(Object.keys(g)).toEqual([...STAGES]);
    expect(Object.values(g).flat()).toHaveLength(mockLeads.length);
    for (const col of Object.values(g)) {
      for (let i = 1; i < col.length; i++) expect(col[i - 1].fitScore).toBeGreaterThanOrEqual(col[i].fitScore);
    }
  });
});

describe("lastStageMovers", () => {
  it("keeps the latest move_stage actor per lead", () => {
    const extra: Activity = { ...mockActivity[3], id: 99, actorKind: "rep", createdAt: "2026-11-24T21:00:00.000Z" };
    const m = lastStageMovers([extra, ...mockActivity]);
    expect(m.get(1)?.actorKind).toBe("rep");
    expect(m.get(5)?.actorKind).toBe("rep");
    expect(m.has(3)).toBe(false);
  });
});
