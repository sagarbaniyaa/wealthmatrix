import { formatCurrency } from '@/lib/format';

// Two-bar comparison (baseline vs projected net worth) — a magnitude
// comparison of two values doesn't need a charting library. Neutral tone
// for baseline, the app's brass accent for projected (identity, not
// rank), with the delta direct-labelled so colour is never the only
// signal of direction.
export function NetWorthComparisonChart({
  baseline, projected, currencyCode = 'GBP',
}: { baseline: number; projected: number; currencyCode?: string }) {
  const max = Math.max(baseline, projected, 1);
  const baselinePct = Math.max((baseline / max) * 100, 2);
  const projectedPct = Math.max((projected / max) * 100, 2);
  const delta = projected - baseline;
  const deltaTone = delta >= 0 ? 'text-verdigris-400' : 'text-rust-400';

  return (
    <div className="space-y-4">
      <BarRow label="Baseline" value={baseline} pct={baselinePct} currencyCode={currencyCode} colorClass="bg-ink-500" />
      <BarRow label="Projected" value={projected} pct={projectedPct} currencyCode={currencyCode} colorClass="bg-brass-500" />
      <p className={`text-sm font-medium ${deltaTone}`}>
        {delta >= 0 ? '+' : ''}{formatCurrency(delta, currencyCode)} net worth change
      </p>
    </div>
  );
}

function BarRow({ label, value, pct, currencyCode, colorClass }: {
  label: string; value: number; pct: number; currencyCode: string; colorClass: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="uppercase tracking-wide text-ink-300">{label}</span>
        <span className="figure text-ink-100">{formatCurrency(value, currencyCode)}</span>
      </div>
      <div className="h-3 w-full rounded-full bg-ink-800" title={formatCurrency(value, currencyCode)}>
        <div className={`h-3 rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
