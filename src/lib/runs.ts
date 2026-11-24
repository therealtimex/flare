// "Run GTM agent": render agent/BRIEF.md and open a RealTimeX terminal session
// with it via realtimex-pp-cli. If the CLI is missing or fails, return the brief
// so the UI can show it with a Copy button (fallback).
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Db } from "./db";
import { logActivity } from "./activity";
import { getProduct } from "./queries";

export interface RunConfig {
  cli: string;
  agentName: string;
  workspaceSlug: string;
  threadSlug: string;
  disabled: boolean;
}

export function runConfig(env: Record<string, string | undefined> = process.env): RunConfig {
  return {
    cli: env.FLARE_PP_CLI || "realtimex-pp-cli",
    agentName: env.FLARE_AGENT_NAME || "claude",
    workspaceSlug: env.FLARE_RTX_WORKSPACE || "hackwithbay4",
    threadSlug: env.FLARE_RTX_THREAD || "flare-agent",
    disabled: env.FLARE_RUN_DISPATCH === "off",
  };
}

export function renderBrief(vars: { productId: number; productName: string; baseUrl: string }, template?: string): string {
  const tpl = template ?? readFileSync(join(process.cwd(), "agent/BRIEF.md"), "utf8");
  return tpl
    .replaceAll("{{productId}}", String(vars.productId))
    .replaceAll("{{productName}}", vars.productName)
    .replaceAll("{{baseUrl}}", vars.baseUrl.replace(/\/$/, ""));
}

export type Exec = (cmd: string, args: string[]) => Promise<{ stdout: string; stderr: string }>;

const defaultExec: Exec = (cmd, args) =>
  new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 30_000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(Object.assign(err, { stderr }));
      else resolve({ stdout: String(stdout), stderr: String(stderr) });
    });
  });

export interface RunResult {
  dispatched: boolean;
  brief: string;
  /** Why dispatch fell back (CLI missing, error, disabled). */
  reason?: string;
  command: string;
  session?: unknown;
}

export async function dispatchRun(
  db: Db,
  opts: { productId?: number; baseUrl: string; exec?: Exec; config?: RunConfig; template?: string },
): Promise<RunResult> {
  const product = getProduct(db, opts.productId);
  if (!product) throw new Error("No product to run on. Create one on the Intake page first.");
  const cfg = opts.config ?? runConfig();
  const brief = renderBrief({ productId: product.id, productName: product.name, baseUrl: opts.baseUrl }, opts.template);
  const args = [
    "open-terminal-session",
    "--agent",
    "--agent-name", cfg.agentName,
    "--workspace-slug", cfg.workspaceSlug,
    "--thread-slug", cfg.threadSlug,
    "--requested-by", "Flare",
    "--message", brief,
  ];
  const command = `${cfg.cli} open-terminal-session --agent-name ${cfg.agentName} --workspace-slug ${cfg.workspaceSlug} --thread-slug ${cfg.threadSlug} --message "<brief>"`;

  let result: RunResult;
  if (cfg.disabled) {
    result = { dispatched: false, brief, command, reason: "Dispatch disabled (FLARE_RUN_DISPATCH=off). Copy the brief into an agent thread." };
  } else {
    try {
      const { stdout } = await (opts.exec ?? defaultExec)(cfg.cli, args);
      let session: unknown = stdout.trim();
      try {
        session = JSON.parse(stdout);
      } catch {
        /* plain text output */
      }
      result = { dispatched: true, brief, command, session };
    } catch (e) {
      const err = e as NodeJS.ErrnoException & { stderr?: string };
      const reason =
        err.code === "ENOENT"
          ? `${cfg.cli} not found on this machine's PATH. Copy the brief into a RealTimeX agent thread, or set FLARE_PP_CLI.`
          : `Dispatch failed: ${(err.stderr || err.message || String(e)).trim().slice(0, 300)}`;
      result = { dispatched: false, brief, command, reason };
    }
  }

  logActivity(db, {
    actorKind: "rep",
    tool: "run_agent",
    summary: result.dispatched
      ? `Started GTM agent (${cfg.agentName}) for ${product.name} in thread ${cfg.threadSlug}`
      : `Agent run not dispatched: ${result.reason}`,
    entityType: "product",
    entityId: product.id,
    data: { dispatched: result.dispatched },
  });
  return result;
}
