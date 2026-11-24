import { getDb } from "@/lib/db";
import { handle, intParam } from "@/lib/http";
import { getIcp, getProduct } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** ICP for ?productId= (default: first product), or null. */
export function GET(request: Request) {
  return handle(() => {
    const db = getDb();
    const product = getProduct(db, intParam(new URL(request.url).searchParams.get("productId"), "productId"));
    return product ? (getIcp(db, product.id) ?? null) : null;
  });
}
