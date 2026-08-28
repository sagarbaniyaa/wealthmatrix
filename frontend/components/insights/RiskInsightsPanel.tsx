'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';

interface RiskMetric {
  value: number | null;
  color: 'green' | 'yellow' | 'red' | 'neutral';
  label: string;
  note: string | null;
}

interface HouseholdRiskMetrics {
  householdId: string;
  asOfDate: string;
  totalGrossAssets: number;
  totalGrossLiabilities: number;
  leverage: RiskMetric;
  concentration: RiskMetric;
  liquidity: RiskMetric;
  currencyExposure: RiskMetric;
  suitabilityDrift: RiskMetric;
  aiError: string | null;
}

const COLOR_DOT: Record<RiskMetric['color'], string> = {
  green: 'bg-verdigris-400', yellow: 'bg-brass-400', red: 'bg-rust-400', neutral: 'bg-ink-500',
};

// AI Wealth Analyst panel: five deterministically-computed risk metrics,
// each with a colour code and a short AI-generated note. The maths never
// depends on Claude — if the narrative call fails (e.g. no billing
// credit), the metrics still render with their real numbers; only the
// note falls back to a plain explanation of why it's missing.
export function RiskInsightsPanel({ householdId }: { householdId: string }) {
  const [data, setData] = useState<HouseholdRiskMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.post<HouseholdRiskMetrics>(`ai/risk-metrics/${householdId}`)
      .then((res) => { if (!cancelled) setData(res); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load insights.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [householdId]);

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-ink-300">AI Wealth Analyst — risk insights</p>
        {data && <Badge tone="info">as of {data.asOfDate}</Badge>}
      </div>

      {loading && <p className="text-sm text-ink-300">Computing risk metrics…</p>}
      {error && <p className="text-sm text-rust-400">{error}</p>}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <MetricTile metric={data.leverage} suffix="%" />
            <MetricTile metric={data.concentration} suffix="%" />
            <MetricTile metric={data.liquidity} suffix="%" />
            <MetricTile metric={data.currencyExposure} suffix="%" />
            <MetricTile metric={data.suitabilityDrift} suffix=" pts" />
          </div>

          {data.aiError && (
            <p className="mt-4 text-xs text-ink-500">
              AI notes unavailable — {data.aiError}
            </p>
          )}
        </>
      )}
    </Card>
  );
}

function MetricTile({ metric, suffix }: { metric: RiskMetric; suffix: string }) {
  return (
    <div className="rounded-sm border border-hairline bg-ink-800/50 p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${COLOR_DOT[metric.color]}`} />
        <p className="text-xs uppercase tracking-wide text-ink-300">{metric.label}</p>
      </div>
      <p className="figure text-2xl text-ink-100">
        {metric.value === null ? '—' : `${metric.value}${suffix}`}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-ink-400">
        {metric.note ?? (metric.value === null ? 'Not enough data yet.' : 'AI note unavailable.')}
      </p>
    </div>
  );
}
