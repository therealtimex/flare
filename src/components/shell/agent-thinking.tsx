"use client";
// Agent Thinking panel, built on Jay's ActivityFeed (.fl-feed). Newest entry on top.
import { X } from "lucide-react";
import { Tabs } from "radix-ui";
import { useState } from "react";
import { ActorBadge } from "@/components/actor-badge";
import { formatClock } from "@/lib/client/format";
import { useActivity } from "@/lib/client/hooks";
import type { Activity } from "@/lib/types";
import { AgentGraph } from "./agent-graph";

const VIEW_TAB =
  "rounded-sm px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-muted hover:text-ink data-[state=active]:bg-surface-2 data-[state=active]:text-ink";

/** reason | graph | validate, per the ActivityFeed README. */
function activityKind(a: Activity): { kind: "reason" | "graph" | "validate"; result?: "pass" | "fail" } {
  if (a.tool === "query_graph" || a.tool === "add_edge") return { kind: "graph" };
  if (a.tool === "log_note") return { kind: "reason" };
  const warn = a.data && ("warning" in a.data || "error" in a.data || "quarantined" in a.data);
  if (warn || /QUARANTINED|blocked|failed/.test(a.summary)) return { kind: "validate", result: "fail" };
  if (/^(add_|upsert_|save_)/.test(a.tool) && a.actorKind === "agent") return { kind: "validate", result: "pass" };
  return { kind: "reason" };
}

/** A run is "live" if the agent did something in the last 30s. */
const isLive = (rows: Activity[] | undefined) =>
  !!rows?.some((a) => a.actorKind === "agent" && Date.now() - new Date(a.createdAt).getTime() < 30_000);

export function AgentThinking({ onClose }: { onClose: () => void }) {
  const { data, error } = useActivity();
  const live = isLive(data);
  const latest = data?.[0];
  const [view, setView] = useState("list");

  return (
    <aside className="flex h-full shrink-0 flex-col gap-2 overflow-y-auto border-l border-line p-3" style={{ width: "var(--feed-width)" }} aria-label="Agent thinking">
      <details className="fl-feed" open data-testid="agent-thinking">
        <summary>
          <span className="fl-live" data-state={live ? undefined : "idle"}>
            {live ? "Live" : "Idle"}
          </span>
          Agent thinking
          <span className="fl-feed__latest">{latest?.summary ?? ""}</span>
        </summary>
        <Tabs.Root value={view} onValueChange={setView}>
          <div className="flex justify-end border-t border-line px-4 py-1.5">
            <Tabs.List aria-label="Agent thinking view" className="flex rounded border border-line p-0.5">
              <Tabs.Trigger value="list" className={VIEW_TAB}>List</Tabs.Trigger>
              <Tabs.Trigger value="graph" className={VIEW_TAB} data-testid="agent-graph-tab">Graph</Tabs.Trigger>
            </Tabs.List>
          </div>
          {error && <p className="body-sm px-4 py-2 text-negative">Activity unavailable: {error}</p>}
          <Tabs.Content value="graph" className="border-t border-line">
            <AgentGraph activities={data ?? []} />
          </Tabs.Content>
          <Tabs.Content value="list" asChild>
            <ol className="fl-feed__log" style={{ maxHeight: "calc(100dvh - 220px)" }}>
              {data?.length === 0 && (
                <li className="fl-log">
                  <span />
                  <span />
                  <p className="text-ink-muted">No activity yet. Run the GTM agent from Intake.</p>
                </li>
              )}
              {data?.map((a) => {
                const { kind, result } = activityKind(a);
                return (
                  <li key={a.id} className="fl-log" data-kind={kind} data-result={result} data-testid="activity-row">
                    <time dateTime={a.createdAt} title={a.createdAt}>
                      {formatClock(a.createdAt)}
                    </time>
                    <span className="fl-log__kind">{kind === "validate" ? result : kind}</span>
                    <p>
                      <span className="mb-0.5 flex items-center gap-1.5">
                        <ActorBadge kind={a.actorKind} />
                        <code className="truncate font-mono text-[11px] text-ink-muted">{a.tool}</code>
                      </span>
                      {a.summary}
                    </p>
                  </li>
                );
              })}
            </ol>
          </Tabs.Content>
        </Tabs.Root>
      </details>
      <button type="button" onClick={onClose} className="fl-btn fl-btn--ghost fl-btn--sm self-end" aria-label="Hide Agent thinking">
        <X aria-hidden /> Hide
      </button>
    </aside>
  );
}
