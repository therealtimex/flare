"use client";
import { Check, Linkedin, Mail, Save, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ScoreTier } from "@/components/leads/lead-bits";
import { PageHeader } from "@/components/page-header";
import { decideMessage, editMessage } from "@/lib/client/api";
import { formatRelativeTime } from "@/lib/client/format";
import { useOutbox } from "@/lib/client/hooks";
import type { MessageStatus, OutboxItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type Filter = "draft" | "approved" | "rejected" | "all";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "draft", label: "Needs approval" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

export function OutboxView() {
  const { data, error } = useOutbox();
  const [filter, setFilter] = useState<Filter>("draft");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const items = (data ?? [])
    .filter((m) => filter === "all" || m.status === filter)
    .sort((a, b) => a.person.name.localeCompare(b.person.name) || a.step - b.step || a.variant.localeCompare(b.variant));
  const selected = items.find((m) => m.id === selectedId) ?? items[0] ?? null;
  const count = (s: Filter) => (data ?? []).filter((m) => s === "all" || m.status === s).length;

  if (error) return <p className="body-sm p-6 text-negative">Outbox unavailable: {error}</p>;

  return (
    <div className="flex h-full flex-col">
      <PageHeader kicker="Step 4 · Outreach" title={data ? `${count("draft")} drafts wait for your approval` : "Outbox"} lede="Edit any draft, then approve or reject it. Nothing leaves Flare without your approval.">
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-muted">
          <ShieldCheck className="size-3.5 text-positive" aria-hidden /> Nothing leaves without your Approve
        </span>
      </PageHeader>
      <div className="flex items-center gap-1 border-b border-line px-6 pb-3" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={cn("fl-btn fl-btn--sm", filter === f.key ? "fl-btn--secondary" : "fl-btn--ghost")}
          >
            {f.label} <span className="tabular-nums">{count(f.key)}</span>
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
        <ul className="overflow-y-auto border-r border-line" data-testid="outbox-list">
          {data && items.length === 0 && <li className="px-4 py-6 text-sm text-ink-muted">Nothing here. Drafts from the agent show up under Needs approval.</li>}
          {items.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => setSelectedId(m.id)}
                aria-current={selected?.id === m.id}
                className={cn(
                  "w-full border-b border-line px-4 py-2 text-left",
                  selected?.id === m.id ? "bg-surface-1" : "hover:bg-surface-1/50",
                )}
                data-testid="outbox-item"
              >
                <div className="flex items-center gap-2">
                  <ChannelIcon channel={m.channel} />
                  <span className="truncate text-sm font-medium">{m.person.name}</span>
                  <span className="ml-auto font-mono text-[10px] text-ink-muted">
                    S{m.step}·{m.variant}
                  </span>
                  <StatusPill status={m.status} />
                </div>
                <div className="mt-0.5 truncate pl-5 text-xs text-ink-muted">{m.subject ?? m.body.split("\n")[0]}</div>
              </button>
            </li>
          ))}
        </ul>
        <div className="min-w-0 overflow-y-auto">{selected ? <MessageEditor key={selected.id + selected.status} item={selected} /> : null}</div>
      </div>
    </div>
  );
}

function ChannelIcon({ channel }: { channel: OutboxItem["channel"] }) {
  const Icon = channel === "email" ? Mail : Linkedin;
  return <Icon className="size-3.5 shrink-0 text-ink-muted" aria-label={channel} />;
}

const STATUS: Record<MessageStatus, [string, string]> = {
  draft: ["fl-badge--caution", "Awaiting approval"],
  approved: ["fl-badge--positive", "Approved"],
  rejected: ["fl-badge--negative", "Rejected"],
  sent: ["fl-badge--info", "Sent"],
};

function StatusPill({ status }: { status: MessageStatus }) {
  const [cls, word] = STATUS[status];
  return (
    <span className={cn("fl-badge", cls)} data-status={status}>
      {word}
    </span>
  );
}

const fieldCls =
  "w-full rounded-md border border-line bg-surface-1 px-3 py-2 text-sm placeholder:text-ink-faint focus:border-line-strong focus:outline-none disabled:opacity-70";

function MessageEditor({ item }: { item: OutboxItem }) {
  const [subject, setSubject] = useState(item.subject ?? "");
  const [body, setBody] = useState(item.body);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => setNow(new Date()), [item.decidedAt]);

  const editable = item.status === "draft";
  const patch = { subject: item.channel === "email" ? subject.trim() || null : null, body };
  const dirty = (item.subject ?? "") !== subject || item.body !== body;

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="p-6" data-testid="message-editor" data-message-id={item.id}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="title">{item.person.name}</h3>
            <ScoreTier score={item.lead.fitScore} tier={item.lead.tier} />
          </div>
          <p className="mt-0.5 text-xs text-ink-muted">
            {[item.person.title, item.account?.name].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-ink-muted">
          <ChannelIcon channel={item.channel} /> {item.channel} · step {item.step} · variant {item.variant}
          <StatusPill status={item.status} />
        </div>
      </header>

      {item.signals.length > 0 && (
        <div className="mt-4">
          <p className="label text-ink-muted">Personalized on</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {item.signals.map((s) => (
              <li key={s.id} className="rounded-sm border border-line bg-surface-1 px-2 py-0.5 text-xs">
                <span className="label text-ink-muted">{s.kind.replace("_", " ")}</span> {s.summary}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 grid gap-3">
        {item.channel === "email" && (
          <label className="grid gap-1">
            <span className="text-xs text-ink-muted">Subject</span>
            <input className={fieldCls} value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!editable} name="subject" />
          </label>
        )}
        <label className="grid gap-1">
          <span className="text-xs text-ink-muted">Body</span>
          <textarea
            className={cn(fieldCls, "min-h-56 resize-y font-sans leading-relaxed")}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={!editable}
            name="body"
          />
        </label>
      </div>

      {err && <p className="mt-3 text-sm text-negative" role="alert">{err}</p>}

      {editable ? (
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            disabled={busy || !body.trim()}
            onClick={() => act(() => decideMessage(item.id, "approved", patch))}
            className="fl-btn fl-btn--primary"
            data-testid="approve"
          >
            <Check aria-hidden /> {dirty ? "Approve with edits" : "Approve draft"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => act(() => decideMessage(item.id, "rejected"))}
            className="fl-btn fl-btn--ghost"
            data-testid="reject"
          >
            <X aria-hidden /> Reject draft
          </button>
          {dirty && (
            <button
              type="button"
              disabled={busy || !body.trim()}
              onClick={() => act(() => editMessage(item.id, patch))}
              className="fl-btn fl-btn--secondary"
            >
              <Save aria-hidden /> Save draft
            </button>
          )}
          <span className="ml-auto text-xs text-ink-faint">Approving queues the message. It is not sent from here.</span>
        </div>
      ) : (
        <p className="mt-4 rounded-sm border border-line bg-surface-1 px-3 py-2 text-xs text-ink-muted" data-testid="decision-note">
          {item.status === "approved" ? "Approved" : item.status === "rejected" ? "Rejected" : "Sent"} by {item.decidedBy ?? "rep"}
          {item.decidedAt ? ` ${formatRelativeTime(item.decidedAt, now)}` : ""}.
          {item.status === "approved" && " Queued for sending; nothing has been sent."}
        </p>
      )}
    </article>
  );
}
