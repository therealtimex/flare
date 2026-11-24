import { getDb } from "@/lib/db";
import { listActivity } from "@/lib/activity";
import { handle, intParam } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Agent Thinking feed, newest first. ?limit=50&since=<iso>&afterId=<id> */
export function GET(request: Request) {
  return handle(() => {
    const q = new URL(request.url).searchParams;
    return listActivity(getDb(), {
      limit: intParam(q.get("limit"), "limit") ?? 50,
      afterId: intParam(q.get("afterId"), "afterId"),
      since: q.get("since") || undefined,
    });
  });
}
