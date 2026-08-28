'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { FundsExplorer } from '@/components/research/FundsExplorer';
import { FundPerformanceChart } from '@/components/research/FundPerformanceChart';
import { api } from '@/lib/api';
import { formatPct } from '@/lib/format';
import type { PagedFunds, FundComparisonResult } from '@/lib/types';

interface FilterOptions { sectors: string[]; assetClasses: string[] }

const RISK_TONE: Record<number, string> = { 1: 'positive', 2: 'positive', 3: 'positive', 4: 'warning', 5: 'warning', 6: 'breach', 7: 'breach' };

export function CompareClient({
  initialData, filterOptions,
}: {
  initialData: PagedFunds;
  filterOptions: FilterOptions;
}) {
  const [selectedFundIds, setSelectedFundIds] = useState<string[]>([]);
  const [result, setResult] = useState<FundComparisonResult | null>(null);
  const [comparing, setComparing] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<{ summary: string | null; error: string | null } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  function toggleFund(fundId: string) {
    setSelectedFundIds((prev) => {
      if (prev.includes(fundId)) return prev.filter((id) => id !== fundId);
      if (prev.length >= 5) return prev; // backend caps at 5 — ignore extra clicks rather than error
      return [...prev, fundId];
    });
    setResult(null);
    setAiSummary(null);
  }

  async function runCompare() {
    setComparing(true);
    setCompareError(null);
    try {
      const res = await api.post<FundComparisonResult>('funds/compare', { fundIds: selectedFundIds });
      setResult(res);
      setAiLoading(true);
      api.post<{ summary: string | null; error: string | null }>('ai/fund-comparison', { fundIds: selectedFundIds })
        .then(setAiSummary)
        .catch(() => setAiSummary({ summary: null, error: 'Could not reach the AI summary service.' }))
        .finally(() => setAiLoading(false));
    } catch (err) {
      setCompareError(err instanceof Error ? err.message : 'Could not compare these funds.');
    } finally {
      setComparing(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between">
          <p className="text-sm text-ink-300">
            {selectedFundIds.length === 0 ? 'Select 2–5 funds below to compare.' : `${selectedFundIds.length} fund${selectedFundIds.length === 1 ? '' : 's'} selected.`}
          </p>
          <Button onClick={runCompare} disabled={selectedFundIds.length < 2 || comparing} className="px-4 py-2 text-xs">
            {comparing ? 'Comparing…' : 'Compare'}
          </Button>
        </div>
        {compareError && <p className="mt-2 text-xs text-rust-400">{compareError}</p>}
      </Card>

      {result && (
        <Card>
          <p className="mb-4 text-xs uppercase tracking-wide text-ink-300">Comparison</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-xs uppercase tracking-wide text-ink-300">
                  <th className="pb-3 font-medium">Fund</th>
                  {result.funds.map((f) => <th key={f.id} className="pb-3 pl-6 font-medium text-ink-100">{f.name}</th>)}
                </tr>
              </thead>
              <tbody>
                <CompareRow label="Sector" cells={result.funds.map((f) => f.sector)} />
                <CompareRow label="Asset class" cells={result.funds.map((f) => f.assetClass.replace('_', ' '))} />
                <CompareRow label="OCF" cells={result.funds.map((f) => (f.ocf !== null ? formatPct(Number(f.ocf) * 100, 2) : '—'))} />
                <CompareRow label="Yield" cells={result.funds.map((f) => (f.yieldPct !== null ? formatPct(Number(f.yieldPct)) : '—'))} />
                <tr className="border-b border-hairline/50">
                  <td className="py-3 text-ink-300">Risk rating</td>
                  {result.funds.map((f) => (
                    <td key={f.id} className="py-3 pl-6">
                      {f.riskRating !== null ? <Badge tone={RISK_TONE[f.riskRating] ?? 'info'}>{f.riskRating} / 7</Badge> : <span className="text-ink-500">—</span>}
                    </td>
                  ))}
                </tr>
                <CompareRow label="Volatility" cells={result.funds.map((f) => (f.volatilityPct !== null ? formatPct(Number(f.volatilityPct)) : '—'))} />
                <CompareRow label="Max drawdown" cells={result.funds.map((f) => (f.maxDrawdownPct !== null ? formatPct(Number(f.maxDrawdownPct)) : '—'))} />
                <CompareRow label="Manager" cells={result.funds.map((f) => f.manager ?? '—')} />
              </tbody>
            </table>
          </div>

          <p className="mb-3 mt-6 text-xs uppercase tracking-wide text-ink-300">Performance</p>
          <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${result.funds.length}, minmax(0, 1fr))` }}>
            {result.funds.map((f) => (
              <div key={f.id}>
                <p className="mb-2 truncate text-xs text-ink-400" title={f.name}>{f.name}</p>
                <FundPerformanceChart performance={result.performanceByFund[f.id] ?? []} />
              </div>
            ))}
          </div>

          <p className="mb-3 mt-8 text-xs uppercase tracking-wide text-ink-300">AI summary</p>
          {aiLoading && <p className="text-sm text-ink-300">Generating comparison summary…</p>}
          {!aiLoading && aiSummary?.summary && <p className="text-sm leading-relaxed text-ink-300">{aiSummary.summary}</p>}
          {!aiLoading && !aiSummary?.summary && (
            <p className="text-xs text-ink-500">AI summary unavailable — {aiSummary?.error ?? 'unknown error.'}</p>
          )}
        </Card>
      )}

      <FundsExplorer
        initialData={initialData}
        filterOptions={filterOptions}
        mode="select"
        selectedFundIds={selectedFundIds}
        onSelectFund={toggleFund}
      />
    </div>
  );
}

function CompareRow({ label, cells }: { label: string; cells: string[] }) {
  return (
    <tr className="border-b border-hairline/50">
      <td className="py-3 text-ink-300">{label}</td>
      {cells.map((c, i) => <td key={i} className="py-3 pl-6 figure text-ink-100">{c}</td>)}
    </tr>
  );
}
