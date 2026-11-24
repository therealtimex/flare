import { getDb } from "@/lib/db";
import { decideMessage, messagePatch, parseOr400 } from "@/lib/actions";
import { handle, readJson, requireInt } from "@/lib/http";

export const dynamic = "force-dynamic";

/** HITL gate: {subject?, body?, status?: "approved"|"rejected"|"draft", decidedBy?} → message. */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const id = requireInt((await ctx.params).id, "id");
    return decideMessage(getDb(), id, parseOr400(messagePatch, await readJson(request)));
  });
}
