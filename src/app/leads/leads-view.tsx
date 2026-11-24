"use client";
import { ShieldAlert } from "lucide-react";
import { useState } from "react";
import { ActorBadge } from "@/components/actor-badge";
import { CitationsPopover, EmailBadge, FitBar, LinkedInBadge, TierChip } from "@/components/leads/lead-bits";
import { PageHeader } from "@/components/page-header";
import { useLeads, useQuarantine } from "@/lib/client/hooks";
import { STAGE_LABELS, TIERS } from "@/lib/types";
import type { Tier } from "@/lib/types";
import { cn } from "@/lib/utils";

export function LeadsView() {
  const { data: leads, error } = useLeads();
  const { data: q } = useQuarantine();
  const [tier, setTier] = useState<Tier | "all">("all");

  if (error) return <p className="p-6 font-mono text-xs text-danger">Leads unavailable: {error}</p>;
  const rows = (leads ?? []).filter((l) => tier === "all" || l.tier === tier);
  const quarantined = q ? q.accounts + q.people + q.signals : 0;

  return (
    <div>
      <PageHeader kicker="03 · Leads" title="Cited leads">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 font-mono text-[11px]",
            quarantined ? "border-warning/40 text-warning" : "border-border-subtle text-muted",
          )}
          title="Records without a source URL are quarantined by the citation gate and hidden from leads."
          data-testid="quarantine-count"
        >
          <ShieldAlert className="size-3.5" aria-hidden />
          {quarantined} quarantined
          {q && (
            <span className="text-muted">
              ({q.accounts} acct · {q.people} people · {q.signals} signals)
            </span>
          )}
        </span>
      </PageHeader>

      <div className="flex items-center gap-1 border-b border-border-subtle px-6 py-2 font-mono text-[11px]" role="group" aria-label="Filter by tier">
        {(["all", ...TIERS] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTier(t)}
            aria-pressed={tier === t}
            className={cn("rounded-sm px-2 py-0.5 uppercase", tier === t ? "bg-surface-raised text-accent" : "text-muted hover:text-accent")}
          >
            {t === "all" ? `All ${leads?.length ?? ""}` : `Tier ${t}`}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[50rem] border-collapse text-[13px]" data-testid="leads-grid">
          <thead>
            <tr className="border-b border-border-subtle text-left font-mono text-[10px] uppercase tracking-wider text-muted">
              <th className="px-6 py-2 font-normal">Person</th>
              <th className="px-2 py-2 font-normal">Cited</th>
              <th className="px-3 py-2 font-normal">Account</th>
              <th className="px-3 py-2 font-normal">Fit</th>
              <th className="px-3 py-2 font-normal">Tier</th>
              <th className="px-3 py-2 font-normal">Enrichment</th>
              <th className="px-3 py-2 font-normal">Signals</th>
              <th className="px-3 py-2 font-normal">Stage · owner</th>
            </tr>
          </thead>
          <tbody>
            {leads && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-muted">
                  No leads yet. The agent adds them as it finds cited people at matching accounts.
                </td>
              </tr>
            )}
            {rows.map((l) => (
              <tr key={l.id} className="border-b border-border-subtle align-top hover:bg-surface-raised/50" data-testid="lead-row" data-lead-id={l.id}>
                <td className="px-6 py-2">
                  <div className="whitespace-nowrap font-medium">{l.person.name}</div>
                  <div className="text-xs text-muted">{l.person.title ?? "—"}</div>
                </td>
                <td className="px-2 py-2">
                  <CitationsPopover sources={l.sources} label={l.person.name} />
                </td>
                <td className="px-3 py-2">
                  <div className="whitespace-nowrap">{l.account?.name ?? "—"}</div>
                  <div className="font-mono text-[11px] text-muted">
                    {[l.account?.industry, l.account?.size].filter(Boolean).join(" · ")}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <FitBar score={l.fitScore} />
                </td>
                <td className="px-3 py-2">
                  <TierChip tier={l.tier} />
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1 whitespace-nowrap">
                    <EmailBadge lead={l} />
                    <LinkedInBadge url={l.person.linkedinUrl} />
                  </div>
                </td>
                <td className="min-w-40 px-3 py-2 text-xs text-muted">
                  {l.signals.length === 0 ? (
                    <span className="text-muted/60">—</span>
                  ) : (
                    <span className="line-clamp-2" title={l.signals.map((s) => `${s.kind}: ${s.summary}`).join("\n")}>
                      <span className="font-mono text-[10px] uppercase text-accent">{l.signals[0].kind.replace("_", " ")}</span>{" "}
                      {l.signals[0].summary}
                      {l.signals.length > 1 && <span className="text-muted/60"> +{l.signals.length - 1}</span>}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs">
                  <div>{STAGE_LABELS[l.stage]}</div>
                  <ActorBadge kind={l.ownerKind} className="mt-1" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
