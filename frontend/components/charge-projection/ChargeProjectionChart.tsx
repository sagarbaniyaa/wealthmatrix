import type { ChargeProjectionYear } from '@/lib/types';

/**
 * A small original SVG line chart — no charting library, same approach as
 * FundPerformanceChart/NetWorthComparisonChart elsewhere in this app.
 * Two series (old arrangement vs new arrangement) sharing one y-scale so
 * the gap between them is directly readable as the charge-driven
 * divergence, not an axis-scaling illusion.
 */
export function ChargeProjectionChart({ series }: { series: ChargeProjectionYear[] }) {
  if (series.length < 2) return null;

  const width = 640;
  const height = 260;
  const margin = { top: 16, right: 16, bottom: 28, left: 64 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const maxYear = series[series.length - 1].year;
  const maxValue = Math.max(...series.map((p) => Math.max(p.oldValue, p.newValue)), 1);

  const x = (year: number) => margin.left + (year / maxYear) * innerWidth;
  const y = (value: number) => margin.top + innerHeight - (value / maxValue) * innerHeight;

  const oldPoints = series.map((p) => `${x(p.year)},${y(p.oldValue)}`).join(' ');
  const newPoints = series.map((p) => `${x(p.year)},${y(p.newValue)}`).join(' ');

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxValue);
  const yearStep = maxYear <= 10 ? 1 : Math.ceil(maxYear / 10);
  const xTicks = series.map((p) => p.year).filter((yr) => yr % yearStep === 0);

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
        {yTicks.map((tick) => (
          <g key={tick}>
            <line x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} stroke="currentColor" className="text-ink-800" strokeWidth={1} />
            <text x={margin.left - 8} y={y(tick)} textAnchor="end" dominantBaseline="middle" className="fill-ink-500 font-mono" style={{ fontSize: 9 }}>
              {formatShort(tick)}
            </text>
          </g>
        ))}
        {xTicks.map((yr) => (
          <text key={yr} x={x(yr)} y={height - margin.bottom + 16} textAnchor="middle" className="fill-ink-500 font-mono" style={{ fontSize: 9 }}>
            Y{yr}
          </text>
        ))}
        <polyline points={oldPoints} fill="none" className="text-rust-400" stroke="currentColor" strokeWidth={2} />
        <polyline points={newPoints} fill="none" className="text-verdigris-400" stroke="currentColor" strokeWidth={2} />
      </svg>
      <div className="mt-2 flex items-center gap-4 text-xs text-ink-400">
        <Legend colorClass="bg-rust-500" label="Old arrangement" />
        <Legend colorClass="bg-verdigris-500" label="New arrangement" />
      </div>
    </div>
  );
}

function Legend({ colorClass, label }: { colorClass: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${colorClass}`} />
      {label}
    </span>
  );
}

function formatShort(n: number): string {
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `£${Math.round(n / 1_000)}k`;
  return `£${Math.round(n)}`;
}
