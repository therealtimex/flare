"use client";
import { useMemo } from "react";
import { buildActivityGraph, VIEW, type ActivityLike, type GraphNode } from "@/lib/client/activity-graph";
import { formatClock } from "@/lib/client/format";
import { cn } from "@/lib/utils";

// Shape by kind (design system: organizations square, people round, signals diamond, the rest dots).
const SHAPE: Record<string, "square" | "circle" | "diamond" | "dot"> = {
  product: "square", icp: "square", account: "square",
  person: "circle", lead: "circle",
  signal: "diamond", graph: "diamond", school: "diamond",
};

function Shape({ node, size, className }: { node: GraphNode; size: number; className: string }) {
  const { x, y } = node;
  switch (SHAPE[node.kind] ?? "dot") {
    case "square":
      return <rect x={x - size} y={y - size} width={size * 2} height={size * 2} rx={2} className={className} />;
    case "diamond":
      return <rect x={x - size} y={y - size} width={size * 2} height={size * 2} rx={1.5} transform={`rotate(45 ${x} ${y})`} className={className} />;
    case "circle":
      return <circle cx={x} cy={y} r={size} className={className} />;
    default:
      return <circle cx={x} cy={y} r={Math.max(4, size - 3)} className={className} />;
  }
}

// Ring labels point outward from the centre so neighbouring slots never collide; actor labels sit below.
function labelAt(n: GraphNode, size: number, isActor: boolean) {
  if (isActor) return { x: n.x, y: n.y + size + 12, textAnchor: "middle" as const };
  const dx = n.x - VIEW.cx;
  const dy = n.y - VIEW.cy;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const gap = size + 7;
  return {
    x: n.x + ux * gap,
    y: n.y + uy * gap + 3.5 + (uy > 0.7 ? 4 : 0),
    textAnchor: ux > 0.3 ? ("start" as const) : ux < -0.3 ? ("end" as const) : ("middle" as const),
  };
}

export function AgentGraph({ activities }: { activities: ActivityLike[] }) {
  const g = useMemo(() => buildActivityGraph(activities), [activities]);
  const pos = useMemo(() => new Map(g.nodes.map((n) => [n.id, n])), [g]);

  if (!g.current) {
    return <p className="body-sm px-4 py-6 text-ink-muted">No activity yet. Run the GTM agent from Intake.</p>;
  }

  const kinds = g.nodes.filter((n) => n.kind !== "agent" && n.kind !== "rep");
  return (
    <div className="flex flex-col gap-3 px-4 py-3" data-testid="agent-graph">
      <svg
        viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
        className="w-full"
        role="img"
        aria-label={`Agent activity graph: ${kinds.length} areas touched across ${activities.length} steps. Current: ${g.current.summary}`}
      >
        {g.edges.map((e) => {
          const a = pos.get(e.from)!;
          const b = pos.get(e.to)!;
          return (
            <line
              key={e.age === 0 ? `${e.id}:${g.current!.id}` : e.id}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              pathLength={e.age === 0 ? 1 : undefined}
              strokeDasharray={e.age !== 0 && e.from === "rep" ? "3 3" : undefined}
              strokeWidth={e.age === 0 ? 1.75 : 1 + Math.min(e.count, 4) * 0.15}
              className={cn(
                "transition-[stroke] duration-300",
                e.age === 0 ? "fl-graph-draw stroke-flare" : e.age <= 4 ? "stroke-ink-muted" : "stroke-line",
              )}
            />
          );
        })}

        {g.nodes.map((n) => {
          const isActor = n.kind === "agent" || n.kind === "rep";
          const isCurrent = n.id === g.currentNode;
          const size = isActor ? (n.kind === "agent" ? 13 : 9) : 5 + Math.min(n.count, 6);
          return (
            <g key={n.id} className="fl-graph-pop">
              <title>{`${n.kind} · ${n.count} step${n.count === 1 ? "" : "s"} · last: ${n.last.summary}`}</title>
              {isCurrent && (
                <circle cx={n.x} cy={n.y} r={size + 5} className="origin-center animate-ping fill-none stroke-flare [transform-box:fill-box] motion-reduce:hidden" />
              )}
              {isActor ? (
                <circle
                  cx={n.x} cy={n.y} r={size}
                  strokeDasharray={n.kind === "rep" ? "3 2" : undefined}
                  className={cn("fill-surface-1", n.kind === "agent" ? "stroke-ink" : "stroke-ink-muted")}
                  strokeWidth={1.5}
                />
              ) : (
                <Shape
                  node={n}
                  size={size}
                  className={cn(isCurrent ? "fill-flare stroke-flare" : "fill-surface-1 stroke-line-strong", "[stroke-width:1.5]")}
                />
              )}
              <text
                {...labelAt(n, size, isActor)}
                // Halo in the panel colour keeps labels readable where edges cross them.
                className={cn(
                  "stroke-surface-1 font-mono text-[10px] [paint-order:stroke] [stroke-width:3px]",
                  isCurrent ? "fill-ink" : "fill-ink-muted",
                )}
              >
                {n.kind}
                {!isActor && <tspan className="fill-ink-faint"> {n.count}</tspan>}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="border-t border-line pt-2 text-xs" aria-live="polite">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-flare-text">Now</span>
          <code className="truncate font-mono text-[11px] text-ink-muted">{g.current.tool}</code>
          <time className="ml-auto shrink-0 font-mono text-[11px] text-ink-muted" dateTime={g.current.createdAt}>
            {formatClock(g.current.createdAt)}
          </time>
        </div>
        <p className="mt-1 leading-snug text-ink">{g.current.summary}</p>
      </div>

      <p className="font-mono text-[10px] leading-relaxed text-ink-faint">
        ■ org · ● people · ◆ signals/graph · • other — solid: agent, dashed: rep
      </p>
    </div>
  );
}
