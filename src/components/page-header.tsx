/** Editorial masthead (Jay's .fl-masthead): eyebrow, a result-stating title, one lede line. */
export function PageHeader({
  kicker,
  title,
  lede,
  children,
}: {
  kicker: string;
  title: string;
  lede?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 px-6 pt-8">
      <div className="fl-masthead" style={{ paddingBottom: "var(--space-6)" }}>
        <p className="fl-masthead__eyebrow">{kicker}</p>
        <h2 className="fl-masthead__title">{title}</h2>
        {lede && <p className="fl-masthead__lede">{lede}</p>}
      </div>
      {children && <div className="flex items-center gap-2 pb-6">{children}</div>}
    </div>
  );
}
