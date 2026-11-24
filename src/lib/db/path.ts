import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

/** Directory holding Flare's SQLite file. FLARE_DATA_DIR, default ./.flare-data */
export function dataDir(): string {
  const raw = process.env.FLARE_DATA_DIR || "./.flare-data";
  const dir = resolve(raw.replace(/^~(?=$|\/)/, homedir()));
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function dbPath(): string {
  return join(dataDir(), "flare.db");
}
