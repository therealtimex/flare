// Client data layer. Every page reads and writes through these functions, so
// swapping mocks for core-dev's endpoints is a change to this file only.
// Today: reads/writes hit an in-memory mock store; runGtmAgent calls the real
// POST /api/runs and falls back to a copyable brief when it is unavailable.
import { mockActivity, mockCredits, mockIcp, mockProduct } from "@/lib/mock/data";
import type { Activity, ActorKind, Credits, Expansion, ExpansionStatus, Icp, Product, RunResult } from "@/lib/mock/types";
import { renderFallbackBrief } from "./format";

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const store = {
  product: clone(mockProduct),
  icp: clone(mockIcp) as Icp | null,
  activity: clone(mockActivity),
  credits: clone(mockCredits),
  seq: 100,
};

/** Test hook: reset the mock store to its seed. */
export function __resetMockStore(): void {
  store.product = clone(mockProduct);
  store.icp = clone(mockIcp);
  store.activity = clone(mockActivity);
  store.credits = clone(mockCredits);
  store.seq = 100;
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

function record(actorKind: ActorKind, tool: string, summary: string): void {
  store.activity.push({ id: `a${++store.seq}`, actorKind, tool, summary, createdAt: new Date().toISOString() });
}

// ---- reads ----
export async function getProduct(): Promise<Product> {
  return clone(store.product);
}

export async function getIcp(productId: string): Promise<Icp | null> {
  return store.icp && store.icp.productId === productId ? clone(store.icp) : null;
}

/** Newest first. */
export async function listActivity(limit = 50): Promise<Activity[]> {
  return clone(store.activity).reverse().slice(0, limit);
}

export async function getCredits(): Promise<Credits> {
  return clone(store.credits);
}

// ---- writes (rep actions) ----
export async function saveProduct(p: Product): Promise<Product> {
  store.product = clone(p);
  record("rep", "product.save", `Saved product brief: ${p.name || "(untitled)"}`);
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
  record("rep", "icp.expansion", `${verb} expansion: ${exp.segment}`);
  invalidate();
  return clone(exp);
}

export async function topUpCredits(amount: number): Promise<Credits> {
  store.credits.balance += amount;
  store.credits.allotment = Math.max(store.credits.allotment, store.credits.balance);
  record("rep", "credits.topup", `Topped up ${amount} credits`);
  invalidate();
  return clone(store.credits);
}

// ---- run dispatch (real endpoint, with fallback) ----
export async function runGtmAgent(productId: string, baseUrl: string): Promise<RunResult> {
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
