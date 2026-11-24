// Demo seed: one product (public company info only, no personal data) and a
// starting credit balance. Idempotent: re-running never duplicates the product
// and never resets a balance that already exists.
import { eq } from "drizzle-orm";
import type { Db } from "./index";
import { credits, meta, products } from "./schema";

export const STARTING_CREDITS = 100;

export const DEMO_PRODUCT = {
  name: "Flexprice",
  website: "https://flexprice.io",
  description:
    "Open-source usage-based billing and metering for AI and developer-tool companies: " +
    "meter usage events, define credit and usage-based pricing plans, and invoice customers " +
    "without building billing in-house.",
  pricing: "Open-source self-hosted core; managed cloud with usage-based plans (see flexprice.io/pricing).",
  customers: [] as string[],
};

export interface SeedResult {
  productId: number;
  createdProduct: boolean;
  balance: number;
}

export function seedDemo(db: Db): SeedResult {
  return db.transaction((tx) => {
    const existing = tx.select().from(products).where(eq(products.name, DEMO_PRODUCT.name)).get();
    let productId: number;
    let createdProduct = false;
    if (existing) {
      productId = existing.id;
    } else {
      productId = tx.insert(products).values(DEMO_PRODUCT).returning({ id: products.id }).get().id;
      createdProduct = true;
    }

    tx.insert(credits).values({ id: 1, balance: STARTING_CREDITS, allotment: STARTING_CREDITS }).onConflictDoNothing().run();
    const balance = tx.select().from(credits).where(eq(credits.id, 1)).get()!.balance;

    const stamp = new Date();
    tx.insert(meta)
      .values({ key: "seeded_at", value: stamp.toISOString(), updatedAt: stamp })
      .onConflictDoUpdate({ target: meta.key, set: { value: stamp.toISOString(), updatedAt: stamp } })
      .run();

    return { productId, createdProduct, balance };
  });
}
