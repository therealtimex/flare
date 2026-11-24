import { getDb } from "@/lib/db";
import { parseOr400 } from "@/lib/actions";
import { handle, intParam } from "@/lib/http";
import { listLeadViews, quarantineCounts } from "@/lib/queries";
import { STAGES, type LeadsResponse } from "@/lib/types";
import { z } from "zod";

export const dynamic = "force-dynamic";

/** Leads (best fit first) with person, account, signals, sources + quarantine counts. ?productId=&stage= */
export function GET(request: Request) {
  return handle((): LeadsResponse => {
    const q = new URL(request.url).searchParams;
    const stage = q.get("stage") ? parseOr400(z.enum(STAGES), q.get("stage")) : undefined;
    const db = getDb();
    const quarantine = quarantineCounts(db);
    return {
      leads: listLeadViews(db, { productId: intParam(q.get("productId"), "productId"), stage }),
      quarantine,
      quarantineCount: quarantine.accounts + quarantine.people + quarantine.signals,
    };
  });
}
