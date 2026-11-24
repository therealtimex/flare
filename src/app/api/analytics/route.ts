import { getDb } from "@/lib/db";
import { computeAnalytics } from "@/lib/analytics";
import { handle, intParam } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Funnel, conversion by industry/tier, variant split, agent-vs-rep attribution. ?productId= */
export function GET(request: Request) {
  return handle(() => computeAnalytics(getDb(), intParam(new URL(request.url).searchParams.get("productId"), "productId")));
}
