import { getDb } from "@/lib/db";
import { parseOr400, productInput, saveProduct } from "@/lib/actions";
import { handle, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Create a product. Body {name, description, website?, pricing?, customers[]}. */
export async function POST(request: Request) {
  return handle(async () => saveProduct(getDb(), null, parseOr400(productInput, await readJson(request))));
}
