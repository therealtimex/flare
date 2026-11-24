import { existsSync } from "node:fs";
import { join } from "node:path";
import { getDb, MIGRATIONS_FOLDER, runMigrations } from "../src/lib/db";
import { dbPath } from "../src/lib/db/path";

if (!existsSync(join(MIGRATIONS_FOLDER, "meta/_journal.json"))) {
  console.log("No migrations yet (run `npm run db:generate`).");
} else {
  runMigrations(getDb());
  console.log(`Migrated ${dbPath()}`);
}
