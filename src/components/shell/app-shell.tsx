"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelRightOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { AgentThinking } from "./agent-thinking";
import { CreditsMeter } from "./credits-meter";
import { NAV_ITEMS } from "./nav-items";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [thinkingOpen, setThinkingOpen] = useState(true);
  // Below 1300px the 360px feed squeezes the grids; start collapsed there (the header button reopens it).
  useEffect(() => {
    if (window.innerWidth < 1300) setThinkingOpen(false);
  }, []);

  return (
    <div className="flex h-dvh flex-col">
      <header className="border-b border-line">
        <div className="flex items-end justify-between gap-6 px-6 pb-3 pt-4">
          <Link href="/intake" className="flex items-end gap-4" aria-label="Flare home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/flare-lockup-reverse.svg" alt="Flare" width={96} height={47} className="h-9 w-auto" />
            <span className="label hidden pb-1 text-ink-muted xl:inline">AI GTM engine · intake → ICP → cited leads → approved outreach → pipeline</span>
          </Link>
          <div className="flex items-end gap-4">
            <CreditsMeter />
            {!thinkingOpen && (
              <button
                type="button"
                onClick={() => setThinkingOpen(true)}
                className="fl-btn fl-btn--ghost fl-btn--sm"
              >
                <PanelRightOpen aria-hidden /> Agent thinking
              </button>
            )}
          </div>
        </div>
        <nav className="flex gap-1 px-4" aria-label="Main">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            if (item.soon) {
              return (
                <span
                  key={item.href}
                  aria-disabled="true"
                  title="Coming soon"
                  className="cursor-not-allowed border-b-2 border-transparent px-3 py-2 text-sm text-ink-faint"
                >
                  {item.label}
                </span>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "border-b-2 px-3 py-2 text-sm transition-colors",
                  active ? "border-flare" : "border-transparent text-ink-muted hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
        {thinkingOpen && <AgentThinking onClose={() => setThinkingOpen(false)} />}
      </div>
    </div>
  );
}
