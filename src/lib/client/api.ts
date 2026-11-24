// Client data layer. Every page reads and writes through these functions, so
// swapping mocks for core-dev's endpoints is a change to this file only.
// Today: reads/writes hit an in-memory mock store; runGtmAgent calls the real
// POST /api/runs and falls back to a copyable brief when it is unavailable.
import {
  mockActivity,
  mockCredits,
  mockIcp,
  mockLeads,
  mockMessages,
  mockProduct,
  mockQuarantine,
} from "@/lib/mock/data";
import { STAGE_LABELS } from "@/lib/types";
import type {
  Activity,
  ActorKind,
  EntityType,
  Expansion,
  ExpansionStatus,
  ID,
  Icp,
  LeadView,
  Message,
  Product,
  QuarantineCounts,
  Stage,
} from "@/lib/types";
import { renderFallbackBrief } from "./format";
import type { CreditsView, OutboxItem, RunResult } from "./views";

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function seed() {
  return {
    product: clone(mockProduct),
    icp: clone(mockIcp) as Icp | null,
    leads: clone(mockLeads),
    messages: clone(mockMessages),
    quarantine: clone(mockQuarantine),
    activity: clone(mockActivity),
    credits: clone(mockCredits),
    seq: 1000,
  };
}
let store = seed();

/** Test hook: reset the mock store to its seed. */
export function __resetMockStore(): void {
  store = seed();
}

// ---- invalidation bus: mutations notify hooks to refetch ----
type Listener = () => void;
const listeners = new Set<Listener>();
export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function invalidate(): void {
  for (const fn of listeners) fn();
}

function record(
  actorKind: ActorKind,
  tool: string,
  summary: string,
  ref: { entityType?: EntityType; entityId?: ID; leadId?: ID; data?: Record<string, unknown> } = {},
): void {
  store.activity.push({
    id: ++store.seq,
    actorKind,
    tool,
    summary,
    entityType: ref.entityType ?? null,
    entityId: ref.entityId ?? null,
    leadId: ref.leadId ?? null,
    data: ref.data ?? null,
    createdAt: new Date().toISOString(),
  });
}

const leadName = (l: LeadView) => (l.account ? `${l.person.name} (${l.account.name})` : l.person.name);

// ---- reads ----
export async function getProduct(): Promise<Product> {
  return clone(store.product);
}

export async function getIcp(productId: ID): Promise<Icp | null> {
  return store.icp && store.icp.productId === productId ? clone(store.icp) : null;
}

/** Newest first. */
export async function listActivity(limit = 50): Promise<Activity[]> {
  return clone(store.activity).reverse().slice(0, limit);
}

export async function getCredits(): Promise<CreditsView> {
  return clone(store.credits);
}

/** Active (non-quarantined) leads, best fit first. */
export async function listLeads(): Promise<LeadView[]> {
  return clone(store.leads).sort((a, b) => b.fitScore - a.fitScore);
}

export async function getQuarantineCounts(): Promise<QuarantineCounts> {
  return clone(store.quarantine);
}

export async function listOutbox(): Promise<OutboxItem[]> {
  return store.messages.map((m) => {
    const l = store.leads.find((x) => x.id === m.leadId);
    if (!l) throw new Error(`Message ${m.id} has no lead ${m.leadId}`);
    return clone({
      ...m,
      lead: {
        id: l.id,
        fitScore: l.fitScore,
        tier: l.tier,
        stage: l.stage,
        person: { id: l.person.id, name: l.person.name, title: l.person.title },
        account: l.account ? { id: l.account.id, name: l.account.name, domain: l.account.domain } : null,
      },
      signalSummaries: l.signals.filter((s) => m.signalsUsed.includes(s.id)).map((s) => ({ id: s.id, kind: s.kind, summary: s.summary })),
    });
  });
}

// ---- writes (rep actions) ----
export async function saveProduct(p: Product): Promise<Product> {
  store.product = clone({ ...p, updatedAt: new Date().toISOString() });
  record("rep", "save_product", `Saved product brief: ${p.name || "(untitled)"}`, { entityType: "product", entityId: p.id });
  invalidate();
  return clone(store.product);
}

export async function decideExpansion(
  expansionId: string,
  status: ExpansionStatus,
  patch?: Partial<Pick<Expansion, "segment" | "rationale">>,
): Promise<Expansion> {
  const exp = store.icp?.expansions.find((e) => e.id === expansionId);
  if (!exp) throw new Error(`Unknown expansion ${expansionId}`);
  Object.assign(exp, patch ?? {}, { status });
  const verb = patch ? "Adjusted" : status === "accepted" ? "Accepted" : status === "dismissed" ? "Dismissed" : "Reset";
  record("rep", "decide_expansion", `${verb} expansion: ${exp.segment}`, { entityType: "icp", entityId: store.icp?.id });
  invalidate();
  return clone(exp);
}

