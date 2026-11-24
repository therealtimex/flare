import { getDb } from "@/lib/db";
import { handle } from "@/lib/http";
import { usageSummary } from "@/lib/metering";

export const dynamic = "force-dynamic";

/** Metering summary: balance, per-event counts/units, Flexprice send status counts, credit costs. */
export function GET() {
  return handle(() => usageSummary(getDb()));
}
