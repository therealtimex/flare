// Drizzle schema. core-dev owns this file (C1): products, icps, accounts, people,
// signals, sources, edges, leads, messages, activity, usage_events, credits.
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** Key/value app metadata; lets the scaffold migrate and boot before C1 lands. */
export const meta = sqliteTable("meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
