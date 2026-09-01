import type { RetirementCashflowYear } from '@/lib/types';

/**
 * A classic Monte Carlo "fan chart" — a shaded 10th-90th percentile band
 * plus the median path, drawn as raw SVG (no charting library, same
 * approach as every other chart in this app). The band is what actually
 * matters here: a probability model whose only visible output was a
 * single median line would misrepresent it as a forecast rather than a
 * distribution of outcomes.
 */
export function RetirementFanChart({ series, retirementAge }: { series: RetirementCashflowYear[]; retirementAge: number }) {
  if (series.length < 2) return null;

  const width = 640;
  const height = 280;
  const margin = { top: 16, right: 16, bottom: 28, left: 64 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const minAge = series[0].age;
  const maxAge = series[series.length - 1].age;
  const maxValue = Math.max(...series.map((p) => p.p90), 1);

  const x = (age: number) => margin.left + ((age - minAge) / (maxAge - minAge)) * innerWidth;
  const y = (value: number) => margin.top + innerHeight - (value / maxValue) * innerHeight;

  const topPath = series.map((p) => `${x(p.age)},${y(p.p90)}`).join(' L ');
  const bottomPath = [...series].reverse().map((p) => `${x(p.age)},${y(p.p10)}`).join(' L ');
  const bandPath = `M ${topPath} L ${bottomPath} Z`;
  const medianPoints = series.map((p) => `${x(p.age)},${y(p.p50)}`).join(' ');

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxValue);
  const ageStep = maxAge - minAge <= 15 ? 2 : Math.ceil((maxAge - minAge) / 10);
  const xTicks = series.map((p) => p.age).filter((age) => (age - minAge) % ageStep === 0);

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
        {xTicks.map((age) => (
          <text key={age} x={x(age)} y={height - margin.bottom + 16} textAnchor="middle" className="fill-ink-500 font-mono" style={{ fontSize: 9 }}>
            {age}
          </text>
        ))}
        {retirementAge >= minAge && retirementAge <= maxAge && (
          <line x1={x(retirementAge)} x2={x(retirementAge)} y1={margin.top} y2={height - margin.bottom} stroke="currentColor" className="text-brass-500/50" strokeWidth={1} strokeDasharray="4 3" />
        )}
        <path d={bandPath} className="fill-verdigris-500/15" stroke="none" />
        <polyline points={medianPoints} fill="none" className="text-verdigris-400" stroke="currentColor" strokeWidth={2} />
      </svg>
      <div className="mt-2 flex items-center gap-4 text-xs text-ink-400">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-verdigris-500/30" /> 10th–90th percentile range</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-verdigris-500" /> Median outcome</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-0.5 bg-brass-500/60" /> Retirement age</span>
      </div>
    </div>
  );
}

function formatShort(n: number): string {
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `£${Math.round(n / 1_000)}k`;
  return `£${Math.round(n)}`;
}
