// Seed script. core-dev replaces this in C1 with one demo product.
import { getDb, schema } from "../src/lib/db";

const db = getDb();
db.insert(schema.meta)
  .values({ key: "seeded_at", value: new Date().toISOString(), updatedAt: new Date() })
  .onConflictDoUpdate({ target: schema.meta.key, set: { value: new Date().toISOString(), updatedAt: new Date() } })
  .run();
console.log("Seeded.");
