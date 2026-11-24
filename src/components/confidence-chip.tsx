import { confidenceTone, formatConfidence } from "@/lib/client/format";
import { cn } from "@/lib/utils";

/** A 0–1 confidence chip; tone by threshold (≥.75 high, ≥.5 medium, else low). */
export function ConfidenceChip({ confidence, label }: { confidence: number; label?: string }) {
  const tone = confidenceTone(confidence);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 font-mono text-[11px] tabular-nums",
        tone === "high" && "border-success/40 bg-success/10 text-success",
        tone === "medium" && "border-warning/40 bg-warning/10 text-warning",
        tone === "low" && "border-border-subtle bg-surface-raised text-muted",
      )}
      data-tone={tone}
      data-testid="confidence-chip"
      title={`Confidence ${formatConfidence(confidence)}`}
    >
      <span className="uppercase tracking-wider">{label ?? tone}</span>
      <span>{confidence.toFixed(2)}</span>
    </span>
  );
}
