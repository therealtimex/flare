"use client";
import Link from "next/link";
import { Check, ExternalLink, Pencil, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { ConfidenceChip } from "@/components/confidence-chip";
import { PageHeader } from "@/components/page-header";
import { decideExpansion } from "@/lib/client/api";
import { formatRelativeTime, sourceLabel } from "@/lib/client/format";
import { useIcp, useProduct } from "@/lib/client/hooks";
import type { Expansion, ExpansionStatus, IcpField } from "@/lib/types";
import { cn } from "@/lib/utils";

const FIELDS: { key: IcpField; label: string }[] = [
  { key: "industries", label: "Industries" },
  { key: "sizeBands", label: "Size bands" },
  { key: "personas", label: "Personas" },
  { key: "triggers", label: "Buying triggers" },
];

export function IcpView() {
  const { data: product } = useProduct();
  const { data: icp, loading, error } = useIcp(product?.id);

  if (error) return <p className="p-6 font-mono text-xs text-danger">ICP unavailable: {error}</p>;
  if (loading || !product) return <p className="p-6 font-mono text-xs text-muted">Loading ICP…</p>;
  if (!icp) {
    return (
      <div>
        <PageHeader kicker="02 · ICP" title="Ideal customer profile" />
        <p className="p-6 text-sm text-muted">
          No ICP yet. Run the GTM agent from{" "}
          <Link href="/intake" className="text-accent underline-offset-2 hover:underline">
            Intake
          </Link>{" "}
          and it will infer one here.
        </p>
      </div>
    );
  }

  const accepted = icp.expansions.filter((e) => e.status === "accepted").length;

  return (
    <div>
      <PageHeader kicker="02 · ICP" title={`Who buys ${product.name}`}>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
          inferred by agent · updated {formatRelativeTime(icp.updatedAt)}
        </span>
      </PageHeader>

      <table className="w-full border-collapse text-sm" data-testid="icp-fields">
        <thead>
          <tr className="border-b border-border-subtle text-left font-mono text-[10px] uppercase tracking-wider text-muted">
            <th className="w-40 px-6 py-2 font-normal">Field</th>
            <th className="px-3 py-2 font-normal">Values</th>
            <th className="w-32 px-6 py-2 text-right font-normal">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {FIELDS.map(({ key, label }) => {
            const values = icp[key];
            const confidence = icp.confidence[key] ?? 0;
            return (
              <tr key={key} className="border-b border-border-subtle align-top hover:bg-surface-raised/40" data-field={key}>
                <th scope="row" className="px-6 py-2.5 text-left font-medium">
                  {label}
                </th>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1.5">
                    {values.length === 0 && <span className="text-muted/60">—</span>}
                    {values.map((v) => (
                      <span key={v} className="rounded-sm border border-border-subtle bg-surface-raised px-2 py-0.5 text-xs">
                        {v}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-2 text-right">
                  <ConfidenceChip confidence={confidence} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="flex items-end justify-between border-b border-border-subtle px-6 pb-2 pt-8">
        <div>
          <h3 className="font-serif text-xl">Expansion segments</h3>
          <p className="mt-0.5 text-xs text-muted">Adjacent markets the agent found, with sources. You decide which ones it pursues.</p>
        </div>
        <span className="font-mono text-xs tabular-nums text-muted">
          {accepted}/{icp.expansions.length} accepted
        </span>
      </div>
      <div className="overflow-x-auto">
      <table className="w-full min-w-[56rem] border-collapse text-sm" data-testid="icp-expansions">
        <thead>
          <tr className="border-b border-border-subtle text-left font-mono text-[10px] uppercase tracking-wider text-muted">
            <th className="w-52 px-6 py-2 font-normal">Segment</th>
            <th className="min-w-[18rem] px-3 py-2 font-normal">Rationale</th>
            <th className="w-36 px-3 py-2 font-normal">Sources</th>
            <th className="w-24 px-3 py-2 font-normal">Status</th>
            <th className="w-px whitespace-nowrap px-6 py-2 text-right font-normal">Decision</th>
          </tr>
        </thead>
        <tbody>
          {icp.expansions.map((e) => (
            <ExpansionRow key={e.id} exp={e} />
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

const btn = "inline-flex items-center gap-1 rounded-sm border px-2 py-1 font-mono text-[11px] disabled:opacity-40";

function ExpansionRow({ exp }: { exp: Expansion }) {
  const [editing, setEditing] = useState(false);
  const [segment, setSegment] = useState(exp.segment);
  const [rationale, setRationale] = useState(exp.rationale);
  const [busy, setBusy] = useState(false);

  async function decide(status: ExpansionStatus, patch?: { segment: string; rationale: string }) {
    setBusy(true);
    try {
      await decideExpansion(exp.id, status, patch);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  const input =
    "w-full rounded-sm border border-border-subtle bg-surface-raised px-2 py-1 text-sm focus:border-accent focus:outline-none";

  return (
    <tr
      className={cn("border-b border-border-subtle align-top", exp.status === "dismissed" && "opacity-45")}
      data-testid="expansion-row"
      data-status={exp.status}
    >
      <td className="px-6 py-2.5 font-medium">
        {editing ? <input className={input} value={segment} onChange={(e) => setSegment(e.target.value)} aria-label="Segment" /> : exp.segment}
      </td>
      <td className="px-3 py-2.5 leading-snug text-muted">
        {editing ? (
          <textarea className={cn(input, "min-h-16")} value={rationale} onChange={(e) => setRationale(e.target.value)} aria-label="Rationale" />
        ) : (
          exp.rationale
        )}
      </td>
      <td className="px-3 py-2.5">
        <ul className="space-y-0.5">
          {exp.sources.map((s) => (
            <li key={s.url}>
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                title={s.quote ?? s.url}
                className="inline-flex items-center gap-1 font-mono text-[11px] text-muted hover:underline"
              >
                <ExternalLink className="size-3" aria-hidden />
                {sourceLabel(s.url)}
              </a>
            </li>
          ))}
          {exp.sources.length === 0 && <li className="font-mono text-[11px] text-warning">no source</li>}
        </ul>
      </td>
      <td className="px-3 py-2.5">
        <StatusPill status={exp.status} />
      </td>
      <td className="w-px whitespace-nowrap px-6 py-2">
        <div className="flex justify-end gap-1">
          {editing ? (
            <>
              <button
                type="button"
                disabled={busy || !segment.trim()}
                onClick={() => decide("accepted", { segment: segment.trim(), rationale: rationale.trim() })}
                className={cn(btn, "border-success/50 text-success hover:bg-success/10")}
              >
                <Check className="size-3" aria-hidden /> Save &amp; accept
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setSegment(exp.segment);
                  setRationale(exp.rationale);
                }}
                className={cn(btn, "border-border-subtle text-muted hover:text-accent")}
              >
                Cancel
              </button>
            </>
          ) : exp.status === "suggested" ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => decide("accepted")}
                className={cn(btn, "border-success/50 text-success hover:bg-success/10")}
              >
                <Check className="size-3" aria-hidden /> Accept
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setEditing(true)}
                className={cn(btn, "border-border-subtle text-current hover:text-accent")}
              >
                <Pencil className="size-3" aria-hidden /> Adjust
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => decide("dismissed")}
                className={cn(btn, "border-border-subtle text-muted hover:border-danger/50 hover:text-danger")}
              >
                <X className="size-3" aria-hidden /> Dismiss
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => decide("suggested")}
              className={cn(btn, "border-border-subtle text-muted hover:text-accent")}
            >
              <RotateCcw className="size-3" aria-hidden /> Undo
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function StatusPill({ status }: { status: ExpansionStatus }) {
  return (
    <span
      className={cn(
        "rounded-sm px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider",
        status === "accepted" && "bg-success/15 text-success",
        status === "suggested" && "bg-border-subtle",
        status === "dismissed" && "bg-surface-raised text-muted/60 line-through",
      )}
    >
      {status}
    </span>
  );
}
