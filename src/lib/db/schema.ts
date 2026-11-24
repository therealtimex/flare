// Drizzle schema (C1). Row shapes mirror src/lib/types.ts: dates are ISO text,
// JSON columns are text with mode "json", unions are typed via $type<>().
import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type {
  ActorKind,
  Channel,
  EdgeType,
  EmailStatus,
  EntityType,
  Expansion,
  FlexpriceStatus,
  IcpConfidence,
  MessageStatus,
  MessageStep,
  RecordStatus,
  SignalKind,
  Stage,
  Tier,
  UsageEventName,
  Variant,
} from "../types";

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;
const id = () => integer("id").primaryKey({ autoIncrement: true });
const createdAt = () => text("created_at").notNull().default(now);
const updatedAt = () => text("updated_at").notNull().default(now);
const recordStatus = () =>
  text("status").$type<RecordStatus>().notNull().default("active");

/** Key/value app metadata (from scaffold migration 0000_init; kept unchanged). */
export const meta = sqliteTable("meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const products = sqliteTable("products", {
  id: id(),
  name: text("name").notNull(),
  website: text("website"),
  description: text("description").notNull(),
  pricing: text("pricing"),
  customers: text("customers", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const icps = sqliteTable(
  "icps",
  {
    id: id(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    industries: text("industries", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    sizeBands: text("size_bands", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    personas: text("personas", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    triggers: text("triggers", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    confidence: text("confidence", { mode: "json" })
      .$type<IcpConfidence>()
      .notNull()
      .default(sql`'{"industries":0,"sizeBands":0,"personas":0,"triggers":0}'`),
    expansions: text("expansions", { mode: "json" }).$type<Expansion[]>().notNull().default(sql`'[]'`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("icps_product_idx").on(t.productId)],
);

export const accounts = sqliteTable(
  "accounts",
  {
    id: id(),
    name: text("name").notNull(),
    domain: text("domain"),
    industry: text("industry"),
    size: text("size"),
    hq: text("hq"),
    status: recordStatus(),
    createdAt: createdAt(),
  },
  (t) => [index("accounts_domain_idx").on(t.domain), index("accounts_status_idx").on(t.status)],
);

export const people = sqliteTable(
  "people",
  {
    id: id(),
    name: text("name").notNull(),
    title: text("title"),
    accountId: integer("account_id").references(() => accounts.id, { onDelete: "set null" }),
    linkedinUrl: text("linkedin_url"),
    email: text("email"),
    emailStatus: text("email_status").$type<EmailStatus>().notNull().default("unverified"),
    status: recordStatus(),
    createdAt: createdAt(),
  },
  (t) => [index("people_account_idx").on(t.accountId), index("people_status_idx").on(t.status)],
);

export const signals = sqliteTable(
  "signals",
  {
    id: id(),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    kind: text("kind").$type<SignalKind>().notNull(),
    summary: text("summary").notNull(),
    date: text("date"),
    status: recordStatus(),
    createdAt: createdAt(),
  },
  (t) => [index("signals_account_idx").on(t.accountId)],
);

/** Citations for any entity (polymorphic: entityType + entityId). */
export const sources = sqliteTable(
  "sources",
  {
    id: id(),
    entityType: text("entity_type").$type<EntityType>().notNull(),
    entityId: integer("entity_id").notNull(),
    url: text("url").notNull(),
    quote: text("quote"),
    retrievedAt: text("retrieved_at").notNull().default(now),
  },
  (t) => [index("sources_entity_idx").on(t.entityType, t.entityId)],
);

export const schools = sqliteTable("schools", {
  id: id(),
  name: text("name").notNull(),
  domain: text("domain"),
  createdAt: createdAt(),
});

/** Graph edges between any two entities; walked with recursive CTEs. */
export const edges = sqliteTable(
  "edges",
  {
    id: id(),
    fromType: text("from_type").$type<EntityType>().notNull(),
    fromId: integer("from_id").notNull(),
    toType: text("to_type").$type<EntityType>().notNull(),
    toId: integer("to_id").notNull(),
    type: text("type").$type<EdgeType>().notNull(),
    meta: text("meta", { mode: "json" }).$type<Record<string, unknown> | null>(),
    createdAt: createdAt(),
  },
  (t) => [
    index("edges_from_idx").on(t.fromType, t.fromId),
    index("edges_to_idx").on(t.toType, t.toId),
    index("edges_type_idx").on(t.type),
  ],
);

export const leads = sqliteTable(
  "leads",
  {
    id: id(),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    fitScore: real("fit_score").notNull().default(0),
    tier: text("tier").$type<Tier>().notNull().default("C"),
    rationale: text("rationale").notNull().default(""),
    stage: text("stage").$type<Stage>().notNull().default("matched"),
    ownerKind: text("owner_kind").$type<ActorKind>().notNull().default("agent"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("leads_person_product_idx").on(t.personId, t.productId),
    index("leads_stage_idx").on(t.stage),
  ],
);

export const messages = sqliteTable(
  "messages",
  {
    id: id(),
    leadId: integer("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    channel: text("channel").$type<Channel>().notNull(),
    step: integer("step").$type<MessageStep>().notNull().default(1),
    variant: text("variant").$type<Variant>().notNull().default("A"),
    subject: text("subject"),
    body: text("body").notNull(),
    signalsUsed: text("signals_used", { mode: "json" }).$type<number[]>().notNull().default(sql`'[]'`),
    status: text("status").$type<MessageStatus>().notNull().default("draft"),
    decidedBy: text("decided_by"),
    decidedAt: text("decided_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("messages_lead_idx").on(t.leadId), index("messages_status_idx").on(t.status)],
);

/** Agent Thinking feed + attribution log: one row per tool call / rep action. */
export const activity = sqliteTable(
  "activity",
  {
    id: id(),
    actorKind: text("actor_kind").$type<ActorKind>().notNull(),
    tool: text("tool").notNull(),
    summary: text("summary").notNull(),
    entityType: text("entity_type").$type<EntityType>(),
    entityId: integer("entity_id"),
    leadId: integer("lead_id"),
    data: text("data", { mode: "json" }).$type<Record<string, unknown> | null>(),
    createdAt: createdAt(),
  },
  (t) => [index("activity_created_idx").on(t.createdAt), index("activity_lead_idx").on(t.leadId)],
);

export const usageEvents = sqliteTable(
  "usage_events",
  {
    id: id(),
    event: text("event").$type<UsageEventName>().notNull(),
    units: integer("units").notNull().default(1),
    leadId: integer("lead_id"),
    flexpriceStatus: text("flexprice_status").$type<FlexpriceStatus>().notNull().default("pending"),
    createdAt: createdAt(),
  },
  (t) => [index("usage_events_event_idx").on(t.event)],
);

/** Single-row balance (id = 1). */
export const credits = sqliteTable("credits", {
  id: integer("id").primaryKey(),
  balance: integer("balance").notNull().default(0),
  allotment: integer("allotment").notNull().default(100),
  updatedAt: updatedAt(),
});
