import { z } from "zod";
import { getDb } from "@/lib/db";
import { listOutbox, parseOr400 } from "@/lib/actions";
import { handle, intParam } from "@/lib/http";
import { MESSAGE_STATUSES } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Outbox items. ?status=draft&leadId= */
export function GET(request: Request) {
  return handle(() => {
    const q = new URL(request.url).searchParams;
    const status = q.get("status") ? parseOr400(z.enum(MESSAGE_STATUSES), q.get("status")) : undefined;
    return listOutbox(getDb(), { status, leadId: intParam(q.get("leadId"), "leadId") });
  });
}
