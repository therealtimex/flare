import { getDb } from "@/lib/db";
import { decideExpansion, expansionInput, parseOr400 } from "@/lib/actions";
import { handle, intParam, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Rep decision on an expansion: {status, segment?, rationale?}. Optional ?productId=. */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const productId = intParam(new URL(request.url).searchParams.get("productId"), "productId");
    return decideExpansion(getDb(), decodeURIComponent(id), parseOr400(expansionInput, await readJson(request)), productId);
  });
}
