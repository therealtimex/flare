"use client";
import { GripVertical } from "lucide-react";
import { useState } from "react";
import { ActorBadge } from "@/components/actor-badge";
import { ScoreTier } from "@/components/leads/lead-bits";
import { PageHeader } from "@/components/page-header";
import { moveStage } from "@/lib/client/api";
import { formatRelativeTime } from "@/lib/client/format";
import { useActivity, useLeads } from "@/lib/client/hooks";
import { groupByStage, lastStageMovers } from "@/lib/client/pipeline";
import { STAGE_LABELS, STAGES } from "@/lib/types";
import type { ActorKind, LeadView, Stage } from "@/lib/types";
import { cn } from "@/lib/utils";

const DRAG_TYPE = "application/x-flare-lead";

export function PipelineView() {
  const { data, error } = useLeads();
  const leads = data?.leads;
  const { data: activity } = useActivity(3000);
  const [over, setOver] = useState<Stage | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (error) return <p className="body-sm p-6 text-negative">Pipeline unavailable: {error}</p>;
  const cols = groupByStage(leads ?? []);
  const movers = lastStageMovers(activity ?? []);

  async function move(leadId: number, to: Stage) {
    setErr(null);
    try {
      await moveStage(leadId, to);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  const total = leads?.length ?? 0;
  const won = cols.closed_won.length;

  return (
    <div className="flex h-full flex-col">
      <PageHeader kicker="Step 5 · Pipeline" title={data ? `${total} leads in pipeline, ${won} closed won` : "Pipeline"} lede="Drag a card or use its stage menu. Every move records whether the agent or a rep made it.">
        <span className="data text-ink-muted">
          {cols.meeting_booked.length} meetings booked
        </span>
      </PageHeader>
      {err && <p className="px-6 py-2 text-sm text-negative" role="alert">{err}</p>}
      <div className="grid min-h-0 flex-1 auto-cols-[minmax(9.5rem,1fr)] grid-flow-col overflow-x-auto" data-testid="pipeline-board">
        {STAGES.map((stage) => {
          const cards = cols[stage];
          const agentN = cards.filter((l) => l.ownerKind === "agent").length;
          return (
            <section
              key={stage}
              aria-label={STAGE_LABELS[stage]}
              data-stage={stage}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setOver(stage);
              }}
              onDragLeave={() => setOver((s) => (s === stage ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const id = Number(e.dataTransfer.getData(DRAG_TYPE));
                if (id) void move(id, stage);
              }}
              className={cn(
                "flex min-h-0 flex-col border-r border-line",
                over === stage && "bg-flare-wash outline outline-1 -outline-offset-1 outline-flare/50",
              )}
            >
              <header className="flex items-baseline justify-between border-b border-line px-3 py-2">
                <h3 className="label text-ink">{STAGE_LABELS[stage]}</h3>
                <span className="data text-ink-muted" title={`${agentN} agent-owned, ${cards.length - agentN} rep-owned`}>
                  {cards.length}
                  {cards.length > 0 && (
                    <span className="text-ink-faint">
                      {" "}
                      · {agentN}a/{cards.length - agentN}r
                    </span>
                  )}
                </span>
              </header>
              <ol className="flex-1 space-y-2 overflow-y-auto p-2">
                {cards.map((l) => (
                  <LeadCard key={l.id} lead={l} mover={movers.get(l.id)} onMove={move} />
                ))}
                {cards.length === 0 && <li className="rounded-lg border border-dashed border-line px-2 py-4 text-center text-xs text-ink-faint">Drop here</li>}
              </ol>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function LeadCard({
  lead,
  mover,
  onMove,
}: {
  lead: LeadView;
  mover?: { actorKind: ActorKind; at: string };
  onMove: (id: number, to: Stage) => void;
}) {
  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, String(lead.id));
        e.dataTransfer.effectAllowed = "move";
      }}
      className="fl-card cursor-grab text-xs active:cursor-grabbing"
      style={{ padding: "var(--space-3)", gap: "var(--space-2)", gridTemplateColumns: "minmax(0, 1fr)" }}
      data-testid="pipeline-card"
      data-lead-id={lead.id}
    >
      <div className="flex items-start gap-1.5">
        <GripVertical className="mt-0.5 size-3.5 shrink-0 text-ink-faint" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold">{lead.person.name}</p>
          <p className="fl-card__meta truncate">{[lead.person.title, lead.account?.name].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
      <ScoreTier score={lead.fitScore} tier={lead.tier} />
      <div className="flex items-center gap-1.5">
        <span className="label text-ink-faint">owner</span>
        <ActorBadge kind={lead.ownerKind} />
      </div>
      {mover && (
        <div className="flex items-center gap-1.5" data-testid="last-moved">
          <span className="label text-ink-faint">moved</span>
          <ActorBadge kind={mover.actorKind} />
          <span className="font-mono text-[10px] text-ink-faint">{formatRelativeTime(mover.at)}</span>
        </div>
      )}
      <label className="flex items-center gap-1.5">
        <span className="sr-only">Move {lead.person.name} to stage</span>
        <select
          value={lead.stage}
          onChange={(e) => onMove(lead.id, e.target.value as Stage)}
          className="w-full rounded-md border border-line bg-surface-0 px-1.5 py-1 text-xs text-ink-muted focus:border-line-strong focus:outline-none"
          data-testid="stage-select"
        >
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
    </li>
  );
}
