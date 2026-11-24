// Test helper: a migrated + seeded SQLite DB in a fresh temp dir.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb, runMigrations, type Db } from "./index";
import { seedDemo } from "./seed";

export function createTestDb(opts: { seed?: boolean } = {}): { db: Db; productId: number; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "flare-test-"));
  const db = openDb(join(dir, "flare.db"));
  runMigrations(db);
  const productId = opts.seed === false ? 0 : seedDemo(db).productId;
  return {
    db,
    productId,
    cleanup: () => {
      db.$client.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
