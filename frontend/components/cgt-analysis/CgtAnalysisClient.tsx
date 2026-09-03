'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { CgtAnalysis, TaxWrapper } from '@/lib/types';

const WRAPPER_OPTIONS: { value: TaxWrapper | ''; label: string }[] = [
  { value: '', label: 'Not set' },
  { value: 'ISA', label: 'ISA (CGT-exempt)' },
  { value: 'GIA', label: 'GIA (CGT applies)' },
  { value: 'SIPP', label: 'SIPP (CGT-exempt)' },
  { value: 'ONSHORE_BOND', label: 'Onshore Bond (not CGT)' },
  { value: 'OFFSHORE_BOND', label: 'Offshore Bond (not CGT)' },
  { value: 'OTHER', label: 'Other' },
];

const CATEGORY_LABEL: Record<string, string> = {
  best_to_sell: 'Best to sell', zero_cgt: 'Zero-CGT option', low_cgt: 'Low-CGT option',
  avoid_selling: 'Avoid selling', withdrawal_strategy: 'Withdrawal strategy',
};
const CATEGORY_TONE: Record<string, string> = {
  best_to_sell: 'positive', zero_cgt: 'positive', low_cgt: 'info', avoid_selling: 'breach', withdrawal_strategy: 'info',
};

interface InvestmentAccountRow { id: string; provider: string | null; personName: string; taxWrapper: TaxWrapper | null }

