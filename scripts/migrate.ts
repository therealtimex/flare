import { existsSync } from "node:fs";
import { join } from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { getDb } from "../src/lib/db";
import { dbPath } from "../src/lib/db/path";

const folder = join(process.cwd(), "src/lib/db/migrations");
if (!existsSync(join(folder, "meta/_journal.json"))) {
  console.log("No migrations yet (run `npm run db:generate`).");
} else {
  migrate(getDb(), { migrationsFolder: folder });
  console.log(`Migrated ${dbPath()}`);
}
