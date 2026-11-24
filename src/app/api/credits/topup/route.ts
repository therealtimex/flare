import { getDb } from "@/lib/db";
import { parseOr400, topUpCredits, topUpInput } from "@/lib/actions";
import { handle, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Demo top-up: {amount}. */
export async function POST(request: Request) {
  return handle(async () => topUpCredits(getDb(), parseOr400(topUpInput, await readJson(request)).amount));
}
