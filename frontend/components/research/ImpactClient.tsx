'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import { formatCurrency, formatPct } from '@/lib/format';
import type { Household, Fund, FundSwitchImpact } from '@/lib/types';

const LIQUIDITY_TONE: Record<FundSwitchImpact['liquidityChange'], string> = {
  improved: 'positive', unchanged: 'info', reduced: 'warning',
};

/**
 * Fund → Household Impact tool (Part 6): pick a household and two funds,
 * see the cost/risk/volatility/liquidity delta of switching between them.
 * Fund pickers are plain <select>s over the funds already loaded on the
 * page — fine at demo scale (~15 funds); at the real ~3,700-fund scale
 * this would need to become a searchable combobox hitting `GET /funds`,
 * same as FundsExplorer's search field.
 */
export function ImpactClient({ households, funds, initialFundAId }: { households: Household[]; funds: Fund[]; initialFundAId?: string }) {
  const [householdId, setHouseholdId] = useState('');
  const [fundAId, setFundAId] = useState(initialFundAId ?? '');
  const [fundBId, setFundBId] = useState('');
  const [switchAmount, setSwitchAmount] = useState('100000');
  const [result, setResult] = useState<FundSwitchImpact | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canRun = householdId && fundAId && fundBId && fundAId !== fundBId && Number(switchAmount) > 0;

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.post<FundSwitchImpact>('funds/impact', {
        householdId, fundAId, fundBId, switchAmount: Number(switchAmount),
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not calculate impact.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <SelectField label="Household" value={householdId} onChange={setHouseholdId} options={[{ value: '', label: 'Choose…' }, ...households.map((h) => ({ value: h.id, label: h.name }))]} />
          <SelectField label="Switch from (Fund A)" value={fundAId} onChange={setFundAId} options={[{ value: '', label: 'Choose…' }, ...funds.map((f) => ({ value: f.id, label: f.name }))]} />
          <SelectField label="Switch to (Fund B)" value={fundBId} onChange={setFundBId} options={[{ value: '', label: 'Choose…' }, ...funds.map((f) => ({ value: f.id, label: f.name }))]} />
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-wide text-ink-300">Switch amount</span>
            <input
              type="number" value={switchAmount} onChange={(e) => setSwitchAmount(e.target.value)}
              className="w-full rounded-sm border border-hairline bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none focus:border-brass-500"
            />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={run} disabled={!canRun || loading} className="px-4 py-2 text-xs">{loading ? 'Calculating…' : 'Calculate impact'}</Button>
          {error && <span className="text-xs text-rust-400">{error}</span>}
        </div>
      </Card>

      {result && (
        <Card>
          <p className="mb-4 text-xs uppercase tracking-wide text-ink-300">
            Switching {formatCurrency(result.switchAmount)} from {result.fundA.name} to {result.fundB.name}
          </p>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <Metric label="Annual cost change" value={result.annualCostDelta !== null ? formatCurrency(result.annualCostDelta) : '—'} tone={toneForDelta(result.annualCostDelta, true)} />
            <Metric label="OCF change" value={result.ocfDeltaPct !== null ? formatPct(result.ocfDeltaPct * 100, 2) : '—'} tone={toneForDelta(result.ocfDeltaPct, true)} />
            <Metric label="Risk rating change" value={result.riskRatingDelta !== null ? formatSigned(result.riskRatingDelta) : '—'} tone={toneForDelta(result.riskRatingDelta, true)} />
            <Metric label="Volatility change" value={result.volatilityDeltaPct !== null ? `${formatSigned(result.volatilityDeltaPct)}pp` : '—'} tone={toneForDelta(result.volatilityDeltaPct, true)} />
          </div>
          <div className="mt-6 flex items-center gap-3 border-t border-hairline pt-4">
            <Badge tone={LIQUIDITY_TONE[result.liquidityChange]}>{result.liquidityChange}</Badge>
            <p className="text-sm text-ink-300">{result.liquidityNote}</p>
          </div>
        </Card>
      )}
    </div>
  );
}

// Lower cost/risk/volatility is good (verdigris), higher is a caution
// (rust) — "lowerIsBetter" flips the sign check for these particular metrics.
function toneForDelta(value: number | null, lowerIsBetter: boolean): string {
  if (value === null || value === 0) return 'info';
  const better = lowerIsBetter ? value < 0 : value > 0;
  return better ? 'positive' : 'warning';
}

function formatSigned(n: number): string {
  return `${n > 0 ? '+' : ''}${n}`;
}

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  const toneClass: Record<string, string> = {
    positive: 'text-verdigris-400', warning: 'text-rust-400', info: 'text-ink-100',
  };
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-ink-300">{label}</p>
      <p className={`mt-1 figure text-lg ${toneClass[tone] ?? 'text-ink-100'}`}>{value}</p>
    </div>
  );
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wide text-ink-300">{label}</span>
      <select
        value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-sm border border-hairline bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none focus:border-brass-500"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
