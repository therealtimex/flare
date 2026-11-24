"use client";
// Small feature components for lead rows/cards: fit bar, tier chip, enrichment
// badges and the citations popover.
import { Popover } from "radix-ui";
import { AtSign, ExternalLink, Link2, Quote } from "lucide-react";
import { sourceLabel } from "@/lib/client/format";
import type { EmailStatus, LeadView, Source, Tier } from "@/lib/types";
import { cn } from "@/lib/utils";

export function FitBar({ score }: { score: number }) {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  return (
    <div className="flex items-center gap-2" title={`Fit ${s}/100`}>
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-border-subtle" role="meter" aria-label="Fit score" aria-valuemin={0} aria-valuemax={100} aria-valuenow={s}>
        <div
          className={cn("h-full rounded-full", s >= 80 ? "bg-accent" : s >= 60 ? "bg-warning" : "bg-muted/60")}
          style={{ width: `${s}%` }}
        />
      </div>
      <span className="w-6 font-mono text-xs tabular-nums">{s}</span>
    </div>
  );
}

export function TierChip({ tier }: { tier: Tier }) {
  return (
    <span
      className={cn(
        "inline-flex size-5 items-center justify-center rounded-sm font-mono text-[11px] font-semibold",
        tier === "A" && "bg-accent text-surface",
        tier === "B" && "border border-accent/60 text-accent",
        tier === "C" && "border border-border-subtle text-muted",
      )}
      data-tier={tier}
      title={`Tier ${tier}`}
    >
      {tier}
    </span>
  );
}

const EMAIL_LABEL: Record<EmailStatus, string> = { verified: "verified", pattern: "pattern", unverified: "none" };

/** Email enrichment badge; the title carries the source of the address or pattern. */
export function EmailBadge({ lead }: { lead: LeadView }) {
  const { email, emailStatus } = lead.person;
  const src = lead.sources.find((s) => s.entityType === "person" && s.quote && /@|email|pattern/i.test(s.quote));
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-1.5 py-px font-mono text-[10px] uppercase tracking-wider",
        emailStatus === "verified" && "bg-success/10 text-success",
        emailStatus === "pattern" && "bg-warning/10 text-warning",
        emailStatus === "unverified" && "bg-surface-raised text-muted/60",
      )}
      title={[email ?? "No email found", src ? `Source: ${src.url}` : null].filter(Boolean).join("\n")}
      data-email-status={emailStatus}
    >
      <AtSign className="size-3" aria-hidden />
      {EMAIL_LABEL[emailStatus]}
    </span>
  );
}

export function LinkedInBadge({ url }: { url: string | null }) {
  if (!url) {
    return <span className="inline-flex items-center gap-1 rounded-sm bg-surface-raised px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-muted/60">no in</span>;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded-sm bg-success/10 px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-success hover:underline"
      title={url}
    >
      <Link2 className="size-3" aria-hidden />
      in
    </a>
  );
}

const ENTITY_ORDER = ["person", "account", "signal"];

export function CitationsPopover({ sources, label }: { sources: Source[]; label?: string }) {
  const sorted = [...sources].sort((a, b) => ENTITY_ORDER.indexOf(a.entityType) - ENTITY_ORDER.indexOf(b.entityType));
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 rounded-sm border px-1.5 py-px font-mono text-[11px] tabular-nums",
            sources.length ? "border-border-subtle text-muted hover:border-accent hover:text-accent" : "border-danger/40 text-danger",
          )}
          aria-label={`${sources.length} citations${label ? ` for ${label}` : ""}`}
          data-testid="citations-trigger"
        >
          <Quote className="size-3" aria-hidden />
          {sources.length}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 max-h-80 w-96 overflow-y-auto rounded border border-border-subtle bg-surface-raised p-2 text-xs shadow-xl"
          data-testid="citations-popover"
        >
          <p className="px-1 pb-1.5 font-mono text-[10px] uppercase tracking-wider text-muted">Citations{label ? ` · ${label}` : ""}</p>
          {sorted.length === 0 && <p className="px-1 py-2 text-danger">No sources. This record should be in quarantine.</p>}
          <ul className="space-y-1">
            {sorted.map((s) => (
              <li key={s.id} className="rounded-sm border border-border-subtle bg-surface p-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted/60">{s.entityType}</span>
                  <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1 font-mono text-[11px] text-accent hover:underline">
                    <ExternalLink className="size-3 shrink-0" aria-hidden />
                    <span className="truncate">{sourceLabel(s.url)}</span>
                  </a>
                </div>
                {s.quote && <p className="mt-1 leading-snug text-muted">“{s.quote}”</p>}
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
