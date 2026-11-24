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
          <Coins className="size-3.5 self-center text-neutral-500" aria-hidden />
          <span
            className={cn(
              "tabular-nums text-sm",
              tone === "ok" && "text-neutral-100",
              tone === "low" && "text-amber-400",
              tone === "empty" && "text-red-400",
            )}
            data-testid="credits-balance"
          >
            {data ? balance.toLocaleString() : "—"}
          </span>
          <span className="text-neutral-500">credits</span>
        </div>
        <div
          className="h-1 w-28 overflow-hidden rounded-full bg-neutral-800"
          role="meter"
          aria-label="Credits remaining"
          aria-valuemin={0}
          aria-valuemax={data?.allotment ?? 0}
          aria-valuenow={balance}
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width]",
              tone === "ok" && "bg-[var(--color-flare)]",
              tone === "low" && "bg-amber-400",
              tone === "empty" && "bg-red-500",
            )}
            style={{ width: `${fill * 100}%` }}
          />
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-600">
          Flexprice: {data?.flexprice === "configured" ? "metering" : "not configured"}
        </span>
      </div>
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded border border-neutral-700 px-2 py-1 font-mono text-xs text-neutral-300 hover:border-[var(--color-flare)] hover:text-white"
          >
            <Plus className="size-3" aria-hidden /> Top up
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="end"
            sideOffset={6}
            className="z-50 w-48 rounded border border-neutral-800 bg-neutral-900 p-2 shadow-xl"
          >
            <p className="px-1 pb-2 font-mono text-[10px] uppercase tracking-wider text-neutral-500">Add credits (demo)</p>
            <div className="grid grid-cols-3 gap-1">
              {TOP_UPS.map((n) => (
                <Popover.Close asChild key={n}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => topUp(n)}
                    className="rounded bg-neutral-800 py-1 font-mono text-xs tabular-nums hover:bg-[var(--color-flare)] hover:text-black disabled:opacity-50"
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