export function CgtAnalysisClient({
  householdId, investmentAccounts, initialAnalyses,
}: { householdId: string; investmentAccounts: InvestmentAccountRow[]; initialAnalyses: CgtAnalysis[] }) {
  const [accounts, setAccounts] = useState(investmentAccounts);
  const [analyses, setAnalyses] = useState(initialAnalyses);
  const [activeId, setActiveId] = useState<string | null>(initialAnalyses[0]?.id ?? null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = analyses.find((a) => a.id === activeId) ?? null;

  async function setWrapper(accountId: string, wrapper: string) {
    const saved = await api.patch<{ id: string; taxWrapper: TaxWrapper | null }>(`accounts/${accountId}`, { taxWrapper: wrapper || null });
    setAccounts((prev) => prev.map((a) => (a.id === accountId ? { ...a, taxWrapper: saved.taxWrapper } : a)));
  }

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const saved = await api.post<CgtAnalysis>(`households/${householdId}/cgt-analysis`);
      setAnalyses((prev) => [saved, ...prev]);
      setActiveId(saved.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not run the CGT analysis.');
    } finally {
      setGenerating(false);
    }
  }

  async function remove(id: string) {
    await api.delete(`households/${householdId}/cgt-analysis/${id}`);
    setAnalyses((prev) => prev.filter((a) => a.id !== id));
    if (activeId === id) setActiveId(null);
  }

  return (
    <div className="space-y-6">
      <Card>
        <p className="mb-3 text-xs uppercase tracking-wide text-ink-300">Investment accounts &amp; tax wrapper</p>
        {accounts.length === 0 ? (
          <p className="text-sm text-ink-400">No investment accounts recorded for this household yet.</p>
        ) : (
          <div className="space-y-2">
            {accounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-sm border border-hairline px-3 py-2">
                <div>
                  <p className="text-sm text-ink-100">{a.provider ?? 'Unnamed account'}</p>
                  <p className="text-xs text-ink-500">{a.personName}</p>
                </div>
                <select
                  value={a.taxWrapper ?? ''} onChange={(e) => setWrapper(a.id, e.target.value)}
                  className="rounded-sm border border-hairline bg-ink-800 px-2 py-1 text-xs text-ink-100 outline-none focus:border-brass-500"
                >
                  {WRAPPER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-ink-500">
          A wrapper must be set for an account to be included in CGT analysis — an unset wrapper is excluded, never guessed.
        </p>
      </Card>

      <div className="grid grid-cols-[280px_1fr] gap-6">
        <div className="space-y-4">
          <Card>
            <Button className="w-full px-4 py-2 text-xs" onClick={generate} disabled={generating}>
              {generating ? 'Analysing…' : 'Run CGT analysis'}
            </Button>
            {error && <p className="mt-2 text-xs text-rust-400">{error}</p>}
          </Card>
          <Card>
            <p className="mb-3 text-xs uppercase tracking-wide text-ink-300">Past analyses</p>
            <ul className="divide-y divide-hairline/50">
              {analyses.map((a) => (
                <li key={a.id}>
                  <button onClick={() => setActiveId(a.id)} className={`block w-full py-2 text-left text-sm ${activeId === a.id ? 'text-brass-400' : 'text-ink-300 hover:text-ink-100'}`}>
                    {formatDate(a.asOfDate)}
                  </button>
                </li>
              ))}
              {analyses.length === 0 && <p className="py-2 text-sm text-ink-400">None run yet.</p>}
            </ul>
          </Card>
        </div>

        <Card>
          {!active ? (
            <p className="text-sm text-ink-400">Run an analysis, or select a past one, to view it here.</p>
          ) : (
            <div className="space-y-6">
              <div className="flex items-start justify-between">
                <p className="text-xs uppercase tracking-wide text-ink-300">As of {formatDate(active.asOfDate)}</p>
                <Button variant="ghost" className="px-3 py-1 text-xs text-rust-400" onClick={() => remove(active.id)}>Delete</Button>
              </div>

              {active.gaps.length > 0 && (
                <div className="rounded-sm border border-brass-500/40 bg-brass-500/10 p-3">
                  <p className="mb-1 text-xs uppercase tracking-wide text-brass-400">Excluded / gaps</p>
                  <ul className="space-y-1 text-xs text-ink-300">
                    {active.gaps.map((g, i) => <li key={i}>• {g}</li>)}
                  </ul>
                </div>
              )}

              {active.perPerson.map((p) => (
                <div key={p.personId} className="space-y-3 border-t border-hairline pt-4 first:border-0 first:pt-0">
                  <p className="font-display text-lg text-ink-100">{p.personName}</p>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <Stat label="Net unrealised gain" value={formatCurrency(p.netGain)} />
                    <Stat label="Remaining allowance" value={formatCurrency(p.remainingAllowance)} />
                    <Stat label="Est. tax (basic)" value={formatCurrency(p.estimatedTaxIfRealisedNow.basicRate)} />
                    <Stat label="Est. tax (higher)" value={formatCurrency(p.estimatedTaxIfRealisedNow.higherRate)} />
                  </div>
                  {p.likelyBand !== 'unknown' && (
                    <p className="text-xs text-ink-500">Likely {p.likelyBand}-rate taxpayer, based on recorded income (estimate only).</p>
                  )}

                  {p.holdings.length > 0 && (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-hairline text-left text-ink-300">
                          <th className="pb-1 font-medium">Asset</th>
                          <th className="pb-1 font-medium">Wrapper</th>
                          <th className="pb-1 text-right font-medium">Value</th>
                          <th className="pb-1 text-right font-medium">Gain/loss</th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.holdings.map((h) => (
                          <tr key={`${h.accountId}-${h.assetId}`} className="border-b border-hairline/50 last:border-0">
                            <td className="py-1.5 text-ink-100">{h.assetName}</td>
                            <td className="py-1.5 text-ink-300">{h.taxWrapper}</td>
                            <td className="py-1.5 text-right text-ink-100">{formatCurrency(h.marketValue)}</td>
                            <td className={`py-1.5 text-right ${h.gain === null ? 'text-ink-500' : h.gain >= 0 ? 'text-verdigris-400' : 'text-rust-400'}`}>
                              {h.gain === null ? (h.dataQualityNote ?? '—') : formatCurrency(h.gain)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {active.recommendations.filter((r) => r.personId === p.personId).length > 0 && (
                    <div className="space-y-2">
                      {active.recommendations.filter((r) => r.personId === p.personId).map((r, i) => (
                        <div key={i} className="rounded-sm border border-hairline p-2">
                          <div className="mb-1 flex items-center gap-2">
                            <Badge tone={CATEGORY_TONE[r.category]}>{CATEGORY_LABEL[r.category]}</Badge>
                            <span className="text-sm text-ink-100">{r.title}</span>
                          </div>
                          <p className="text-xs text-ink-400">{r.detail}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l-2 border-brass-500/40 pl-3">
      <p className="text-[10px] uppercase tracking-wide text-ink-400">{label}</p>
      <p className="figure text-sm text-ink-100">{value}</p>
    </div>
  );
}
