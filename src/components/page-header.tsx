export function PageHeader({ kicker, title, children }: { kicker: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-neutral-800 px-6 pb-4 pt-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-neutral-500">{kicker}</p>
        <h2 className="mt-1 font-serif text-2xl tracking-tight">{title}</h2>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
