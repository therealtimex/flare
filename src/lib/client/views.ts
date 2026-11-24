// UI-only view shapes layered over src/lib/types.ts (core-dev owns that file).
import type { Credits, ID, LeadView, Message, Person, Account } from "@/lib/types";

/** Credits plus display hints the meter needs. */
export interface CreditsView extends Credits {
  /** Scale for the meter bar (starting / last top-up level). */
  allotment: number;
  flexprice: "configured" | "not_configured";
}

/** An outbox message with the lead it belongs to. */
export interface OutboxItem extends Message {
  lead: Pick<LeadView, "id" | "fitScore" | "tier" | "stage"> & {
    person: Pick<Person, "id" | "name" | "title">;
    account: Pick<Account, "id" | "name" | "domain"> | null;
  };
  /** Summaries of the signals listed in signalsUsed. */
  signalSummaries: { id: ID; kind: string; summary: string }[];
}

export type RunResult =
  | { ok: true; mode: "dispatched"; brief: string }
  | { ok: true; mode: "fallback"; brief: string; reason: string }
  | { ok: false; error: string };
