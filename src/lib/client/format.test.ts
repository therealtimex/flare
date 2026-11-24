import { describe, expect, it } from "vitest";
import {
  confidenceTone,
  creditsLevel,
  formatConfidence,
  formatRelativeTime,
  renderFallbackBrief,
  sourceLabel,
} from "./format";

describe("confidence", () => {
  it("maps to tones at 0.75 / 0.5", () => {
    expect(confidenceTone(0.9)).toBe("high");
    expect(confidenceTone(0.75)).toBe("high");
    expect(confidenceTone(0.6)).toBe("medium");
    expect(confidenceTone(0.49)).toBe("low");
  });
  it("formats as clamped percent", () => {
    expect(formatConfidence(0.856)).toBe("86%");
    expect(formatConfidence(1.4)).toBe("100%");
    expect(formatConfidence(-1)).toBe("0%");
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-11-24T20:00:00.000Z");
  it("formats seconds, minutes, hours", () => {
    expect(formatRelativeTime("2026-11-24T19:59:58.000Z", now)).toBe("just now");
    expect(formatRelativeTime("2026-11-24T19:59:30.000Z", now)).toBe("30s ago");
    expect(formatRelativeTime("2026-11-24T19:55:00.000Z", now)).toBe("5m ago");
    expect(formatRelativeTime("2026-11-24T17:00:00.000Z", now)).toBe("3h ago");
  });
  it("returns empty for invalid input", () => {
    expect(formatRelativeTime("nope", now)).toBe("");
  });
});

describe("creditsLevel", () => {
  it("flags low and empty balances", () => {
    expect(creditsLevel(400, 500)).toEqual({ fill: 0.8, tone: "ok" });
    expect(creditsLevel(50, 500).tone).toBe("low");
    expect(creditsLevel(0, 500)).toEqual({ fill: 0, tone: "empty" });
    expect(creditsLevel(-5, 500).tone).toBe("empty");
  });
});

describe("sourceLabel", () => {
  it("returns the hostname without www", () => {
    expect(sourceLabel("https://www.example.com/a/b")).toBe("example.com");
    expect(sourceLabel("not a url")).toBe("not a url");
  });
});

describe("renderFallbackBrief", () => {
  it("includes product id, base URL and the HITL rule", () => {
    const b = renderFallbackBrief("prod_1", "http://localhost:3020");
    expect(b).toContain("prod_1");
    expect(b).toContain("http://localhost:3020/api/agent-tools");
    expect(b).toMatch(/human approval/);
  });
});

describe("formatRate", () => {
  it("formats fractions and hides rates with no denominator", async () => {
    const { formatRate } = await import("./format");
    expect(formatRate(0.416)).toBe("42%");
    expect(formatRate(0, 0)).toBe("—");
    expect(formatRate(null)).toBe("—");
    expect(formatRate(1.2, 5)).toBe("100%");
  });
});
