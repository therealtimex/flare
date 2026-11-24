import { getDb } from "@/lib/db";
import { ActionError } from "@/lib/actions";
import { handle } from "@/lib/http";
import { getProduct } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** The demo product (first one); 404 if none. */
export function GET() {
  return handle(() => {
    const p = getProduct(getDb());
    if (!p) throw new ActionError("No product yet", 404);
    return p;
  });
}
