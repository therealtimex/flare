"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelRightOpen } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { AgentThinking } from "./agent-thinking";
import { CreditsMeter } from "./credits-meter";
import { NAV_ITEMS } from "./nav-items";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [thinkingOpen, setThinkingOpen] = useState(true);

  return (
    <div className="flex h-dvh flex-col">
      <header className="border-b border-border-subtle">
        <div className="flex items-end justify-between gap-6 px-6 pb-3 pt-5">
          <Link href="/intake" className="group">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">Flare · AI GTM engine</p>
            <h1 className="mt-1 font-serif text-3xl leading-none tracking-tight">
              Signals in, <em className="text-muted">pipeline out.</em>
            </h1>
          </Link>
          <div className="flex items-end gap-4">
            <CreditsMeter />
            {!thinkingOpen && (
              <button
                type="button"
                onClick={() => setThinkingOpen(true)}
                className="inline-flex items-center gap-1.5 rounded border border-border-subtle px-2 py-1 font-mono text-xs text-current hover:text-accent"
              >
                <PanelRightOpen className="size-3.5" aria-hidden /> Agent Thinking
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
                  className="cursor-not-allowed border-b-2 border-transparent px-3 py-2 text-sm text-muted/60"
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
                  active ? "border-accent" : "border-transparent text-muted hover:text-accent",
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
