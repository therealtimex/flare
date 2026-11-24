"use client";
import { ShieldAlert } from "lucide-react";
import { useState } from "react";
import { ActorBadge } from "@/components/actor-badge";
import { CitationsPopover, EmailCell, LinkedInLink, ScoreTier } from "@/components/leads/lead-bits";
import { PageHeader } from "@/components/page-header";
import { useLeads } from "@/lib/client/hooks";
import { STAGE_LABELS, TIERS } from "@/lib/types";
import type { LeadView, Tier } from "@/lib/types";
import { cn } from "@/lib/utils";

const emailSource = (l: LeadView) =>
  l.sources.find((s) => s.entityType === "person" && s.quote && /@|email|pattern/i.test(s.quote))?.url ??
  l.sources.find((s) => s.entityType === "person")?.url;

export function LeadsView() {
  const { data, error } = useLeads();
  const [tier, setTier] = useState<Tier | "all">("all");

  if (error) return <p className="body-sm p-6 text-negative">Leads unavailable: {error}</p>;
  const leads = [...(data?.leads ?? [])].sort((a, b) => b.fitScore - a.fitScore);
  const rows = leads.filter((l) => tier === "all" || l.tier === tier);
  const q = data?.quarantine;
  const tierA = leads.filter((l) => l.tier === "A").length;
  const sourceCount = new Set(leads.flatMap((l) => l.sources.map((s) => s.url))).size;

  return (
    <div className="pb-8">
      <PageHeader
        kicker="Step 3 · Leads"
        title={data ? `${leads.length} cited leads, ${tierA} Tier A` : "Leads"}
        lede={data ? `Found from ${sourceCount} public sources. Every person, account and signal links to where it came from.` : undefined}
      >
        <span
          className={cn("fl-badge", (data?.quarantineCount ?? 0) > 0 && "fl-badge--caution")}
          title="Records without a source URL are held by the citation gate and hidden from leads."
          data-testid="quarantine-count"
        >
          <ShieldAlert className="size-3.5" aria-hidden />
          {data?.quarantineCount ?? 0} quarantined
          {q && (
            <span className="text-ink-muted">
              ({q.accounts} accounts · {q.people} people · {q.signals} signals)
            </span>
          )}
        </span>
      </PageHeader>

      <div className="flex items-center gap-1 px-6 pb-3" role="group" aria-label="Filter by tier">
        {(["all", ...TIERS] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTier(t)}
            aria-pressed={tier === t}
            className={cn("fl-btn fl-btn--sm", tier === t ? "fl-btn--secondary" : "fl-btn--ghost")}
          >
            {t === "all" ? `All ${leads.length}` : `Tier ${t}`}
          </button>
        ))}
      </div>

      <div className="px-6">
        <div className="fl-grid-wrap">
          <table className="fl-grid" data-testid="leads-grid">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Sources</th>
                <th>Account</th>
                <th>Email</th>
                <th>LinkedIn</th>
                <th className="is-num">Score</th>
                <th>Owner</th>
                <th>Top signal</th>
              </tr>
            </thead>
            <tbody>
              {data && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-ink-muted">
                    No leads yet. Flare adds them as it finds cited people at matching accounts.
                  </td>
                </tr>
              )}
              {rows.map((l) => (
                <tr key={l.id} data-testid="lead-row" data-lead-id={l.id}>
                  <td>
                    {l.person.name} <span className="is-sub">· {l.person.title ?? "—"}</span>
                  </td>
                  <td>
                    <CitationsPopover sources={l.sources} label={l.person.name} />
                  </td>
                  <td>
                    {l.account?.name ?? "—"} <span className="is-sub">· {STAGE_LABELS[l.stage]}</span>
                  </td>
                  <td>
                    <EmailCell email={l.person.email} status={l.person.emailStatus} sourceUrl={emailSource(l)} />
                  </td>
                  <td>
                    <LinkedInLink url={l.person.linkedinUrl} />
                  </td>
                  <td className="is-num">
                    <ScoreTier score={l.fitScore} tier={l.tier} />
                  </td>
                  <td>
                    <ActorBadge kind={l.ownerKind} />
                  </td>
                  <td className="max-w-64 overflow-hidden text-ellipsis" title={l.signals.map((s) => `${s.kind}: ${s.summary}`).join("\n")}>
                    {l.signals[0] ? (
                      <>
                        <span className="label text-ink-muted">{l.signals[0].kind.replace("_", " ")}</span> {l.signals[0].summary}
                        {l.signals.length > 1 && <span className="is-sub"> +{l.signals.length - 1}</span>}
                      </>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
