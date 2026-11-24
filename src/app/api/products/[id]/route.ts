import { getDb } from "@/lib/db";
import { parseOr400, productInput, saveProduct } from "@/lib/actions";
import { handle, readJson, requireInt } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Update a product from the Intake form. */
export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const id = requireInt((await ctx.params).id, "id");
    return saveProduct(getDb(), id, parseOr400(productInput, await readJson(request)));
  });
}
