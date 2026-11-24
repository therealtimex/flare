import { Bot, User } from "lucide-react";
import type { ActorKind } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Agent vs rep attribution: icon + word, no orange (orange is reserved for decisions). */
export function ActorBadge({ kind, className }: { kind: ActorKind; className?: string }) {
  const Icon = kind === "agent" ? Bot : User;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 font-mono text-[10px] uppercase leading-4 tracking-wider",
        kind === "agent" ? "border-info/40 text-info" : "border-line-strong text-ink",
        className,
      )}
      data-actor={kind}
    >
      <Icon className="size-3" aria-hidden />
      {kind}
    </span>
  );
}
