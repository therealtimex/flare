import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { invoke } from "@/lib/tools/registry";
import { TOOLS } from "@/lib/tools/tools";

export const dynamic = "force-dynamic";

const STATUS: Record<string, number> = {
  invalid_input: 400,
  unknown_tool: 404,
  not_found: 404,
  citation_required: 409,
  approval_required: 409,
  locked: 409,
  insufficient_credits: 402,
  internal_error: 500,
};

/** POST {tool, input} → {ok, result, warnings} | {ok:false, error, code}. Actor is always "agent". */
export async function POST(request: Request) {
  let body: { tool?: unknown; input?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "invalid_input", error: "Body must be JSON: {\"tool\": string, \"input\": object}" }, { status: 400 });
  }
  if (typeof body?.tool !== "string")
    return NextResponse.json({ ok: false, code: "invalid_input", error: "Missing \"tool\" (string)" }, { status: 400 });
  const res = invoke(TOOLS, getDb(), body.tool, body.input ?? {}, "agent");
  return NextResponse.json(res, { status: res.ok ? 200 : (STATUS[res.code] ?? 400) });
}
