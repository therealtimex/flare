import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, runMigrations, schema, type Db } from "./index";
import { dbPath } from "./path";
import { DEMO_PRODUCT, STARTING_CREDITS, seedDemo } from "./seed";
import { STAGES } from "../types";

let dir: string;
let db: Db;
const prevDataDir = process.env.FLARE_DATA_DIR;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "flare-test-"));
  process.env.FLARE_DATA_DIR = dir;
  db = openDb(dbPath());
  runMigrations(db);
});

afterEach(() => {
  db.$client.close();
  if (prevDataDir === undefined) delete process.env.FLARE_DATA_DIR;
  else process.env.FLARE_DATA_DIR = prevDataDir;
  rmSync(dir, { recursive: true, force: true });
});

describe("migrations + seed", () => {
  it("migrates into FLARE_DATA_DIR and seeds one product and the starting balance", () => {
    expect(dbPath()).toBe(join(dir, "flare.db"));
    const r = seedDemo(db);
    expect(r.createdProduct).toBe(true);
    const rows = db.select().from(schema.products).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: DEMO_PRODUCT.name, customers: [] });
    expect(rows[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(db.select().from(schema.credits).get()?.balance).toBe(STARTING_CREDITS);
  });

  it("is idempotent and does not reset a spent balance", () => {
    seedDemo(db);
    db.update(schema.credits).set({ balance: 7 }).where(eq(schema.credits.id, 1)).run();
    const r = seedDemo(db);
    expect(r.createdProduct).toBe(false);
    expect(r.balance).toBe(7);
    expect(db.select().from(schema.products).all()).toHaveLength(1);
  });

  it("round-trips JSON columns and applies defaults (status, stage, owner)", () => {
    const { productId } = seedDemo(db);
    const icp = db
      .insert(schema.icps)
      .values({
        productId,
        industries: ["AI infrastructure"],
        confidence: { industries: 0.9, sizeBands: 0.5, personas: 0.7, triggers: 0.4 },
        expansions: [
          { id: "exp-1", segment: "Dev tools", rationale: "usage pricing", sources: [{ url: "https://example.com" }], status: "suggested" },
        ],
      })
      .returning()
      .get();
    expect(icp.expansions[0].sources[0].url).toBe("https://example.com");
    expect(icp.confidence.industries).toBe(0.9);
    expect(icp.personas).toEqual([]);

    const acct = db.insert(schema.accounts).values({ name: "Acme" }).returning().get();
    const q = db.insert(schema.people).values({ name: "No Source", accountId: acct.id, status: "quarantine" }).returning().get();
    expect(acct.status).toBe("active");
    expect(q.status).toBe("quarantine");
    expect(q.emailStatus).toBe("unverified");

    const lead = db.insert(schema.leads).values({ personId: q.id, productId }).returning().get();
    expect(lead.stage).toBe(STAGES[0]);
    expect(lead.ownerKind).toBe("agent");

    const msg = db.insert(schema.messages).values({ leadId: lead.id, channel: "email", body: "hi", signalsUsed: [1, 2] }).returning().get();
    expect(msg).toMatchObject({ status: "draft", step: 1, variant: "A", signalsUsed: [1, 2], decidedBy: null });
  });

  it("enforces foreign keys", () => {
    expect(() => db.insert(schema.leads).values({ personId: 999, productId: 999 }).run()).toThrow(/FOREIGN KEY/);
  });
});
