import { getDb } from "@/lib/db";
import { creditsView } from "@/lib/actions";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(() => creditsView(getDb()));
}
