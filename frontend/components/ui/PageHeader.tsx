export function PageHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-8 flex items-end justify-between">
      <div>
        {eyebrow && <p className="font-mono text-xs uppercase tracking-[0.2em] text-brass-400">{eyebrow}</p>}
        <h1 className="mt-1 font-display text-2xl text-ink-100">{title}</h1>
      </div>
      {action}
    </div>
  );
}
