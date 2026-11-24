"use client";
import { Check, Copy, Loader2, Play, Send, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { runGtmAgent, saveProduct, type ProductInput } from "@/lib/client/api";
import { useProduct } from "@/lib/client/hooks";
import type { RunResult } from "@/lib/client/views";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

type ChatMsg = { from: "you" | "flare"; text: string };

/** Editable form state: Product with pricing/customers as plain text. */
type Form = { id: number | null; name: string; description: string; pricing: string; customers: string };
const EMPTY: Form = { id: null, name: "", description: "", pricing: "", customers: "" };
const toForm = (p: Product): Form => ({ id: p.id, name: p.name, description: p.description, pricing: p.pricing ?? "", customers: p.customers.join("\n") });
const fromForm = (f: Form): ProductInput => ({
  name: f.name.trim(),
  description: f.description,
  pricing: f.pricing.trim() || null,
  customers: f.customers
    .split(/[\n,]/)
    .map((c) => c.trim())
    .filter(Boolean),
});

const inputCls =
  "w-full rounded-md border border-line bg-surface-1 px-3 py-2 text-sm placeholder:text-ink-faint focus:border-line-strong focus:outline-2 focus:outline-offset-2 focus:outline-flare";

export function IntakeView() {
  const { data: loaded, loading } = useProduct();
  const [form, setForm] = useState<Form | null>(null);
  const [saved, setSaved] = useState(false);
  const [chat, setChat] = useState<ChatMsg[]>([
    { from: "flare", text: "Describe what you sell in plain words: who buys it, why now, what it replaces. I'll add it to the product brief." },
  ]);
  const [draft, setDraft] = useState("");
  const [run, setRun] = useState<{ state: "idle" | "running" } | { state: "done"; result: RunResult }>({ state: "idle" });
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const chatEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!form && !loading) setForm(loaded ? toForm(loaded) : EMPTY);
  }, [loaded, loading, form]);
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ block: "nearest" });
  }, [chat]);

  if (!form) return <p className="body-sm p-6 text-ink-muted">Loading product…</p>;

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

  async function persist(f: Form): Promise<number> {
    const p = await saveProduct(f.id, fromForm(f));
    setForm({ ...f, id: p.id });
    setSaved(true);
    return p.id;
  }

  async function onSave() {
    if (!form) return;
    setErr(null);
    try {
      await persist(form);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function onRun() {
    if (!form) return;
    setRun({ state: "running" });
    setCopied(false);
    setErr(null);
    try {
      const id = await persist(form);
      setRun({ state: "done", result: await runGtmAgent(id, window.location.origin) });
    } catch (e) {
      setRun({ state: "done", result: { ok: false, error: e instanceof Error ? e.message : String(e) } });
    }
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
      <PageHeader kicker="Step 1 · Intake" title="What are you selling?" lede="Describe your product in plain words. Flare infers your ideal customer profile (ICP), then finds cited leads.">
        <button
          type="button"
          onClick={onSave}
          className="fl-btn fl-btn--secondary"
        >
          {saved ? "Saved" : "Save draft"}
        </button>
        <button
          type="button"
          onClick={onRun}
          disabled={!canRun || run.state === "running"}
          className="fl-btn fl-btn--primary"
          data-testid="run-gtm-agent"
        >
          {run.state === "running" ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />}
          Run GTM agent
        </button>
      </PageHeader>

      {err && (
        <p className="body-sm px-6 pb-3 text-negative" role="alert">
          {err}
        </p>
      )}
      {run.state === "done" && <RunBanner result={run.result} copied={copied} onCopy={copyBrief} />}

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="border-y border-line p-6 lg:border-r" aria-label="Product brief">
          <h3 className="label mb-3 text-ink-muted">Product brief</h3>
          <div className="grid gap-3">
            <label className="grid gap-1">
              <span className="text-xs text-ink-muted">Name</span>
              <input className={inputCls} value={form.name} onChange={set("name")} placeholder="Acme Billing" name="name" />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-ink-muted">Description</span>
              <textarea
                className={cn(inputCls, "min-h-36 resize-y leading-relaxed")}
                value={form.description}
                onChange={set("description")}
                placeholder="What it does, who it's for"
                name="description"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-ink-muted">Pricing</span>
              <input className={inputCls} value={form.pricing} onChange={set("pricing")} placeholder="$99/mo per seat" name="pricing" />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-ink-muted">Current customers</span>
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

        <section className="flex min-h-96 flex-col border-y border-line p-6" aria-label="Describe in plain words">
          <h3 className="label mb-3 text-ink-muted">Describe in plain words</h3>
          <div className="flex-1 space-y-2 overflow-y-auto rounded-lg border border-line bg-surface-1 p-3" data-testid="intake-chat">
            {chat.map((m, i) => (
              <div key={i} className={cn("flex", m.from === "you" ? "justify-end" : "justify-start")}>
                <p
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-md px-3 py-2 text-sm leading-snug",
                    m.from === "you" ? "bg-surface-2 text-ink" : "border border-line text-ink-muted",
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
              className="fl-btn fl-btn--secondary"
              aria-label="Send"
            >
              <Send aria-hidden />
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
      <div className="mx-6 mb-4 flex items-center gap-2 rounded-lg border border-line bg-surface-1 px-4 py-3 text-sm" role="alert">
        <span className="fl-badge fl-badge--negative">Blocked</span>
        <TriangleAlert className="size-4" aria-hidden /> {result.error}
      </div>
    );
  }
  if (result.mode === "dispatched") {
    return (
      <div className="mx-6 mb-4 flex items-center gap-2 rounded-lg border border-line bg-surface-1 px-4 py-3 text-sm" role="status">
        <span className="fl-badge fl-badge--positive">Dispatched</span> Agent dispatched to its RealTimeX thread. Watch Agent Thinking for live tool calls.
      </div>
    );
  }
  return (
    <div className="mx-6 mb-4 rounded-lg border border-line bg-surface-1 px-4 py-3" role="status" data-testid="run-fallback">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm">
          <span className="fl-badge fl-badge--caution">Fallback</span> <span className="font-semibold">Brief ready, copy it to your agent.</span>{" "}
          <span className="text-ink-muted">({result.reason})</span>
        </p>
        <button
          type="button"
          onClick={() => onCopy(result.brief)}
          className="fl-btn fl-btn--secondary fl-btn--sm"
        >
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? "Copied" : "Copy brief"}
        </button>
      </div>
      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-line bg-surface-0 p-3 font-mono text-xs">
        {result.brief}
      </pre>
    </div>
  );
}
