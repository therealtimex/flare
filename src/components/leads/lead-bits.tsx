"use client";
// Thin React wrappers over Jay's fl- classes for lead rows and cards:
// ScoreTier, EnrichmentCell, Citation (in a popover) and the LinkedIn link.
import { Popover } from "radix-ui";
import { Link as LinkIcon } from "lucide-react";
import { sourceLabel } from "@/lib/client/format";
import type { EmailStatus, Source, Tier } from "@/lib/types";

/** Composite score 0–100 + tier chip (A solid, B outlined, C dashed). */
export function ScoreTier({ score, tier }: { score: number; tier: Tier }) {
  return (
    <span className="fl-score" data-tier={tier}>
      <span className="fl-score__num">{Math.round(score)}</span>
      <span className={`fl-tier fl-tier--${tier.toLowerCase()}`}>Tier {tier}</span>
    </span>
  );
}

const EMAIL_WORD: Record<EmailStatus, string> = { verified: "Verified", pattern: "Pattern", unverified: "Not found" };

/** Email enrichment (EnrichmentCell). The title carries the address and its source. */
export function EmailCell({ email, status, sourceUrl }: { email: string | null; status: EmailStatus; sourceUrl?: string }) {
  return (
    <span className="fl-enrich" title={[email ?? "No email found", sourceUrl ? `Source: ${sourceUrl}` : null].filter(Boolean).join("\n")}>
      {status === "unverified" ? (
        <span className="fl-badge" data-email-status={status}>
          {EMAIL_WORD[status]}
        </span>
      ) : (
        <span className="fl-verify" data-status={status} data-email-status={status}>
          {EMAIL_WORD[status]}
        </span>
      )}
    </span>
  );
}

export function LinkedInLink({ url }: { url: string | null }) {
  if (!url) return <span className="text-ink-faint">—</span>;
  return (
    <a className="fl-cite" href={url} target="_blank" rel="noreferrer" title={url}>
      <LinkIcon className="size-3" aria-hidden />
      LinkedIn
    </a>
  );
}

const ENTITY_ORDER = ["person", "account", "signal"];

/** Numbered fl-cite chips in a popover; the trigger shows the source count. */
export function CitationsPopover({ sources, label }: { sources: Source[]; label?: string }) {
  const sorted = [...sources].sort((a, b) => ENTITY_ORDER.indexOf(a.entityType) - ENTITY_ORDER.indexOf(b.entityType));
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" className="fl-cite" aria-label={`${sources.length} sources${label ? ` for ${label}` : ""}`} data-testid="citations-trigger">
          <b>{sources.length}</b>
          {sources.length === 1 ? "source" : "sources"}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 max-h-80 w-96 overflow-y-auto rounded-lg border border-line bg-surface-1 p-3"
          style={{ boxShadow: "var(--shadow-overlay)" }}
          data-testid="citations-popover"
        >
          <p className="label pb-2 text-ink-muted">Sources{label ? ` · ${label}` : ""}</p>
          {sorted.length === 0 && <p className="body-sm text-negative">No sources. This record should be in quarantine.</p>}
          <ol className="grid gap-2">
            {sorted.map((s, i) => (
              <li key={s.id} className="body-sm">
                <a className="fl-cite" href={s.url} target="_blank" rel="noreferrer">
                  <b>{i + 1}</b>
                  {sourceLabel(s.url)}
                </a>{" "}
                <span className="label text-ink-faint">{s.entityType}</span>
                {s.quote && <p className="mt-1 text-ink-muted">“{s.quote}”</p>}
              </li>
            ))}
          </ol>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
