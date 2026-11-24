"use client";
import Link from "next/link";
import { Check, Pencil, RotateCcw, X } from "lucide-react";
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

  if (error) return <p className="body-sm p-6 text-negative">ICP unavailable: {error}</p>;
  if (loading || !product) return <p className="body-sm p-6 text-ink-muted">Loading ICP…</p>;
  if (!icp) {
    return (
      <div>
        <PageHeader kicker="Step 2 · ICP" title="Ideal customer profile (ICP)" />
        <p className="p-6 text-sm text-ink-muted">
          No ICP yet. Run the GTM agent from{" "}
          <Link href="/intake" className="text-flare-text underline-offset-2 hover:underline">
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
      <PageHeader
        kicker="Step 2 · ICP"
        title={`${icp.industries.length} industries, ${icp.personas.length} personas buy ${product.name}`}
        lede={`Ideal customer profile (ICP) inferred by the agent, updated ${formatRelativeTime(icp.updatedAt)}. ${icp.expansions.length} expansion segments wait for your decision.`}
      />

      <div className="px-6"><div className="fl-grid-wrap"><table className="fl-grid" data-testid="icp-fields">
        <thead>
          <tr>
            <th>Field</th>
            <th>Values</th>
            <th className="is-num">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {FIELDS.map(({ key, label }) => {
            const values = icp[key];
            const confidence = icp.confidence[key] ?? 0;
            return (
              <tr key={key} data-field={key}>
                <td className="font-medium">
                  {label}
                </td>
                <td className="py-1">
                  <div className="flex flex-wrap gap-1.5">
                    {values.length === 0 && <span className="text-ink-faint">—</span>}
                    {values.map((v) => (
                      <span key={v} className="fl-badge" style={{ paddingLeft: 8 }}>
                        {v}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="is-num">
                  <ConfidenceChip confidence={confidence} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table></div></div>

      <div className="flex items-end justify-between px-6 pb-3 pt-12">
        <div>
          <h3 className="title">Expansion segments</h3>
          <p className="body-sm text-ink-muted">Adjacent markets the agent found, with sources. You decide which ones it pursues.</p>
        </div>
        <span className="data text-ink-muted">
          {accepted}/{icp.expansions.length} accepted
        </span>
      </div>
      <div className="px-6 pb-8"><div className="fl-grid-wrap">
      <table className="fl-grid min-w-[52rem]" data-testid="icp-expansions">
        <thead>
          <tr>
            <th>Segment</th>
            <th className="min-w-[18rem]">Rationale</th>
            <th>Sources</th>
            <th>Status</th>
            <th className="w-px">Decision</th>
          </tr>
        </thead>
        <tbody>
          {icp.expansions.map((e) => (
            <ExpansionRow key={e.id} exp={e} productId={product.id} />
          ))}
        </tbody>
      </table>
      </div></div>
    </div>
  );
}

const btn = "fl-btn fl-btn--sm";

function ExpansionRow({ exp, productId }: { exp: Expansion; productId: number }) {
  const [editing, setEditing] = useState(false);
  const [segment, setSegment] = useState(exp.segment);
  const [rationale, setRationale] = useState(exp.rationale);
  const [busy, setBusy] = useState(false);

  async function decide(status: ExpansionStatus, patch?: { segment: string; rationale: string }) {
    setBusy(true);
    try {
      await decideExpansion(productId, exp.id, status, patch);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  const input =
    "w-full rounded-md border border-line bg-surface-0 px-2 py-1 text-sm focus:border-line-strong focus:outline-none";

  return (
    <tr
      className={cn("align-top", exp.status === "dismissed" && "opacity-60")}
      data-testid="expansion-row"
      data-status={exp.status}
    >
      <td className="py-2 font-medium" style={{ whiteSpace: "normal" }}>
        {editing ? <input className={input} value={segment} onChange={(e) => setSegment(e.target.value)} aria-label="Segment" /> : exp.segment}
      </td>
      <td className="py-2 text-ink-muted" style={{ whiteSpace: "normal" }}>
        {editing ? (
          <textarea className={cn(input, "min-h-16")} value={rationale} onChange={(e) => setRationale(e.target.value)} aria-label="Rationale" />
        ) : (
          exp.rationale
        )}
      </td>
      <td className="py-2">
        <ul className="grid gap-1">
          {exp.sources.map((s, i) => (
            <li key={s.url}>
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                title={s.quote ?? s.url}
                className="fl-cite"
              >
                <b>{i + 1}</b>
                {sourceLabel(s.url)}
              </a>
            </li>
          ))}
          {exp.sources.length === 0 && <li><span className="fl-badge fl-badge--caution">No source</span></li>}
        </ul>
      </td>
      <td className="py-2">
        <StatusPill status={exp.status} />
      </td>
      <td className="w-px py-2">
        <div className="flex justify-end gap-1">
          {editing ? (
            <>
              <button
                type="button"
                disabled={busy || !segment.trim()}
                onClick={() => decide("accepted", { segment: segment.trim(), rationale: rationale.trim() })}
                className={cn(btn, "fl-btn--secondary")}
              >
                <Check aria-hidden /> Save &amp; accept
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setSegment(exp.segment);
                  setRationale(exp.rationale);
                }}
                className={cn(btn, "fl-btn--ghost")}
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
                className={cn(btn, "fl-btn--secondary")}
              >
                <Check aria-hidden /> Accept
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setEditing(true)}
                className={cn(btn, "fl-btn--secondary")}
              >
                <Pencil aria-hidden /> Adjust
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => decide("dismissed")}
                className={cn(btn, "fl-btn--ghost")}
              >
                <X aria-hidden /> Dismiss
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => decide("suggested")}
              className={cn(btn, "fl-btn--ghost")}
            >
              <RotateCcw aria-hidden /> Undo
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function StatusPill({ status }: { status: ExpansionStatus }) {
  const map = { accepted: ["fl-badge--positive", "Accepted"], suggested: ["fl-badge--caution", "Awaiting decision"], dismissed: ["", "Dismissed"] } as const;
  const [cls, word] = map[status];
  return <span className={cn("fl-badge", cls)}>{word}</span>;
}
