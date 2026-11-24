// Pure UI helpers (no React), unit-tested in format.test.ts.

export type ConfidenceTone = "high" | "medium" | "low";

export function confidenceTone(c: number): ConfidenceTone {
  if (c >= 0.75) return "high";
  if (c >= 0.5) return "medium";
  return "low";
}

/** 0.856 → "86%"; clamps to 0–100. */
export function formatConfidence(c: number): string {
  const pct = Math.round(Math.min(1, Math.max(0, c)) * 100);
  return `${pct}%`;
}

/** "12s ago", "4m ago", "2h ago", or a short date for older items. */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, Math.round((now.getTime() - t) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** 24-hour "HH:MM:SS" for Agent thinking entries; "" for a bad date. */
export function formatClock(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("en-GB", { hour12: false });
}

/** Credits meter fill 0–1 and a tone for low balances. */
export function creditsLevel(balance: number, allotment: number): { fill: number; tone: "ok" | "low" | "empty" } {
  const fill = allotment > 0 ? Math.min(1, Math.max(0, balance / allotment)) : 0;
  if (balance <= 0) return { fill: 0, tone: "empty" };
  if (fill < 0.2) return { fill, tone: "low" };
  return { fill, tone: "ok" };
}

/** Hostname for a citation link label, falling back to the raw URL. */
export function sourceLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Fallback brief when POST /api/runs can't dispatch the terminal agent. */
export function renderFallbackBrief(productId: number | string, baseUrl: string): string {
  return [
    `Run the Flare GTM agent for product ${productId}.`,
    ``,
    `Base URL: ${baseUrl}`,
    `Tools: GET ${baseUrl}/api/agent-tools (manifest), POST ${baseUrl}/api/agent-tools/invoke {tool, input}.`,
    `Follow agent/SKILL.md: get_product → save_icp (with confidence per field and cited expansions) → discover accounts/people with sources → upsert_lead → draft_message.`,
    `Every account, person and signal needs at least one source URL. Never send outreach: drafts wait for human approval.`,
  ].join("\n");
}

/** 0–1 rate → "42%"; "—" when there is no denominator. */
export function formatRate(rate: number | null | undefined, denominator?: number): string {
  if (rate == null || denominator === 0) return "—";
  return `${Math.round(Math.min(1, Math.max(0, rate)) * 100)}%`;
}

/** Below this many leads per arm, an A/B difference is not called. */
export const MIN_SAMPLE = 20;
