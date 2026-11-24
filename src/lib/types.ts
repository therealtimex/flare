// Shared domain types for Flare. Plain TS, no DB/runtime deps: safe to import from
// UI components, API routes and tests alike. Dates are ISO-8601 strings everywhere
// (stored as text in SQLite, sent as-is over JSON). IDs are integer row ids.

export type ID = number;
export type ISODate = string;

// ---------- enums / unions ----------

export const STAGES = [
  "matched",
  "contacted",
  "replied",
  "meeting_booked",
  "closed_won",
  "closed_lost",
] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABELS: Record<Stage, string> = {
  matched: "Matched",
  contacted: "Contacted",
  replied: "Replied",
  meeting_booked: "Meeting Booked",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
};

/** Who did it: the RealTimeX agent or a human rep. */
export const ACTOR_KINDS = ["agent", "rep"] as const;
export type ActorKind = (typeof ACTOR_KINDS)[number];

/** Citation gate: records without ≥1 source URL land in quarantine and are hidden from leads. */
export const RECORD_STATUSES = ["active", "quarantine"] as const;
export type RecordStatus = (typeof RECORD_STATUSES)[number];

export const EMAIL_STATUSES = ["unverified", "pattern", "verified"] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

export const SIGNAL_KINDS = [
  "funding",
  "hiring",
  "exec_hire",
  "tech_change",
  "expansion",
  "product_launch",
  "news",
  "other",
] as const;
export type SignalKind = (typeof SIGNAL_KINDS)[number];

