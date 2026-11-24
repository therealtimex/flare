import { getDb } from "@/lib/db";
import { moveStageAsRep, parseOr400, stageInput } from "@/lib/actions";
import { handle, readJson, requireInt } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Rep moves a lead: {stage, note?} → lead. Activity actorKind "rep". */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const id = requireInt((await ctx.params).id, "id");
    return moveStageAsRep(getDb(), id, parseOr400(stageInput, await readJson(request)));
  });
}
