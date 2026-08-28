import type { FundPerformance } from '@/lib/types';

const PERIOD_ORDER = ['YTD', '1Y', '3Y', '5Y'] as const;

// Same reasoning as NetWorthComparisonChart: a handful of labelled bars
// (one per period) doesn't need a charting library. Colour is fixed to
// the brass accent for every bar (identity is the period label, not a
// second colour dimension), direction shown via sign on the number itself.
export function FundPerformanceChart({ performance }: { performance: FundPerformance[] }) {
  const byPeriod = new Map(performance.map((p) => [p.period, Number(p.returnPct)]));
  const values = PERIOD_ORDER.map((period) => ({ period, value: byPeriod.get(period) }));
  const present = values.filter((v) => v.value !== undefined) as { period: string; value: number }[];

  if (present.length === 0) {
    return <p className="text-sm text-ink-400">No performance data recorded for this fund yet.</p>;
  }

  const maxAbs = Math.max(...present.map((v) => Math.abs(v.value)), 1);

  return (
    <div className="space-y-3">
      {values.map(({ period, value }) => {
        if (value === undefined) return null;
        const pct = Math.max((Math.abs(value) / maxAbs) * 100, 2);
        const positive = value >= 0;
        return (
          <div key={period}>
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="uppercase tracking-wide text-ink-300">{period}</span>
              <span className={`figure ${positive ? 'text-verdigris-400' : 'text-rust-400'}`}>{positive ? '+' : ''}{value.toFixed(2)}%</span>
            </div>
            <div className="h-3 w-full rounded-full bg-ink-800" title={`${period}: ${value.toFixed(2)}%`}>
              <div className={`h-3 rounded-full ${positive ? 'bg-verdigris-500' : 'bg-rust-500'}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
