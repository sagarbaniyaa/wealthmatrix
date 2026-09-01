'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { RetirementFanChart } from './RetirementFanChart';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { RetirementCashflowScenario } from '@/lib/types';

const DEFAULTS = {
  currentAge: '55', retirementAge: '65', planToAge: '95', currentPotValue: '500000',
  monthlyContribution: '500', desiredAnnualIncome: '30000', expectedReturnPct: '4', returnVolatilityPct: '12',
};

export function RetirementCashflowClient({ householdId, initialScenarios }: { householdId: string; initialScenarios: RetirementCashflowScenario[] }) {
  const [name, setName] = useState('');
  const [inputs, setInputs] = useState(DEFAULTS);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scenarios, setScenarios] = useState(initialScenarios);
  const [activeId, setActiveId] = useState<string | null>(initialScenarios[0]?.id ?? null);

  const active = scenarios.find((s) => s.id === activeId) ?? null;

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const saved = await api.post<RetirementCashflowScenario>(`households/${householdId}/retirement-cashflow`, {
        name: name || undefined,
        inputs: {
          currentAge: Number(inputs.currentAge),
          retirementAge: Number(inputs.retirementAge),
          planToAge: Number(inputs.planToAge),
          currentPotValue: Number(inputs.currentPotValue),
          monthlyContribution: Number(inputs.monthlyContribution),
          desiredAnnualIncome: Number(inputs.desiredAnnualIncome),
          expectedReturnPct: Number(inputs.expectedReturnPct),
          returnVolatilityPct: Number(inputs.returnVolatilityPct),
        },
      });
      setScenarios((prev) => [saved, ...prev]);
      setActiveId(saved.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not run this simulation.');
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string) {
    await api.delete(`households/${householdId}/retirement-cashflow/${id}`);
    setScenarios((prev) => prev.filter((s) => s.id !== id));
    if (activeId === id) setActiveId(null);
  }

  return (
    <div className="grid grid-cols-[380px_1fr] gap-6">
      <div className="space-y-4">
        <Card>
          <p className="mb-3 text-xs uppercase tracking-wide text-ink-300">New simulation</p>
          <label className="mb-3 block">
            <span className="mb-1.5 block text-xs uppercase tracking-wide text-ink-300">Label (optional)</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Base case"
              className="w-full rounded-sm border border-hairline bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brass-500" />
          </label>

          <div className="grid grid-cols-3 gap-3">
            <TextField label="Current age" value={inputs.currentAge} onChange={(v) => setInputs((i) => ({ ...i, currentAge: v }))} />
            <TextField label="Retire at" value={inputs.retirementAge} onChange={(v) => setInputs((i) => ({ ...i, retirementAge: v }))} />
            <TextField label="Plan to age" value={inputs.planToAge} onChange={(v) => setInputs((i) => ({ ...i, planToAge: v }))} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <TextField label="Current pot (£)" value={inputs.currentPotValue} onChange={(v) => setInputs((i) => ({ ...i, currentPotValue: v }))} />
            <TextField label="Monthly contribution (£)" value={inputs.monthlyContribution} onChange={(v) => setInputs((i) => ({ ...i, monthlyContribution: v }))} />
          </div>
          <div className="mt-3">
            <TextField label="Desired annual income in retirement (£, today's terms)" value={inputs.desiredAnnualIncome} onChange={(v) => setInputs((i) => ({ ...i, desiredAnnualIncome: v }))} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <TextField label="Expected real return % p.a." value={inputs.expectedReturnPct} onChange={(v) => setInputs((i) => ({ ...i, expectedReturnPct: v }))} />
            <TextField label="Return volatility % (std dev)" value={inputs.returnVolatilityPct} onChange={(v) => setInputs((i) => ({ ...i, returnVolatilityPct: v }))} />
          </div>

          <Button className="mt-4 w-full px-4 py-2 text-xs" onClick={create} disabled={creating}>
            {creating ? 'Running 2,000 simulations…' : 'Run simulation'}
          </Button>
          {error && <p className="mt-2 text-xs text-rust-400">{error}</p>}
          <p className="mt-2 text-xs text-ink-500">
            Everything is modelled in today's money (real, post-inflation terms) — contributions and income needs
            stay constant in real terms rather than needing a separate inflation assumption.
          </p>
        </Card>

        <Card>
          <p className="mb-3 text-xs uppercase tracking-wide text-ink-300">Past simulations</p>
          <ul className="divide-y divide-hairline/50">
            {scenarios.map((s) => (
              <li key={s.id}>
                <button onClick={() => setActiveId(s.id)} className={`block w-full py-2 text-left text-sm ${activeId === s.id ? 'text-brass-400' : 'text-ink-300 hover:text-ink-100'}`}>
                  <p>{s.name ?? `Ages ${s.inputs.currentAge}–${s.inputs.planToAge}`}</p>
                  <p className="text-xs text-ink-500">{formatDate(s.createdAt)} · {s.results.successProbabilityPct.toFixed(0)}% success</p>
                </button>
              </li>
            ))}
            {scenarios.length === 0 && <p className="py-2 text-sm text-ink-400">No simulations run yet.</p>}
          </ul>
        </Card>
      </div>

      <Card>
        {!active ? (
          <p className="text-sm text-ink-400">Run a simulation, or select one from "Past simulations", to view it here.</p>
        ) : (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-300">{active.name ?? 'Retirement simulation'}</p>
                <p className="text-sm text-ink-100">
                  Age {active.inputs.currentAge} → retire {active.inputs.retirementAge} → plan to {active.inputs.planToAge}
                </p>
              </div>
              <Button variant="ghost" className="px-3 py-1 text-xs text-rust-400" onClick={() => remove(active.id)}>Delete</Button>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Stat label="Success probability" value={`${active.results.successProbabilityPct.toFixed(1)}%`} tone={active.results.successProbabilityPct >= 80 ? 'positive' : active.results.successProbabilityPct >= 50 ? undefined : 'negative'} />
              <Stat label="Median pot at plan-to age" value={formatCurrency(active.results.series[active.results.series.length - 1]?.p50 ?? 0)} />
              <Stat label="Simulations run" value={active.results.simulationCount.toLocaleString('en-GB')} />
              <Stat label="Desired income (real)" value={formatCurrency(active.inputs.desiredAnnualIncome)} />
            </div>

            <RetirementFanChart series={active.results.series} retirementAge={active.inputs.retirementAge} />

            <div className="border-t border-hairline pt-4">
              <p className="mb-2 text-xs uppercase tracking-wide text-ink-300">AI summary</p>
              {active.aiNarrative ? (
                <p className="text-sm leading-relaxed text-ink-300">{active.aiNarrative}</p>
              ) : (
                <p className="text-xs text-ink-500">AI summary unavailable — {active.aiNarrativeError ?? 'unknown error.'}</p>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wide text-ink-300">{label}</span>
      <input
        type="number" value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-sm border border-hairline bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none focus:border-brass-500"
      />
    </label>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'negative' }) {
  const toneClass = tone === 'positive' ? 'text-verdigris-400' : tone === 'negative' ? 'text-rust-400' : 'text-ink-100';
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-ink-300">{label}</p>
      <p className={`mt-1 figure text-lg ${toneClass}`}>{value}</p>
    </div>
  );
}
