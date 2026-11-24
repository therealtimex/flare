"use client";
import { Activity as ActivityIcon, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ActorBadge } from "@/components/actor-badge";
import { formatRelativeTime } from "@/lib/client/format";
import { useActivity } from "@/lib/client/hooks";

export function AgentThinking({ onClose }: { onClose: () => void }) {
  const { data, error } = useActivity();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <aside
      className="flex h-full w-80 shrink-0 flex-col border-l border-neutral-800 bg-neutral-950"
      aria-label="Agent Thinking"
      data-testid="agent-thinking"
    >
      <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--color-flare)] opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-[var(--color-flare)]" />
          </span>
          <h2 className="font-mono text-xs uppercase tracking-widest text-neutral-300">Agent Thinking</h2>
          <span className="font-mono text-[10px] text-neutral-600">{data?.length ?? 0}</span>
        </div>
        <button type="button" onClick={onClose} className="text-neutral-500 hover:text-white" aria-label="Collapse Agent Thinking">
          <X className="size-4" />
        </button>
      </div>
      {error && <p className="px-3 py-2 font-mono text-xs text-red-400">Activity unavailable: {error}</p>}
      <ol className="flex-1 overflow-y-auto">
        {data?.length === 0 && (
          <li className="flex items-center gap-2 px-3 py-6 text-xs text-neutral-500">
            <ActivityIcon className="size-4" aria-hidden /> No activity yet. Run the GTM agent from Intake.
          </li>
        )}
        {data?.map((a) => (
          <li key={a.id} className="border-b border-neutral-900 px-3 py-2 text-xs" data-testid="activity-row">
            <div className="flex items-center gap-2">
              <ActorBadge kind={a.actorKind} />
              <code className="truncate font-mono text-[11px] text-neutral-300">{a.tool}</code>
              <time className="ml-auto shrink-0 font-mono text-[10px] text-neutral-600" dateTime={a.createdAt} title={a.createdAt}>
                {formatRelativeTime(a.createdAt, now)}
              </time>
            </div>
            <p className="mt-1 leading-snug text-neutral-400">{a.summary}</p>
          </li>
        ))}
      </ol>
    </aside>
  );
}
