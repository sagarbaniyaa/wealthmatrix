'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ChargeProjectionChart } from './ChargeProjectionChart';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { ChargeProjection } from '@/lib/types';

const DEFAULT_OLD = { name: '', currentValue: '', ongoingChargePct: '1.00', exitPenaltyPct: '0' };
const DEFAULT_NEW = { name: '', ongoingChargePct: '0.45', initialChargePct: '0' };
const DEFAULT_ASSUMPTIONS = { projectionYears: '10', grossGrowthRatePct: '5' };

export function ChargeProjectionClient({ householdId, initialProjections }: { householdId: string; initialProjections: ChargeProjection[] }) {
  const [name, setName] = useState('');
  const [oldArr, setOldArr] = useState(DEFAULT_OLD);
  const [newArr, setNewArr] = useState(DEFAULT_NEW);
  const [assumptions, setAssumptions] = useState(DEFAULT_ASSUMPTIONS);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projections, setProjections] = useState(initialProjections);
  const [activeId, setActiveId] = useState<string | null>(initialProjections[0]?.id ?? null);

  const active = projections.find((p) => p.id === activeId) ?? null;

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const saved = await api.post<ChargeProjection>(`households/${householdId}/charge-projections`, {
        name: name || undefined,
        oldArrangement: {
          name: oldArr.name || 'Existing arrangement',
          currentValue: Number(oldArr.currentValue),
          ongoingChargePct: Number(oldArr.ongoingChargePct),
          exitPenaltyPct: Number(oldArr.exitPenaltyPct),
        },
        newArrangement: {
          name: newArr.name || 'Proposed arrangement',
          ongoingChargePct: Number(newArr.ongoingChargePct),
          initialChargePct: Number(newArr.initialChargePct),
        },
        assumptions: {
          projectionYears: Number(assumptions.projectionYears),
          grossGrowthRatePct: Number(assumptions.grossGrowthRatePct),
        },
      });
      setProjections((prev) => [saved, ...prev]);
      setActiveId(saved.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not run this projection.');
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string) {
    await api.delete(`households/${householdId}/charge-projections/${id}`);
    setProjections((prev) => prev.filter((p) => p.id !== id));
    if (activeId === id) setActiveId(null);
  }

  return (
    <div className="grid grid-cols-[380px_1fr] gap-6">
      <div className="space-y-4">
        <Card>
          <p className="mb-3 text-xs uppercase tracking-wide text-ink-300">New projection</p>
          <label className="mb-3 block">
            <span className="mb-1.5 block text-xs uppercase tracking-wide text-ink-300">Label (optional)</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aviva → Fidelity transfer"
              className="w-full rounded-sm border border-hairline bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brass-500" />
          </label>

          <p className="mb-2 text-xs uppercase tracking-wide text-rust-400">Old arrangement</p>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <TextField label="Name" value={oldArr.name} onChange={(v) => setOldArr((a) => ({ ...a, name: v }))} placeholder="e.g. Aviva Personal Pension" span2 />
            <TextField label="Current value (£)" value={oldArr.currentValue} onChange={(v) => setOldArr((a) => ({ ...a, currentValue: v }))} type="number" />
            <TextField label="Ongoing charge %" value={oldArr.ongoingChargePct} onChange={(v) => setOldArr((a) => ({ ...a, ongoingChargePct: v }))} type="number" />
            <TextField label="Exit penalty %" value={oldArr.exitPenaltyPct} onChange={(v) => setOldArr((a) => ({ ...a, exitPenaltyPct: v }))} type="number" />
          </div>

          <p className="mb-2 text-xs uppercase tracking-wide text-verdigris-400">New arrangement</p>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <TextField label="Name" value={newArr.name} onChange={(v) => setNewArr((a) => ({ ...a, name: v }))} placeholder="e.g. Fidelity SIPP" span2 />
            <TextField label="Ongoing charge %" value={newArr.ongoingChargePct} onChange={(v) => setNewArr((a) => ({ ...a, ongoingChargePct: v }))} type="number" />
            <TextField label="Initial charge %" value={newArr.initialChargePct} onChange={(v) => setNewArr((a) => ({ ...a, initialChargePct: v }))} type="number" />
          </div>

          <p className="mb-2 text-xs uppercase tracking-wide text-ink-300">Assumptions</p>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <TextField label="Years" value={assumptions.projectionYears} onChange={(v) => setAssumptions((a) => ({ ...a, projectionYears: v }))} type="number" />
            <TextField label="Gross growth % p.a." value={assumptions.grossGrowthRatePct} onChange={(v) => setAssumptions((a) => ({ ...a, grossGrowthRatePct: v }))} type="number" />
          </div>

          <Button className="w-full px-4 py-2 text-xs" onClick={create} disabled={creating || !oldArr.currentValue}>
            {creating ? 'Calculating…' : 'Run projection'}
          </Button>
          {error && <p className="mt-2 text-xs text-rust-400">{error}</p>}
          <p className="mt-2 text-xs text-ink-500">Both arrangements are assumed to grow at the same gross rate before charges — the whole gap shown is the charge difference, isolated.</p>
        </Card>

        <Card>
          <p className="mb-3 text-xs uppercase tracking-wide text-ink-300">Past projections</p>
          <ul className="divide-y divide-hairline/50">
            {projections.map((p) => (
              <li key={p.id}>
                <button onClick={() => setActiveId(p.id)} className={`block w-full py-2 text-left text-sm ${activeId === p.id ? 'text-brass-400' : 'text-ink-300 hover:text-ink-100'}`}>
                  <p>{p.name ?? `${p.oldArrangement.name} → ${p.newArrangement.name}`}</p>
                  <p className="text-xs text-ink-500">{formatDate(p.createdAt)}</p>
                </button>
              </li>
            ))}
            {projections.length === 0 && <p className="py-2 text-sm text-ink-400">No projections run yet.</p>}
          </ul>
        </Card>
      </div>

      <Card>
        {!active ? (
          <p className="text-sm text-ink-400">Run a projection, or select one from "Past projections", to view it here.</p>
        ) : (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-300">{active.name ?? 'Projection'}</p>
                <p className="text-sm text-ink-100">{active.oldArrangement.name} <span className="text-ink-500">→</span> {active.newArrangement.name}</p>
              </div>
              <Button variant="ghost" className="px-3 py-1 text-xs text-rust-400" onClick={() => remove(active.id)}>Delete</Button>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Stat label={`Value after ${active.assumptions.projectionYears}y (old)`} value={formatCurrency(active.results.finalOldValue)} />
              <Stat label={`Value after ${active.assumptions.projectionYears}y (new)`} value={formatCurrency(active.results.finalNewValue)} />
              <Stat
                label="Difference"
                value={`${active.results.difference >= 0 ? '+' : ''}${formatCurrency(active.results.difference)}`}
                tone={active.results.difference >= 0 ? 'positive' : 'negative'}
              />
              <Stat
                label="Difference %"
                value={`${active.results.differencePct >= 0 ? '+' : ''}${active.results.differencePct.toFixed(1)}%`}
                tone={active.results.differencePct >= 0 ? 'positive' : 'negative'}
              />
            </div>

            <ChargeProjectionChart series={active.results.series} />

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

function TextField({ label, value, onChange, type = 'text', placeholder, span2 }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; span2?: boolean;
}) {
  return (
    <label className={span2 ? 'col-span-2 block' : 'block'}>
      <span className="mb-1.5 block text-xs uppercase tracking-wide text-ink-300">{label}</span>
      <input
        type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-sm border border-hairline bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brass-500"
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
