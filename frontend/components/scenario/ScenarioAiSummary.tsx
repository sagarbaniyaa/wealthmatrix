'use client';

import { useEffect, useState } from 'react';
import { StatTile } from '@/components/ui/StatTile';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';

interface ScenarioImpact {
  taxImpact: number | null;
  liquidityChange: number | null;
  entityValuationShift: number | null;
}

interface ScenarioExplainResult {
  impact: ScenarioImpact | null;
  explanation: string | null;
  explanationError: string | null;
}

// Both the deterministic impact breakdown (tax/liquidity/entity valuation)
// and the AI narrative come from one call to /ai/scenario-explain — the
// breakdown always renders even when the narrative fails (e.g. billing).
export function ScenarioAiSummary({ scenarioId }: { scenarioId: string }) {
  const [data, setData] = useState<ScenarioExplainResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.post<ScenarioExplainResult>(`ai/scenario-explain/${scenarioId}`)
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setData({ impact: null, explanation: null, explanationError: 'Could not reach the AI summary service.' }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [scenarioId]);

  if (loading) return <p className="border-t border-hairline pt-4 text-sm text-ink-300">Computing impact breakdown…</p>;

  const impact = data?.impact;

  return (
    <div className="space-y-5 border-t border-hairline pt-4">
      {impact && (impact.taxImpact !== null || impact.liquidityChange !== null || impact.entityValuationShift !== null) && (
        <div className="grid grid-cols-3 gap-6">
          {impact.taxImpact !== null && <StatTile label="Tax impact" value={formatCurrency(impact.taxImpact)} tone="negative" />}
          {impact.liquidityChange !== null && <StatTile label="Liquidity change" value={`${impact.liquidityChange >= 0 ? '+' : ''}${formatCurrency(impact.liquidityChange)}`} tone={impact.liquidityChange >= 0 ? 'positive' : 'negative'} />}
          {impact.entityValuationShift !== null && <StatTile label="Entity valuation shift" value={`${impact.entityValuationShift >= 0 ? '+' : ''}${formatCurrency(impact.entityValuationShift)}`} tone={impact.entityValuationShift >= 0 ? 'positive' : 'negative'} />}
        </div>
      )}

      <div>
        <p className="mb-2 text-xs uppercase tracking-wide text-ink-300">AI summary</p>
        {data?.explanation ? (
          <p className="text-sm leading-relaxed text-ink-300">{data.explanation}</p>
        ) : (
          <p className="text-xs text-ink-500">AI summary unavailable — {data?.explanationError ?? 'unknown error.'}</p>
        )}
      </div>
    </div>
  );
}
