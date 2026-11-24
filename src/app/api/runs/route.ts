import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { dispatchRun } from "@/lib/runs";

export const dynamic = "force-dynamic";

/** Start the GTM agent for a product. Falls back to {dispatched:false, brief} when the CLI is unavailable. */
export async function POST(request: Request) {
  let productId: number | undefined;
  try {
    const body = (await request.json().catch(() => ({}))) as { productId?: unknown };
    if (body.productId !== undefined) productId = Number(body.productId);
    if (productId !== undefined && !(Number.isInteger(productId) && productId > 0))
      return NextResponse.json({ error: "productId must be a positive integer" }, { status: 400 });
    const baseUrl = process.env.FLARE_BASE_URL || new URL(request.url).origin;
    return NextResponse.json(await dispatchRun(getDb(), { productId, baseUrl }));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
