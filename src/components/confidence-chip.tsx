import { confidenceTone, formatConfidence } from "@/lib/client/format";

/** 0–1 confidence shown as Jay's EnrichmentCell confidence (number + bar); low (<0.5) turns caution. */
export function ConfidenceChip({ confidence }: { confidence: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, confidence)) * 100);
  const tone = confidenceTone(confidence);
  return (
    <span className="fl-conf" style={{ ["--v" as string]: pct }} data-level={pct < 50 ? "low" : undefined} data-tone={tone} data-testid="confidence-chip" title={`Confidence ${formatConfidence(confidence)}`}>
      {confidence.toFixed(2)}
    </span>
  );
}
