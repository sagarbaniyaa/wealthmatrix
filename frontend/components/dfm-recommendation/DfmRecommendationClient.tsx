'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { DfmRecommendation } from '@/lib/types';

const CATEGORY_COLORS: Record<string, string> = {
  'Global Equity': 'bg-brass-500', 'Multi-Asset': 'bg-verdigris-500', 'Corporate Bond': 'bg-ink-400',
  'Index Funds': 'bg-brass-300', 'Diversified Growth': 'bg-verdigris-300', 'Alternatives': 'bg-rust-400',
  'Cash': 'bg-ink-600', 'Short-Duration Bonds': 'bg-ink-500',
};

export function DfmRecommendationClient({ householdId, initialRecommendations }: { householdId: string; initialRecommendations: DfmRecommendation[] }) {
  const [recommendations, setRecommendations] = useState(initialRecommendations);
  const [activeId, setActiveId] = useState<string | null>(initialRecommendations[0]?.id ?? null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = recommendations.find((r) => r.id === activeId) ?? null;

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const saved = await api.post<DfmRecommendation>(`households/${householdId}/dfm-recommendation`);
      setRecommendations((prev) => [saved, ...prev]);
      setActiveId(saved.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate a recommendation.');
    } finally {
      setGenerating(false);
    }
  }

  async function remove(id: string) {
    await api.delete(`households/${householdId}/dfm-recommendation/${id}`);
    setRecommendations((prev) => prev.filter((r) => r.id !== id));
    if (activeId === id) setActiveId(null);
  }

  return (
    <div className="grid grid-cols-[280px_1fr] gap-6">
      <div className="space-y-4">
        <Card>
          <p className="mb-3 text-xs uppercase tracking-wide text-ink-300">Generate</p>
          <p className="mb-3 text-xs text-ink-400">
            Computed from the household&apos;s latest Fact Find (risk category, objectives, time horizon, liquidity
            need, investment style). No real DFM firm is named — this recommends a mandate type and fund category
            allocation only.
          </p>
          <Button className="w-full px-4 py-2 text-xs" onClick={generate} disabled={generating}>
            {generating ? 'Computing…' : 'Generate recommendation'}
          </Button>
          {error && <p className="mt-2 text-xs text-rust-400">{error}</p>}
        </Card>

        <Card>
          <p className="mb-3 text-xs uppercase tracking-wide text-ink-300">Past recommendations</p>
          <ul className="divide-y divide-hairline/50">
            {recommendations.map((r) => (
              <li key={r.id}>
                <button onClick={() => setActiveId(r.id)} className={`block w-full py-2 text-left text-sm ${activeId === r.id ? 'text-brass-400' : 'text-ink-300 hover:text-ink-100'}`}>
                  <p>{r.mandate}</p>
                  <p className="text-xs text-ink-500">{formatDate(r.createdAt)}</p>
                </button>
              </li>
            ))}
            {recommendations.length === 0 && <p className="py-2 text-sm text-ink-400">None generated yet.</p>}
          </ul>
        </Card>
      </div>

      <Card>
        {!active ? (
          <p className="text-sm text-ink-400">Generate a recommendation, or select a past one, to view it here.</p>
        ) : (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-300">{formatDate(active.createdAt)}</p>
                <p className="font-display text-xl text-ink-100">{active.mandate}</p>
                {active.riskAlignment && <p className="text-sm text-ink-300">{active.riskAlignment}</p>}
              </div>
              <Button variant="ghost" className="px-3 py-1 text-xs text-rust-400" onClick={() => remove(active.id)}>Delete</Button>
            </div>

            {active.gaps.length > 0 && (
              <div className="rounded-sm border border-brass-500/40 bg-brass-500/10 p-3">
                <p className="mb-1 text-xs uppercase tracking-wide text-brass-400">Data gaps</p>
                <ul className="space-y-1 text-xs text-ink-300">
                  {active.gaps.map((g, i) => <li key={i}>• {g}</li>)}
                </ul>
              </div>
            )}

            {active.fundCategories.length > 0 && (
              <div>
                <p className="mb-3 text-xs uppercase tracking-wide text-ink-300">Fund category allocation</p>
                <div className="space-y-2">
                  {active.fundCategories.map((c) => (
                    <div key={c.category} className="flex items-center gap-3">
                      <span className="w-40 shrink-0 text-xs text-ink-300">{c.category}</span>
                      <div className="h-3 flex-1 overflow-hidden rounded-sm bg-ink-800">
                        <div className={`h-full ${CATEGORY_COLORS[c.category] ?? 'bg-brass-500'}`} style={{ width: `${c.weightPct}%` }} />
                      </div>
                      <span className="w-10 text-right text-xs text-ink-100">{c.weightPct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {active.indicativeFeeRange && (
              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-ink-300">Indicative fee range</p>
                <p className="text-sm text-ink-100">{active.indicativeFeeRange}</p>
              </div>
            )}

            {active.reasoning.length > 0 && (
              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-ink-300">Reasoning</p>
                <ul className="space-y-1 text-sm text-ink-100">
                  {active.reasoning.map((r, i) => <li key={i}>• {r}</li>)}
                </ul>
              </div>
            )}

            <div>
              <div className="mb-1 flex items-center gap-2">
                <p className="text-xs uppercase tracking-wide text-ink-300">Suitability wording</p>
                {active.aiNarrativeError && <Badge tone="warning">AI unavailable</Badge>}
              </div>
              {active.aiNarrative ? (
                <p className="text-sm leading-relaxed text-ink-100">{active.aiNarrative}</p>
              ) : (
                <p className="text-sm text-ink-400">{active.aiNarrativeError ?? 'Not generated.'}</p>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
