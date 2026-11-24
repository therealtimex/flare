// UI-only view shapes layered over src/lib/types.ts (core-dev owns that file).

export type RunResult =
  | { ok: true; mode: "dispatched"; brief: string }
  | { ok: true; mode: "fallback"; brief: string; reason: string }
  | { ok: false; error: string };
