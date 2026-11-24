import { NextResponse } from "next/server";
import { manifest } from "@/lib/tools/registry";
import { TOOLS } from "@/lib/tools/tools";

export const dynamic = "force-dynamic";

/** Agent-tools manifest: name, description and JSON Schema input for every tool. */
export function GET(request: Request) {
  const base = process.env.FLARE_BASE_URL || new URL(request.url).origin;
  return NextResponse.json({
    name: "flare",
    version: 1,
    invoke: { method: "POST", url: `${base}/api/agent-tools/invoke`, body: '{"tool": "<name>", "input": {...}}' },
    rules: [
      "Flare's agent-tools API is the only data store. Never use the Signals app or the realtimex-signals, signals-publish or signals-writing skills.",
      "No third-party enrichment, email-finder or email-verifier APIs (Hunter, Apollo, Clearbit, ...). Public web research with citations only.",
      "Every account, person and signal needs sources[] with at least one URL, or it is quarantined and hidden from leads.",
      "Messages are drafts until a human approves them in the Outbox. Never claim a message was sent.",
    ],
    tools: manifest(TOOLS),
  });
}
