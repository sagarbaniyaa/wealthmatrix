export function StatTile({
  label, value, tone = 'neutral',
}: { label: string; value: string; tone?: 'neutral' | 'positive' | 'negative' }) {
  const toneClass =
    tone === 'positive' ? 'text-verdigris-400' : tone === 'negative' ? 'text-rust-400' : 'text-ink-100';
  return (
    <div className="border-l-2 border-brass-500/40 pl-4">
      <p className="text-xs uppercase tracking-wide text-ink-300">{label}</p>
      <p className={`figure mt-1 text-2xl ${toneClass}`}>{value}</p>
    </div>
  );
}
