// Provisional UI types, shaped after brief-01's data model.
// core-dev owns src/lib/types.ts; when it lands on main, swap imports to it and delete this file.

export type ActorKind = "agent" | "rep";

export interface Product {
  id: string;
  name: string;
  description: string;
  pricing: string;
  customers: string;
}

export interface SourceRef {
  url: string;
  quote?: string;
  retrievedAt?: string;
}

/** A field the agent inferred, with its confidence 0–1. */
export interface Scored<T> {
  value: T;
  confidence: number;
}

export type ExpansionStatus = "suggested" | "accepted" | "dismissed";

export interface Expansion {
  id: string;
  segment: string;
  rationale: string;
  sources: SourceRef[];
  status: ExpansionStatus;
}

export interface Icp {
  id: string;
  productId: string;
  industries: Scored<string>[];
  sizeBands: Scored<string>[];
  personas: Scored<string>[];
  triggers: Scored<string>[];
  expansions: Expansion[];
  updatedAt: string;
}

export interface Activity {
  id: string;
  actorKind: ActorKind;
  tool: string;
  summary: string;
  createdAt: string;
}

export interface Credits {
  balance: number;
  /** Starting/top-up allotment, for the meter's scale. */
  allotment: number;
  flexprice: "configured" | "not_configured";
}

export type RunResult =
  | { ok: true; mode: "dispatched"; brief: string }
  | { ok: true; mode: "fallback"; brief: string; reason: string }
  | { ok: false; error: string };
