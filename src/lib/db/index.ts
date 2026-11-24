import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { dbPath } from "./path";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema>;

const globalForDb = globalThis as unknown as { __flareDb?: Db };

/** Singleton DB handle (survives Next dev hot reloads). */
export function getDb(): Db {
  if (!globalForDb.__flareDb) {
    const sqlite = new Database(dbPath());
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    globalForDb.__flareDb = drizzle(sqlite, { schema });
  }
  return globalForDb.__flareDb;
}

export { schema };
