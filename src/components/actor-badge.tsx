import { Bot, User } from "lucide-react";
import type { ActorKind } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ActorBadge({ kind, className }: { kind: ActorKind; className?: string }) {
  const Icon = kind === "agent" ? Bot : User;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-px font-mono text-[10px] uppercase tracking-wider",
        kind === "agent" ? "bg-accent/15 text-accent" : "bg-muted/15 text-muted",
        className,
      )}
      data-actor={kind}
    >
      <Icon className="size-3" aria-hidden />
      {kind}
    </span>
  );
}
