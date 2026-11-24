// Small helpers for UI route handlers.
import { NextResponse } from "next/server";
import { ActionError } from "./actions";

export async function handle(fn: () => unknown | Promise<unknown>): Promise<NextResponse> {
  try {
    return NextResponse.json(await fn());
  } catch (e) {
    if (e instanceof ActionError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ActionError("Body must be JSON", 400);
  }
}

export function intParam(v: string | null | undefined, name: string): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new ActionError(`${name} must be a positive integer`, 400);
  return n;
}

export function requireInt(v: string | null | undefined, name: string): number {
  const n = intParam(v, name);
  if (n === undefined) throw new ActionError(`${name} is required`, 400);
  return n;
}
