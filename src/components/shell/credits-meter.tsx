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
        <div className="data flex items-baseline gap-1.5">
          <Coins className="size-3.5 self-center text-ink-muted" aria-hidden />
          <span
            className={cn(
              "tabular-nums text-sm",
              tone === "ok" && "text-current",
              tone === "low" && "text-caution",
              tone === "empty" && "text-negative",
            )}
            data-testid="credits-balance"
          >
            {data ? balance.toLocaleString() : "—"}
          </span>
          <span className="text-ink-muted">credits</span>
        </div>
        <div
          className="h-1 w-28 overflow-hidden rounded-full bg-line"
          role="meter"
          aria-label="Credits remaining"
          aria-valuemin={0}
          aria-valuemax={data?.allotment ?? 0}
          aria-valuenow={balance}
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width]",
              tone === "ok" && "bg-ink-muted",
              tone === "low" && "bg-caution",
              tone === "empty" && "bg-negative",
            )}
            style={{ width: `${fill * 100}%` }}
          />
        </div>
        <span className="label whitespace-nowrap text-ink-faint">
          Flexprice: {data?.flexprice === "configured" ? "metering" : "not configured"}
        </span>
      </div>
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="fl-btn fl-btn--secondary fl-btn--sm"
          >
            <Plus aria-hidden /> Top up
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="end"
            sideOffset={6}
            className="z-50 w-56 rounded-lg border border-line bg-surface-1 p-3"
            style={{ boxShadow: "var(--shadow-overlay)" }}
          >
            <p className="label pb-2 text-ink-muted">Add credits (demo)</p>
            <div className="grid grid-cols-3 gap-1">
              {TOP_UPS.map((n) => (
                <Popover.Close asChild key={n}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => topUp(n)}
                    className="fl-btn fl-btn--secondary fl-btn--sm"
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
