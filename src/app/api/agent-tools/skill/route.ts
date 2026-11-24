import { readFileSync } from "node:fs";
import { join } from "node:path";

export const dynamic = "force-dynamic";

/** agent/SKILL.md as text/markdown, with {baseUrl} filled in. */
export function GET(request: Request) {
  const base = (process.env.FLARE_BASE_URL || new URL(request.url).origin).replace(/\/$/, "");
  const md = readFileSync(join(process.cwd(), "agent/SKILL.md"), "utf8").replaceAll("{baseUrl}", base);
  return new Response(md, { headers: { "content-type": "text/markdown; charset=utf-8" } });
}
