"use client";
import { Check, Copy, Loader2, Play, Send, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { runGtmAgent, saveProduct } from "@/lib/client/api";
import { useProduct } from "@/lib/client/hooks";
import type { RunResult } from "@/lib/client/views";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

type ChatMsg = { from: "you" | "flare"; text: string };

/** Editable form state: Product with pricing/customers as plain text. */
type Form = Omit<Product, "pricing" | "customers"> & { pricing: string; customers: string };
const toForm = (p: Product): Form => ({ ...p, pricing: p.pricing ?? "", customers: p.customers.join("\n") });
const fromForm = (f: Form): Product => ({
  ...f,
  pricing: f.pricing.trim() || null,
  customers: f.customers
    .split(/[\n,]/)
    .map((c) => c.trim())
    .filter(Boolean),
});

const inputCls =
  "w-full rounded-sm border border-border-subtle bg-surface-raised px-2.5 py-1.5 text-sm placeholder:text-muted/50 focus:border-accent focus:outline-none";

export function IntakeView() {
  const { data: loaded } = useProduct();
  const [form, setForm] = useState<Form | null>(null);
  const [saved, setSaved] = useState(false);
  const [chat, setChat] = useState<ChatMsg[]>([
    { from: "flare", text: "Describe what you sell in plain words: who buys it, why now, what it replaces. I'll add it to the product brief." },
  ]);
  const [draft, setDraft] = useState("");
  const [run, setRun] = useState<{ state: "idle" | "running" } | { state: "done"; result: RunResult }>({ state: "idle" });
  const [copied, setCopied] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loaded && !form) setForm(toForm(loaded));
  }, [loaded, form]);
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ block: "nearest" });
  }, [chat]);

  if (!form) return <p className="p-6 font-mono text-xs text-muted">Loading product…</p>;

  const set = (k: "name" | "description" | "pricing" | "customers") => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [k]: e.target.value });
    setSaved(false);
  };

  function sendChat(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !form) return;
    setForm({ ...form, description: form.description ? `${form.description}\n${text}` : text });
    setSaved(false);
    setChat((c) => [...c, { from: "you", text }, { from: "flare", text: "Added to the description. Keep going, or run the GTM agent when ready." }]);
    setDraft("");
  }

  async function onSave() {
    if (!form) return;
    await saveProduct(fromForm(form));
    setSaved(true);
  }

  async function onRun() {
    if (!form) return;
    setRun({ state: "running" });
    setCopied(false);
    await saveProduct(fromForm(form));
    setSaved(true);
    const result = await runGtmAgent(form.id, window.location.origin);
    setRun({ state: "done", result });
  }

  async function copyBrief(brief: string) {
    try {
      await navigator.clipboard.writeText(brief);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const canRun = form.name.trim() !== "" && form.description.trim() !== "";

  return (
    <div>
      <PageHeader kicker="01 · Intake" title="What are you selling?">
        <button
          type="button"
          onClick={onSave}
          className="rounded-sm border border-border-subtle px-3 py-1.5 font-mono text-xs text-current hover:text-accent"
        >
          {saved ? "Saved" : "Save draft"}
        </button>
        <button
          type="button"
          onClick={onRun}
          disabled={!canRun || run.state === "running"}
          className="inline-flex items-center gap-1.5 rounded-sm bg-accent px-3 py-1.5 font-mono text-xs font-semibold text-surface hover:brightness-110 disabled:opacity-40"
          data-testid="run-gtm-agent"
        >
          {run.state === "running" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
          Run GTM agent
        </button>
      </PageHeader>

      {run.state === "done" && <RunBanner result={run.result} copied={copied} onCopy={copyBrief} />}

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="border-b border-border-subtle p-6 lg:border-b-0 lg:border-r" aria-label="Product brief">
          <h3 className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted">Product brief</h3>
          <div className="grid gap-3">
            <label className="grid gap-1">
              <span className="text-xs text-muted">Name</span>
              <input className={inputCls} value={form.name} onChange={set("name")} placeholder="Acme Billing" name="name" />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-muted">Description</span>
              <textarea
                className={cn(inputCls, "min-h-36 resize-y leading-relaxed")}
                value={form.description}
                onChange={set("description")}
                placeholder="What it does, who it's for"
                name="description"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-muted">Pricing</span>
              <input className={inputCls} value={form.pricing} onChange={set("pricing")} placeholder="$99/mo per seat" name="pricing" />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-muted">Current customers</span>
              <textarea
                className={cn(inputCls, "min-h-16 resize-y")}
                value={form.customers}
                onChange={set("customers")}
                placeholder="One per line: named customers or customer types"
                name="customers"
              />
            </label>
          </div>
        </section>

        <section className="flex min-h-96 flex-col p-6" aria-label="Describe in plain words">
          <h3 className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted">Describe in plain words</h3>
          <div className="flex-1 space-y-2 overflow-y-auto rounded-sm border border-border-subtle bg-surface-raised/40 p-3" data-testid="intake-chat">
            {chat.map((m, i) => (
              <div key={i} className={cn("flex", m.from === "you" ? "justify-end" : "justify-start")}>
                <p
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-md px-3 py-2 text-sm leading-snug",
                    m.from === "you" ? "bg-muted text-surface" : "bg-border-subtle",
                  )}
                >
                  {m.text}
                </p>
              </div>
            ))}
            <div ref={chatEnd} />
          </div>
          <form onSubmit={sendChat} className="mt-2 flex gap-2">
            <input
              className={inputCls}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. Our best customers just switched ERPs and drown in invoices…"
              aria-label="Describe your product"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="inline-flex items-center rounded-sm border border-border-subtle px-2.5 text-current hover:text-accent disabled:opacity-40"
              aria-label="Send"
            >
              <Send className="size-4" />
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

function RunBanner({ result, copied, onCopy }: { result: RunResult; copied: boolean; onCopy: (brief: string) => void }) {
  if (!result.ok) {
    return (
      <div className="flex items-center gap-2 border-b border-danger/40 bg-danger/10 px-6 py-3 text-sm text-danger" role="alert">
        <TriangleAlert className="size-4" aria-hidden /> {result.error}
      </div>
    );
  }
  if (result.mode === "dispatched") {
    return (
      <div className="flex items-center gap-2 border-b border-success/40 bg-success/10 px-6 py-3 text-sm text-success" role="status">
        <Check className="size-4" aria-hidden /> Agent dispatched to the <code className="font-mono">flare-agent</code> thread. Watch Agent
        Thinking for live tool calls.
      </div>
    );
  }
  return (
    <div className="border-b border-warning/40 bg-warning/20 px-6 py-3" role="status" data-testid="run-fallback">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-warning">
          <span className="font-semibold">Brief ready, copy it to your agent.</span>{" "}
          <span className="text-warning/70">({result.reason})</span>
        </p>
        <button
          type="button"
          onClick={() => onCopy(result.brief)}
          className="inline-flex items-center gap-1.5 rounded-sm border border-warning/40 px-2.5 py-1 font-mono text-xs text-warning hover:bg-warning/10"
        >
          {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
          {copied ? "Copied" : "Copy brief"}
        </button>
      </div>
      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-sm bg-surface p-3 font-mono text-xs">
        {result.brief}
      </pre>
    </div>
  );
}
