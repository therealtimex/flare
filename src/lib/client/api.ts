// Client data layer over core-dev's UI routes (shapes in src/lib/types.ts).
// Every page reads and writes through these functions. Mutations call
// invalidate() so mounted hooks refetch; rep actions are logged server-side.
import type {
  Activity,
  CreditsView,
  Expansion,
  ExpansionStatus,
  ID,
  Icp,
  Lead,
  LeadsResponse,
  Message,
  OutboxItem,
  Product,
  RunResponse,
  Stage,
} from "@/lib/types";
import { renderFallbackBrief } from "./format";
import type { RunResult } from "./views";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function req<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method ?? "GET",
    headers: init?.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error ?? `HTTP ${res.status}`;
    throw new ApiError(msg, res.status);
  }
  return data as T;
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

async function mutate<T>(path: string, method: string, body: unknown): Promise<T> {
  try {
    return await req<T>(path, { method, body });
  } finally {
    invalidate();
  }
}

// ---- reads ----
/** The current (demo) product, or null when none exists yet. */
export async function getProduct(): Promise<Product | null> {
  try {
    return await req<Product>("/api/products/current");
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export const getIcp = (productId: ID) => req<Icp | null>(`/api/icp?productId=${productId}`);
/** Newest first. */
export const listActivity = (limit = 50) => req<Activity[]>(`/api/activity?limit=${limit}`);
export const getCredits = () => req<CreditsView>("/api/credits");
/** Active (non-quarantined) leads plus quarantine counts. */
export const listLeads = () => req<LeadsResponse>("/api/leads");
export const listOutbox = () => req<OutboxItem[]>("/api/messages");

// ---- writes (rep actions) ----
export type ProductInput = Pick<Product, "name" | "description" | "pricing" | "customers"> & { website?: string | null };

/** Create (id null) or update the product brief. */
export function saveProduct(id: ID | null, input: ProductInput): Promise<Product> {
  return id ? mutate(`/api/products/${id}`, "PUT", input) : mutate("/api/products", "POST", input);
}

export function decideExpansion(
  productId: ID,
  expansionId: string,
  status: ExpansionStatus,
  patch?: Partial<Pick<Expansion, "segment" | "rationale">>,
): Promise<Expansion> {
  return mutate(`/api/icp/expansions/${encodeURIComponent(expansionId)}?productId=${productId}`, "PATCH", { status, ...patch });
}

export const topUpCredits = (amount: number) => mutate<CreditsView>("/api/credits/topup", "POST", { amount });

/** Save a draft's edited copy without deciding it. */
export const editMessage = (id: ID, patch: Pick<Message, "subject" | "body">) => mutate<Message>(`/api/messages/${id}`, "PATCH", patch);

/**
 * HITL gate: the only way a message leaves "draft". Approve queues it (the
 * server meters it and may refuse with 402 when out of credits); Reject parks it.
 */
export function decideMessage(id: ID, decision: "approved" | "rejected", patch?: Pick<Message, "subject" | "body">): Promise<Message> {
  return mutate(`/api/messages/${id}`, "PATCH", { ...patch, status: decision, decidedBy: "rep" });
}

export const moveStage = (leadId: ID, stage: Stage) => mutate<Lead>(`/api/leads/${leadId}/stage`, "PATCH", { stage });

// ---- run dispatch ----
export async function runGtmAgent(productId: ID, baseUrl: string): Promise<RunResult> {
  try {
    const r = await req<RunResponse>("/api/runs", { method: "POST", body: { productId } });
    if (r.mode === "dispatched") return { ok: true, mode: "dispatched", brief: r.brief };
    return { ok: true, mode: "fallback", brief: r.brief, reason: r.reason ?? "Terminal agent unavailable" };
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 402) return { ok: false, error: e.message || "Out of credits. Top up to run the agent." };
      if (e.status === 404) return { ok: true, mode: "fallback", brief: renderFallbackBrief(productId, baseUrl), reason: "Run endpoint not available" };
      return { ok: false, error: e.message };
    }
    return { ok: true, mode: "fallback", brief: renderFallbackBrief(productId, baseUrl), reason: "Run endpoint unreachable" };
  } finally {
    invalidate();
  }
}
