import { confidenceTone, formatConfidence } from "@/lib/client/format";
import { cn } from "@/lib/utils";

/** A value with its 0–1 confidence; tone by threshold (≥.75 high, ≥.5 medium). */
export function ConfidenceChip({ label, confidence }: { label: string; confidence: number }) {
  const tone = confidenceTone(confidence);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border py-0.5 pl-2 pr-1 text-xs",
        tone === "high" && "border-emerald-800/70 bg-emerald-950/40 text-emerald-100",
        tone === "medium" && "border-amber-800/60 bg-amber-950/30 text-amber-100",
        tone === "low" && "border-neutral-700 bg-neutral-900 text-neutral-400",
      )}
      data-tone={tone}
      title={`Confidence ${formatConfidence(confidence)}`}
    >
      {label}
      <span
        className={cn(
          "rounded-sm px-1 font-mono text-[10px] tabular-nums",
          tone === "high" && "bg-emerald-500/20 text-emerald-300",
          tone === "medium" && "bg-amber-500/20 text-amber-300",
          tone === "low" && "bg-neutral-800 text-neutral-500",
        )}
      >
        {confidence.toFixed(2)}
      </span>
    </span>
  );
}
