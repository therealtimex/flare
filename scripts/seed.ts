// Seeds one demo product and the starting credit balance. Run after db:migrate.
import { getDb } from "../src/lib/db";
import { dbPath } from "../src/lib/db/path";
import { seedDemo } from "../src/lib/db/seed";

const r = seedDemo(getDb());
console.log(
  `Seeded ${dbPath()}: product #${r.productId} (${r.createdProduct ? "created" : "already present"}), credits ${r.balance}.`,
);
