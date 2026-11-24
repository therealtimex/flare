// Agent-tools registry: every tool has a zod input schema, a manifest entry and
// writes exactly one `activity` row per invocation (success or failure).
import { z } from "zod";
import type { Db } from "../db";
import { logActivity } from "../activity";
import type { ActorKind, EntityType } from "../types";
import { toJsonSchema, type JsonSchema } from "./json-schema";

export interface ToolContext {
  db: Db;
  actorKind: ActorKind;
}

/** What a handler returns: the payload plus what to write in the activity row. */
export interface ToolOutcome<R> {
  result: R;
  summary: string;
  warnings?: string[];
  entityType?: EntityType;
  entityId?: number;
  leadId?: number;
  data?: Record<string, unknown>;
}

export interface ToolDef<S extends z.ZodTypeAny = z.ZodTypeAny, R = unknown> {
  name: string;
  description: string;
  input: S;
  // Method syntax (bivariant params) so tools with different inputs share ToolDef[].
  handler(input: z.infer<S>, ctx: ToolContext): ToolOutcome<R>;
}

/** Thrown by handlers for expected, agent-actionable failures (shown to the agent as-is). */
export class ToolError extends Error {
  constructor(
    message: string,
    public readonly code: string = "tool_error",
  ) {
    super(message);
  }
}

export function defineTool<S extends z.ZodTypeAny, R>(def: ToolDef<S, R>): ToolDef<S, R> {
  return def;
}

export type InvokeResult =
  | { ok: true; tool: string; result: unknown; warnings: string[] }
  | { ok: false; tool: string; error: string; code: string; issues?: unknown };

export function manifest(tools: ToolDef[]): { name: string; description: string; inputSchema: JsonSchema }[] {
  return tools.map((t) => ({ name: t.name, description: t.description, inputSchema: toJsonSchema(t.input) }));
}

export function invoke(
  tools: ToolDef[],
  db: Db,
  name: string,
  rawInput: unknown,
  actorKind: ActorKind = "agent",
): InvokeResult {
  const tool = tools.find((t) => t.name === name);
  if (!tool) {
    const known = tools.map((t) => t.name).join(", ");
    return { ok: false, tool: name, code: "unknown_tool", error: `Unknown tool "${name}". Known tools: ${known}` };
  }
  const parsed = tool.input.safeParse(rawInput ?? {});
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ");
    logActivity(db, { actorKind, tool: name, summary: `rejected: ${msg}`, data: { error: "invalid_input" } });
    return { ok: false, tool: name, code: "invalid_input", error: msg, issues: parsed.error.issues };
  }
  try {
    const out = db.transaction(() => {
      const o = tool.handler(parsed.data, { db, actorKind });
      logActivity(db, {
        actorKind,
        tool: name,
        summary: o.summary,
        entityType: o.entityType,
        entityId: o.entityId,
        leadId: o.leadId,
        data: { ...(o.data ?? {}), ...(o.warnings?.length ? { warnings: o.warnings } : {}) },
      });
      return o;
    });
    return { ok: true, tool: name, result: out.result, warnings: out.warnings ?? [] };
  } catch (e) {
    const code = e instanceof ToolError ? e.code : "internal_error";
    const error = e instanceof Error ? e.message : String(e);
    logActivity(db, { actorKind, tool: name, summary: `failed: ${error}`, data: { error: code } });
    return { ok: false, tool: name, code, error };
  }
}
