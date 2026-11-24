import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { join } from "node:path";
import { dbPath } from "./path";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

/** Folder with drizzle-kit SQL migrations (resolved from the repo root / cwd). */
export const MIGRATIONS_FOLDER = join(process.cwd(), "src/lib/db/migrations");

/** Open a fresh handle on a SQLite file (WAL, FKs on). Prefer getDb() in app code. */
export function openDb(file: string = dbPath()): Db {
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}

/** Apply all pending migrations. */
export function runMigrations(db: Db): void {
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}

const globalForDb = globalThis as unknown as { __flareDb?: Db };

/** Singleton DB handle (survives Next dev hot reloads). */
export function getDb(): Db {
  if (!globalForDb.__flareDb) globalForDb.__flareDb = openDb();
  return globalForDb.__flareDb;
}

export { schema };