/** Anything a source or a graph edge can point at. */
export const ENTITY_TYPES = [
  "product",
  "icp",
  "account",
  "person",
  "signal",
  "school",
  "lead",
  "message",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const EDGE_TYPES = [
  "works_at",
  "previously_employed_at",
  "competes_with",
  "matched_to",
  "contacted_via",
  "replied_to",
  "studied_at",
] as const;
export type EdgeType = (typeof EDGE_TYPES)[number];

export const TIERS = ["A", "B", "C"] as const;
export type Tier = (typeof TIERS)[number];

export const CHANNELS = ["email", "linkedin"] as const;
export type Channel = (typeof CHANNELS)[number];

export const MESSAGE_STEPS = [1, 2, 3] as const;
export type MessageStep = (typeof MESSAGE_STEPS)[number];

export const VARIANTS = ["A", "B"] as const;
export type Variant = (typeof VARIANTS)[number];

/** HITL gate: nothing leaves without status "approved" set by a rep. */
export const MESSAGE_STATUSES = ["draft", "approved", "rejected", "sent"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const EXPANSION_STATUSES = ["suggested", "accepted", "dismissed"] as const;
export type ExpansionStatus = (typeof EXPANSION_STATUSES)[number];

export const USAGE_EVENTS = ["lead_enriched", "outreach_sent", "graph_query"] as const;
export type UsageEventName = (typeof USAGE_EVENTS)[number];

export const FLEXPRICE_STATUSES = ["pending", "sent", "failed", "not_configured"] as const;
export type FlexpriceStatus = (typeof FLEXPRICE_STATUSES)[number];

// ---------- entities ----------

export interface Product {
  id: ID;
  name: string;
  website: string | null;
  description: string;
  pricing: string | null;
  /** Named public customers / logos. */
  customers: string[];
  createdAt: ISODate;
  updatedAt: ISODate;
}

/** A citation attached inline (ICP expansions); standalone citations use `Source`. */
export interface SourceRef {
  url: string;
  quote?: string | null;
}

export interface Expansion {
  /** Stable client id (e.g. "exp-1") so the UI can Accept/Dismiss one item. */
  id: string;
  segment: string;
  rationale: string;
  sources: SourceRef[];
  status: ExpansionStatus;
}

export const ICP_FIELDS = ["industries", "sizeBands", "personas", "triggers"] as const;
export type IcpField = (typeof ICP_FIELDS)[number];
/** Confidence 0–1 per ICP field. */
export type IcpConfidence = Record<IcpField, number>;

export interface Icp {
  id: ID;
  productId: ID;
  industries: string[];
  /** e.g. "11-50", "51-200", "201-1000" */
  sizeBands: string[];
  /** e.g. "VP Sales", "Head of RevOps" */
  personas: string[];
  triggers: string[];
  confidence: IcpConfidence;
  expansions: Expansion[];
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface Account {
  id: ID;
  name: string;
  domain: string | null;
  industry: string | null;
  /** Size band or headcount text, e.g. "51-200". */
  size: string | null;
  hq: string | null;
  status: RecordStatus;
  createdAt: ISODate;
}

export interface Person {
  id: ID;
  name: string;
  title: string | null;
  accountId: ID | null;
  linkedinUrl: string | null;
  email: string | null;
  emailStatus: EmailStatus;
  status: RecordStatus;
  createdAt: ISODate;
}

export interface Signal {
  id: ID;
  accountId: ID;
  kind: SignalKind;
  summary: string;
  /** Date the signal happened (ISO date or datetime), if known. */
  date: ISODate | null;
  status: RecordStatus;
  createdAt: ISODate;
}

export interface Source {
  id: ID;
  entityType: EntityType;
  entityId: ID;
  url: string;
  quote: string | null;
  retrievedAt: ISODate;
}

/** Education node for `studied_at` edges (warm paths via shared school). */
export interface School {
  id: ID;
  name: string;
  domain: string | null;
  createdAt: ISODate;
}

export interface Edge {
  id: ID;
  fromType: EntityType;
  fromId: ID;
  toType: EntityType;
  toId: ID;
  type: EdgeType;
  /** Optional detail, e.g. {"title":"AE","from":"2019","to":"2022"}. */
  meta: Record<string, unknown> | null;
  createdAt: ISODate;
}

export interface Lead {
  id: ID;
  personId: ID;
  productId: ID;
  /** 0–100 */
  fitScore: number;
  tier: Tier;
  rationale: string;
  stage: Stage;
  ownerKind: ActorKind;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface Message {
  id: ID;
  leadId: ID;
  channel: Channel;
  step: MessageStep;
  variant: Variant;
  /** null for LinkedIn. */
  subject: string | null;
  body: string;
  /** Signal ids the copy is personalized on. */
  signalsUsed: ID[];
  status: MessageStatus;
  /** Who approved/rejected (rep name or "rep"); null while draft. */
  decidedBy: string | null;
  decidedAt: ISODate | null;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface Activity {
  id: ID;
  actorKind: ActorKind;
  /** Agent tool name (e.g. "add_person") or UI action (e.g. "approve_message"). */
  tool: string;
  summary: string;
  entityType: EntityType | null;
  entityId: ID | null;
  leadId: ID | null;
  /** Optional structured payload (stage from/to, warnings, ...). */
  data: Record<string, unknown> | null;
  createdAt: ISODate;
}

export interface UsageEvent {
  id: ID;
  event: UsageEventName;
  units: number;
  leadId: ID | null;
  flexpriceStatus: FlexpriceStatus;
  createdAt: ISODate;
}

export interface Credits {
  balance: number;
  /** Starting/top-up allotment, for the meter's scale. */
  allotment: number;
  updatedAt: ISODate;
}

/** GET /api/credits */
export interface CreditsView {
  balance: number;
  allotment: number;
  flexprice: "configured" | "not_configured";
}

// ---------- API view shapes (joined rows the UI renders) ----------

export interface LeadView extends Lead {
  person: Person;
  account: Account | null;
  signals: Signal[];
  sources: Source[];
}

export interface QuarantineCounts {
  accounts: number;
  people: number;
  signals: number;
}

/** GET /api/leads */
export interface LeadsResponse {
  leads: LeadView[];
  quarantine: QuarantineCounts;
  /** accounts + people + signals in quarantine */
  quarantineCount: number;
}

/** GET /api/messages: a message with what the Outbox needs to render it. */
export interface OutboxItem extends Message {
  lead: Pick<Lead, "id" | "fitScore" | "tier" | "stage" | "ownerKind">;
  person: Pick<Person, "id" | "name" | "title" | "email" | "emailStatus" | "linkedinUrl">;
  account: Pick<Account, "id" | "name" | "domain"> | null;
  /** The signals listed in signalsUsed. */
  signals: Signal[];
}

/** POST /api/runs (402 {error} when out of credits). */
export interface RunResponse {
  mode: "dispatched" | "fallback";
  dispatched: boolean;
  brief: string;
  reason?: string;
  command: string;
  session?: unknown;
}
