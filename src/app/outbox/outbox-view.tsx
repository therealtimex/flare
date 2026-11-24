"use client";
import { Check, Linkedin, Mail, Save, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { TierChip } from "@/components/leads/lead-bits";
import { PageHeader } from "@/components/page-header";
import { decideMessage, editMessage } from "@/lib/client/api";
import { formatRelativeTime } from "@/lib/client/format";
import { useOutbox } from "@/lib/client/hooks";
import type { OutboxItem } from "@/lib/client/views";
import type { MessageStatus } from "@/lib/types";
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
    .sort((a, b) => a.lead.person.name.localeCompare(b.lead.person.name) || a.step - b.step || a.variant.localeCompare(b.variant));
  const selected = items.find((m) => m.id === selectedId) ?? items[0] ?? null;
  const count = (s: Filter) => (data ?? []).filter((m) => s === "all" || m.status === s).length;

  if (error) return <p className="p-6 font-mono text-xs text-danger">Outbox unavailable: {error}</p>;

  return (
    <div className="flex h-full flex-col">
      <PageHeader kicker="04 · Outbox" title="Human approval queue">
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted">
          <ShieldCheck className="size-3.5 text-success" aria-hidden /> Nothing leaves without your Approve
        </span>
      </PageHeader>
      <div className="flex items-center gap-1 border-b border-border-subtle px-6 py-2 font-mono text-[11px]" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={cn("rounded-sm px-2 py-0.5", filter === f.key ? "bg-surface-raised text-accent" : "text-muted hover:text-accent")}
          >
            {f.label} <span className="tabular-nums">{count(f.key)}</span>
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
        <ul className="overflow-y-auto border-r border-border-subtle" data-testid="outbox-list">
          {data && items.length === 0 && <li className="px-4 py-6 text-sm text-muted">Nothing here. Drafts from the agent show up under Needs approval.</li>}
          {items.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => setSelectedId(m.id)}
                aria-current={selected?.id === m.id}
                className={cn(
                  "w-full border-b border-border-subtle px-4 py-2 text-left",
                  selected?.id === m.id ? "bg-surface-raised" : "hover:bg-surface-raised/50",
                )}
                data-testid="outbox-item"
              >
                <div className="flex items-center gap-2">
                  <ChannelIcon channel={m.channel} />
                  <span className="truncate text-sm font-medium">{m.lead.person.name}</span>
                  <span className="ml-auto font-mono text-[10px] text-muted">
                    S{m.step}·{m.variant}
                  </span>
                  <StatusPill status={m.status} />
                </div>
                <div className="mt-0.5 truncate pl-5 text-xs text-muted">{m.subject ?? m.body.split("\n")[0]}</div>
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
  return <Icon className="size-3.5 shrink-0 text-muted" aria-label={channel} />;
}

function StatusPill({ status }: { status: MessageStatus }) {
  return (
    <span
      className={cn(
        "rounded-sm px-1.5 py-px font-mono text-[10px] uppercase tracking-wider",
        status === "draft" && "bg-warning/10 text-warning",
        status === "approved" && "bg-success/10 text-success",
        status === "rejected" && "bg-surface-raised text-muted/60 line-through",
        status === "sent" && "bg-accent/15 text-accent",
      )}
      data-status={status}
    >
      {status}
    </span>
  );
}

const fieldCls =
  "w-full rounded-sm border border-border-subtle bg-surface-raised px-2.5 py-1.5 text-sm placeholder:text-muted/50 focus:border-accent focus:outline-none disabled:opacity-70";

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
            <TierChip tier={item.lead.tier} />
            <h3 className="font-serif text-xl">{item.lead.person.name}</h3>
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {[item.lead.person.title, item.lead.account?.name].filter(Boolean).join(" · ")} · fit {item.lead.fitScore}
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-muted">
          <ChannelIcon channel={item.channel} /> {item.channel} · step {item.step} · variant {item.variant}
          <StatusPill status={item.status} />
        </div>
      </header>

      {item.signalSummaries.length > 0 && (
        <div className="mt-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted">Personalized on</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {item.signalSummaries.map((s) => (
              <li key={s.id} className="rounded-sm border border-border-subtle bg-surface-raised px-2 py-0.5 text-xs">
                <span className="font-mono text-[10px] uppercase text-accent">{s.kind.replace("_", " ")}</span> {s.summary}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 grid gap-3">
        {item.channel === "email" && (
          <label className="grid gap-1">
            <span className="text-xs text-muted">Subject</span>
            <input className={fieldCls} value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!editable} name="subject" />
          </label>
        )}
        <label className="grid gap-1">
          <span className="text-xs text-muted">Body</span>
          <textarea
            className={cn(fieldCls, "min-h-56 resize-y font-sans leading-relaxed")}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={!editable}
            name="body"
          />
        </label>
      </div>

      {err && <p className="mt-3 text-sm text-danger" role="alert">{err}</p>}

      {editable ? (
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            disabled={busy || !body.trim()}
            onClick={() => act(() => decideMessage(item.id, "approved", patch))}
            className="inline-flex items-center gap-1.5 rounded-sm bg-accent px-3 py-1.5 font-mono text-xs font-semibold text-surface hover:brightness-110 disabled:opacity-40"
            data-testid="approve"
          >
            <Check className="size-3.5" aria-hidden /> {dirty ? "Approve with edits" : "Approve"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => act(() => decideMessage(item.id, "rejected"))}
            className="inline-flex items-center gap-1.5 rounded-sm border border-border-subtle px-3 py-1.5 font-mono text-xs text-muted hover:border-danger/50 hover:text-danger disabled:opacity-40"
            data-testid="reject"
          >
            <X className="size-3.5" aria-hidden /> Reject
          </button>
          {dirty && (
            <button
              type="button"
              disabled={busy || !body.trim()}
              onClick={() => act(() => editMessage(item.id, patch))}
              className="inline-flex items-center gap-1.5 rounded-sm border border-border-subtle px-3 py-1.5 font-mono text-xs text-muted hover:text-accent disabled:opacity-40"
            >
              <Save className="size-3.5" aria-hidden /> Save draft
            </button>
          )}
          <span className="ml-auto text-xs text-muted/60">Approving queues the message. It is not sent from here.</span>
        </div>
      ) : (
        <p className="mt-4 rounded-sm border border-border-subtle bg-surface-raised px-3 py-2 text-xs text-muted" data-testid="decision-note">
          {item.status === "approved" ? "Approved" : item.status === "rejected" ? "Rejected" : "Sent"} by {item.decidedBy ?? "rep"}
          {item.decidedAt ? ` ${formatRelativeTime(item.decidedAt, now)}` : ""}.
          {item.status === "approved" && " Queued for sending; nothing has been sent."}
        </p>
      )}
    </article>
  );
}
