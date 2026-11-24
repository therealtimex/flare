"use client";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { formatRate, MIN_SAMPLE } from "@/lib/client/format";
import { useAnalytics, useProduct } from "@/lib/client/hooks";
import { STAGE_LABELS } from "@/lib/types";
import type { Analytics } from "@/lib/types";

type Conv = Analytics["byTier"][number];

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="px-6 pb-12">
      <div className="pb-3">
        <h3 className="title">{title}</h3>
        {note && <p className="body-sm text-ink-muted">{note}</p>}
      </div>
      <div className="fl-grid-wrap">{children}</div>
    </section>
  );
}

const n = (v: number) => v.toLocaleString();

function ConversionTable({ rows, label, keyOf }: { rows: Conv[] | Analytics["byIndustry"]; label: string; keyOf: (r: Conv & { industry?: string }) => string }) {
  return (
    <table className="fl-grid">
      <thead>
        <tr>
          <th>{label}</th>
          <th className="is-num">Leads</th>
          <th className="is-num">Contacted</th>
          <th className="is-num">Replied</th>
          <th className="is-num">Meetings</th>
          <th className="is-num">Won</th>
          <th className="is-num">Reply rate</th>
          <th className="is-num">Win rate</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={8} className="text-center text-ink-muted">
              No leads yet.
            </td>
          </tr>
        )}
        {(rows as (Conv & { industry?: string })[]).map((r) => (
          <tr key={keyOf(r)}>
            <td>{keyOf(r)}</td>
            <td className="is-num">{n(r.leads)}</td>
            <td className="is-num">{n(r.contacted)}</td>
            <td className="is-num">{n(r.replied)}</td>
            <td className="is-num">{n(r.meetingBooked)}</td>
            <td className="is-num">{n(r.won)}</td>
            <td className="is-num" title="replied / contacted">
              {formatRate(r.replyRate, r.contacted)}
            </td>
            <td className="is-num" title="won / leads">
              {formatRate(r.winRate, r.leads)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function AnalyticsView() {
  const { data: product } = useProduct();
  const { data: a, error } = useAnalytics(product?.id);

  if (error) return <p className="body-sm p-6 text-negative">Analytics unavailable: {error}</p>;
  if (!a) return <p className="body-sm p-6 text-ink-muted">Loading analytics…</p>;

  if (a.totals.leads === 0) {
    return (
      <div>
        <PageHeader kicker="Analytics" title="No leads to measure yet" lede="Conversion, attribution and A/B results appear once the agent has matched leads." />
        <p className="body-sm px-6 text-ink-muted">
          Start a run from{" "}
          <Link href="/intake" className="underline underline-offset-2">
            Intake
          </Link>
          .
        </p>
      </div>
    );
  }

  const top = Math.max(1, ...a.funnel.map((f) => f.reached));
  const variantsSmall = a.byVariant.every((v) => v.leads < MIN_SAMPLE);
  const moves = a.attribution.stageMovesBy;
  const sourced = a.attribution.leadsSourcedBy;
  const fx = a.credits.flexprice;

  return (
    <div className="pb-8" data-testid="analytics">
      <PageHeader
        kicker="Analytics"
        title={`${formatRate(a.overallConversion)} of matched leads closed won`}
        lede={`${n(a.totals.leads)} leads, ${n(a.closedLost)} closed lost. Rates use leads that reached each stage.`}
      />

      <Section title="Funnel" note="Reached = leads that ever got to the stage. To next = share that moved on to the next stage.">
        <table className="fl-grid" data-testid="funnel">
          <thead>
            <tr>
              <th>Stage</th>
              <th className="is-num">Now</th>
              <th className="is-num">Reached</th>
              <th className="w-1/3" aria-hidden />
              <th className="is-num">To next</th>
            </tr>
          </thead>
          <tbody>
            {a.funnel.map((f) => (
              <tr key={f.stage} data-stage={f.stage}>
                <td>{STAGE_LABELS[f.stage]}</td>
                <td className="is-num">{n(f.count)}</td>
                <td className="is-num">{n(f.reached)}</td>
                <td>
                  <div className="h-2 rounded-full bg-surface-2" role="meter" aria-label={`${STAGE_LABELS[f.stage]} reached`} aria-valuemin={0} aria-valuemax={top} aria-valuenow={f.reached}>
                    <div className="h-2 rounded-full bg-ink-muted" style={{ width: `${(f.reached / top) * 100}%` }} />
                  </div>
                </td>
                <td className="is-num">{f.toNext == null ? "—" : formatRate(f.toNext, f.reached)}</td>
              </tr>
            ))}
            <tr className="text-ink-muted">
              <td>{STAGE_LABELS.closed_lost} (exit)</td>
              <td className="is-num">{n(a.closedLost)}</td>
              <td className="is-num">—</td>
              <td />
              <td className="is-num">—</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="Agent vs rep" note="Who did the work: leads sourced, stage moves made, and drafts approved.">
        <table className="fl-grid" data-testid="attribution">
          <thead>
            <tr>
              <th>Measure</th>
              <th className="is-num">Agent</th>
              <th className="is-num">Rep</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Leads by owner</td>
              <td className="is-num">{n(sourced.agent)}</td>
              <td className="is-num">{n(sourced.rep)}</td>
            </tr>
            <tr>
              <td>Stage moves</td>
              <td className="is-num">{n(moves.agent)}</td>
              <td className="is-num">{n(moves.rep)}</td>
            </tr>
            <tr>
              <td>Outreach approvals (human only)</td>
              <td className="is-num">—</td>
              <td className="is-num">{n(a.attribution.approvalsBy.rep)}</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="By tier" note="Reply rate = replied / contacted. Win rate = won / leads.">
        <ConversionTable rows={a.byTier} label="Tier" keyOf={(r) => `Tier ${r.tier}`} />
      </Section>

      <Section title="By industry">
        <ConversionTable rows={a.byIndustry} label="Industry" keyOf={(r) => r.industry ?? "Unknown"} />
      </Section>

      <Section
        title="Message variants"
        note={
          variantsSmall
            ? `Sample too small to call a winner (fewer than ${MIN_SAMPLE} leads per variant).`
            : "Reply rate = replied leads / leads with an approved or sent message of that variant."
        }
      >
        <table className="fl-grid" data-testid="variants">
          <thead>
            <tr>
              <th>Variant</th>
              <th className="is-num">Drafted</th>
              <th className="is-num">Approved</th>
              <th className="is-num">Rejected</th>
              <th className="is-num">Sent</th>
              <th className="is-num">Leads (n)</th>
              <th className="is-num">Replied</th>
              <th className="is-num">Reply rate</th>
            </tr>
          </thead>
          <tbody>
            {a.byVariant.map((v) => (
              <tr key={v.variant}>
                <td>Variant {v.variant}</td>
                <td className="is-num">{n(v.drafted)}</td>
                <td className="is-num">{n(v.approved)}</td>
                <td className="is-num">{n(v.rejected)}</td>
                <td className="is-num">{n(v.sent)}</td>
                <td className="is-num">{n(v.leads)}</td>
                <td className="is-num">{n(v.replied)}</td>
                <td className="is-num">{formatRate(v.replyRate, v.leads)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Credits and metering" note={fx.configured ? "Usage events are sent to Flexprice." : "Flexprice: not configured. Usage is metered locally."}>
        <table className="fl-grid" data-testid="credits">
          <thead>
            <tr>
              <th>Measure</th>
              <th className="is-num">Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Credit balance</td>
              <td className="is-num">{n(a.credits.balance)}</td>
            </tr>
            {Object.entries(a.credits.unitsUsed).map(([k, v]) => (
              <tr key={k}>
                <td>
                  Units used · <span className="label text-ink-muted">{k.replace("_", " ")}</span>
                </td>
                <td className="is-num">{n(v)}</td>
              </tr>
            ))}
            <tr>
              <td>
                Flexprice events <span className="fl-badge fl-badge--positive">Sent</span>
              </td>
              <td className="is-num">{n(fx.sent)}</td>
            </tr>
            <tr>
              <td>
                Flexprice events <span className="fl-badge fl-badge--negative">Failed</span>
              </td>
              <td className="is-num">{n(fx.failed)}</td>
            </tr>
            <tr>
              <td>
                Flexprice events <span className="fl-badge fl-badge--caution">Pending</span>
              </td>
              <td className="is-num">{n(fx.pending)}</td>
            </tr>
            <tr>
              <td>
                Flexprice events <span className="fl-badge">Not configured</span>
              </td>
              <td className="is-num">{n(fx.notConfigured)}</td>
            </tr>
          </tbody>
        </table>
      </Section>
    </div>
  );
}
