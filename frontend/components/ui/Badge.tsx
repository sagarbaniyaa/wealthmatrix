const TONES: Record<string, string> = {
  info: 'bg-ink-700 text-ink-100',
  warning: 'bg-brass-500/20 text-brass-400',
  breach: 'bg-rust-500/20 text-rust-400',
  positive: 'bg-verdigris-500/20 text-verdigris-400',
  draft: 'bg-ink-700 text-ink-300',
  complete: 'bg-verdigris-500/20 text-verdigris-400',
  running: 'bg-brass-500/20 text-brass-400',
  failed: 'bg-rust-500/20 text-rust-400',
};

export function Badge({ tone = 'info', children }: { tone?: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${TONES[tone] ?? TONES.info}`}>
      {children}
    </span>
  );
}