export async function topUpCredits(amount: number): Promise<CreditsView> {
  store.credits.balance += amount;
  store.credits.allotment = Math.max(store.credits.allotment, store.credits.balance);
  store.credits.updatedAt = new Date().toISOString();
  record("rep", "top_up_credits", `Topped up ${amount} credits`);
  invalidate();
  return clone(store.credits);
}

/** Save a draft's edited copy without deciding it. Only drafts are editable. */
export async function editMessage(id: ID, patch: Pick<Message, "subject" | "body">): Promise<Message> {
  const m = store.messages.find((x) => x.id === id);
  if (!m) throw new Error(`Unknown message ${id}`);
  if (m.status !== "draft") throw new Error(`Message ${id} is ${m.status}; only drafts can be edited`);
  Object.assign(m, patch, { updatedAt: new Date().toISOString() });
  record("rep", "edit_message", `Edited step ${m.step}${m.variant} draft`, { entityType: "message", entityId: id, leadId: m.leadId });
  invalidate();
  return clone(m);
}

/**
 * HITL gate: the only way a message leaves "draft". Approve queues it (never
 * sends here); Reject parks it. Optional edits are applied with the decision.
 */
export async function decideMessage(
  id: ID,
  decision: "approved" | "rejected",
  patch?: Pick<Message, "subject" | "body">,
): Promise<Message> {
  const m = store.messages.find((x) => x.id === id);
  if (!m) throw new Error(`Unknown message ${id}`);
  if (m.status !== "draft") throw new Error(`Message ${id} is already ${m.status}`);
  const now = new Date().toISOString();
  Object.assign(m, patch ?? {}, { status: decision, decidedBy: "rep", decidedAt: now, updatedAt: now });
  const l = store.leads.find((x) => x.id === m.leadId);
  record(
    "rep",
    decision === "approved" ? "approve_message" : "reject_message",
    `${decision === "approved" ? "Approved" : "Rejected"} ${m.channel} step ${m.step}${m.variant}${l ? ` to ${leadName(l)}` : ""}`,
    { entityType: "message", entityId: id, leadId: m.leadId },
  );
  invalidate();
  return clone(m);
}

export async function moveStage(leadId: ID, to: Stage): Promise<LeadView> {
  const l = store.leads.find((x) => x.id === leadId);
  if (!l) throw new Error(`Unknown lead ${leadId}`);
  const from = l.stage;
  if (from === to) return clone(l);
  l.stage = to;
  l.updatedAt = new Date().toISOString();
  record("rep", "move_stage", `${l.account?.name ?? l.person.name}: ${STAGE_LABELS[from]} → ${STAGE_LABELS[to]}`, {
    entityType: "lead",
    entityId: leadId,
    leadId,
    data: { from, to },
  });
  invalidate();
  return clone(l);
}

// ---- run dispatch (real endpoint, with fallback) ----
export async function runGtmAgent(productId: ID, baseUrl: string): Promise<RunResult> {
  const result = await dispatchRun(productId, baseUrl);
  const summary = !result.ok
    ? `Run blocked: ${result.error}`
    : result.mode === "dispatched"
      ? "Dispatched GTM agent to the flare-agent thread"
      : `Run fallback: brief ready to copy (${result.reason})`;
  record("rep", "run_dispatch", summary, { entityType: "product", entityId: productId });
  invalidate();
  return result;
}

async function dispatchRun(productId: ID, baseUrl: string): Promise<RunResult> {
  const fallback = (reason: string): RunResult => ({
    ok: true,
    mode: "fallback",
    brief: renderFallbackBrief(productId, baseUrl),
    reason,
  });
  let res: Response;
  try {
    res = await fetch("/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productId }),
    });
  } catch {
    return fallback("Run endpoint unreachable");
  }
  if (res.status === 404) return fallback("Run endpoint not available yet");
  let body: { mode?: string; brief?: string; reason?: string; error?: string } = {};
  try {
    body = await res.json();
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    if (res.status === 402) return { ok: false, error: body.error ?? "Out of credits. Top up to run the agent." };
    return fallback(body.error ?? `Run failed (HTTP ${res.status})`);
  }
  const brief = body.brief ?? renderFallbackBrief(productId, baseUrl);
  if (body.mode === "fallback") return { ok: true, mode: "fallback", brief, reason: body.reason ?? "Terminal agent CLI unavailable" };
  return { ok: true, mode: "dispatched", brief };
}
