// "Run GTM agent": render agent/BRIEF.md and open a RealTimeX terminal session
// with it via realtimex-pp-cli. If the CLI is missing or fails, return the brief
// so the UI can show it with a Copy button (fallback).
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Db } from "./db";
import { logActivity } from "./activity";
import { balanceOf } from "./metering";
import { getProduct } from "./queries";
import type { RunResponse } from "./types";

export interface RunConfig {
  cli: string;
  agentName: string;
  workspaceSlug: string;
  threadSlug: string;
  /** How the brief reaches the agent. "launch-args" passes it as the prompt argument, so it is
   * submitted reliably; "" uses the CLI default (typed into the TUI, which raced in the dry run). */
  firstTurnDelivery: string;
  disabled: boolean;
}

export function runConfig(env: Record<string, string | undefined> = process.env): RunConfig {
  return {
    cli: env.FLARE_PP_CLI || "realtimex-pp-cli",
    agentName: env.FLARE_AGENT_NAME || "claude",
    workspaceSlug: env.FLARE_RTX_WORKSPACE || "hackwithbay4",
    threadSlug: env.FLARE_RTX_THREAD || "flare-agent",
    firstTurnDelivery: env.FLARE_FIRST_TURN_DELIVERY ?? "launch-args",
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

export type RunResult = RunResponse;

export class RunError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export async function dispatchRun(
  db: Db,
  opts: { productId?: number; baseUrl: string; exec?: Exec; config?: RunConfig; template?: string },
): Promise<RunResult> {
  const product = getProduct(db, opts.productId);
  if (!product) throw new RunError("No product to run on. Create one on the Intake page first.", 404);
  if (balanceOf(db) <= 0) {
    logActivity(db, { actorKind: "rep", tool: "run_agent", summary: "Agent run blocked: out of credits. Top up to run.", entityType: "product", entityId: product.id, data: { dispatched: false, error: "insufficient_credits" } });
    throw new RunError("Out of credits. Top up to run the agent.", 402);
  }
  const cfg = opts.config ?? runConfig();
  const brief = renderBrief({ productId: product.id, productName: product.name, baseUrl: opts.baseUrl }, opts.template);
  const args = [
    "open-terminal-session",
    "--agent",
    "--agent-name", cfg.agentName,
    "--workspace-slug", cfg.workspaceSlug,
    "--thread-slug", cfg.threadSlug,
    "--requested-by", "Flare",
    ...(cfg.firstTurnDelivery ? ["--first-turn-delivery", cfg.firstTurnDelivery] : []),
    "--message", brief,
  ];
  const command = `${cfg.cli} open-terminal-session --agent-name ${cfg.agentName} --workspace-slug ${cfg.workspaceSlug} --thread-slug ${cfg.threadSlug} --message "<brief>"`;

  let result: RunResult;
  if (cfg.disabled) {
    result = { mode: "fallback", dispatched: false, brief, command, reason: "Dispatch disabled (FLARE_RUN_DISPATCH=off). Copy the brief into an agent thread." };
  } else {
    try {
      const { stdout } = await (opts.exec ?? defaultExec)(cfg.cli, args);
      let session: unknown = stdout.trim();
      try {
        session = JSON.parse(stdout);
      } catch {
        /* plain text output */
      }
      result = { mode: "dispatched", dispatched: true, brief, command, session };
    } catch (e) {
      const err = e as NodeJS.ErrnoException & { stderr?: string };
      const reason =
        err.code === "ENOENT"
          ? `${cfg.cli} not found on this machine's PATH. Copy the brief into a RealTimeX agent thread, or set FLARE_PP_CLI.`
          : `Dispatch failed: ${(err.stderr || err.message || String(e)).trim().slice(0, 300)}`;
      result = { mode: "fallback", dispatched: false, brief, command, reason };
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
