"use client";
import { Popover } from "radix-ui";
import { Coins, Plus } from "lucide-react";
import { useState } from "react";
import { topUpCredits } from "@/lib/client/api";
import { creditsLevel } from "@/lib/client/format";
import { useCredits } from "@/lib/client/hooks";
import { cn } from "@/lib/utils";

const TOP_UPS = [100, 250, 500];

export function CreditsMeter() {
  const { data } = useCredits();
  const [busy, setBusy] = useState(false);
  const balance = data?.balance ?? 0;
  const { fill, tone } = creditsLevel(balance, data?.allotment ?? 0);

  async function topUp(n: number) {
    setBusy(true);
    try {
      await topUpCredits(n);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3" data-testid="credits-meter">
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-baseline gap-1.5 font-mono text-xs">
          <Coins className="size-3.5 self-center text-muted" aria-hidden />
          <span
            className={cn(
              "tabular-nums text-sm",
              tone === "ok" && "text-current",
              tone === "low" && "text-warning",
              tone === "empty" && "text-danger",
            )}
            data-testid="credits-balance"
          >
            {data ? balance.toLocaleString() : "—"}
          </span>
          <span className="text-muted">credits</span>
        </div>
        <div
          className="h-1 w-28 overflow-hidden rounded-full bg-border-subtle"
          role="meter"
          aria-label="Credits remaining"
          aria-valuemin={0}
          aria-valuemax={data?.allotment ?? 0}
          aria-valuenow={balance}
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width]",
              tone === "ok" && "bg-accent",
              tone === "low" && "bg-warning",
              tone === "empty" && "bg-danger",
            )}
            style={{ width: `${fill * 100}%` }}
          />
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted/60">
          Flexprice: {data?.flexprice === "configured" ? "metering" : "not configured"}
        </span>
      </div>
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded border border-border-subtle px-2 py-1 font-mono text-xs text-current hover:border-accent hover:text-accent"
          >
            <Plus className="size-3" aria-hidden /> Top up
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="end"
            sideOffset={6}
            className="z-50 w-48 rounded border border-border-subtle bg-surface-raised p-2 shadow-xl"
          >
            <p className="px-1 pb-2 font-mono text-[10px] uppercase tracking-wider text-muted">Add credits (demo)</p>
            <div className="grid grid-cols-3 gap-1">
              {TOP_UPS.map((n) => (
                <Popover.Close asChild key={n}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => topUp(n)}
                    className="rounded bg-border-subtle py-1 font-mono text-xs tabular-nums hover:bg-accent hover:text-surface disabled:opacity-50"
                  >
                    +{n}
                  </button>
                </Popover.Close>
              ))}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
