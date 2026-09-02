'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { ConsumerDutyReview, ConsumerDutyOutcomeStatus, VulnerabilityFlag } from '@/lib/types';

const OUTCOME_OPTIONS: { value: ConsumerDutyOutcomeStatus; label: string }[] = [
  { value: 'not_assessed', label: 'Not assessed' },
  { value: 'met', label: 'Met' },
  { value: 'concern', label: 'Concern' },
];

function outcomeTone(status: ConsumerDutyOutcomeStatus): string {
  if (status === 'met') return 'positive';
  if (status === 'concern') return 'breach';
  return 'draft';
}

const OUTCOME_FIELDS = [
  { key: 'priceValue', label: 'Price & value', help: 'Is the client paying a fair price for what they receive?' },
  { key: 'productsServices', label: 'Products & services', help: 'Are the products/services still right for this client’s needs?' },
  { key: 'understanding', label: 'Consumer understanding', help: 'Can the client understand the information and decisions involved?' },
  { key: 'support', label: 'Consumer support', help: 'Can the client get the support they need, when they need it?' },
] as const;

type OutcomeKey = (typeof OUTCOME_FIELDS)[number]['key'];

export function ConsumerDutyReviewPanel({
  householdId,
  vulnerabilityFlags,
  supportDocumented,
  initialHistory,
}: {
  householdId: string;
  vulnerabilityFlags: VulnerabilityFlag[];
  supportDocumented: boolean;
  initialHistory: ConsumerDutyReview[];
}) {
  const [history, setHistory] = useState(initialHistory);
  const [outcomes, setOutcomes] = useState<Record<OutcomeKey, ConsumerDutyOutcomeStatus>>({
    priceValue: 'not_assessed', productsServices: 'not_assessed', understanding: 'not_assessed', support: 'not_assessed',
  });
  const [notes, setNotes] = useState<Record<OutcomeKey, string>>({
    priceValue: '', productsServices: '', understanding: '', support: '',
  });
  const [overallNotes, setOverallNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const saved = await api.post<ConsumerDutyReview>(`households/${householdId}/consumer-duty`, {
        priceValueOutcome: outcomes.priceValue, priceValueNotes: notes.priceValue || undefined,
        productsServicesOutcome: outcomes.productsServices, productsServicesNotes: notes.productsServices || undefined,
        understandingOutcome: outcomes.understanding, understandingNotes: notes.understanding || undefined,
        supportOutcome: outcomes.support, supportNotes: notes.support || undefined,
        overallNotes: overallNotes || undefined,
      });
      setHistory((prev) => [saved, ...prev]);
      setOverallNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the review');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <p className="mb-4 text-xs uppercase tracking-wide text-ink-300">Vulnerability (from latest Fact Find)</p>
        {vulnerabilityFlags.length === 0 ? (
          <p className="text-sm text-ink-400">No vulnerability indicators recorded.</p>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge tone="warning">Flagged</Badge>
              {!supportDocumented && <Badge tone="breach">No support documented</Badge>}
            </div>
            <ul className="space-y-1 text-sm text-ink-100">
              {vulnerabilityFlags.map((f) => (
                <li key={f.key}><span className="text-ink-300">{f.label}:</span> {f.detail}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card>
        <p className="mb-4 text-xs uppercase tracking-wide text-ink-300">Record a Consumer Duty review</p>
        <div className="space-y-4">
          {OUTCOME_FIELDS.map((f) => (
            <div key={f.key} className="grid grid-cols-3 gap-4 border-b border-hairline/50 pb-4 last:border-0 last:pb-0">
              <div>
                <p className="text-sm text-ink-100">{f.label}</p>
                <p className="text-xs text-ink-400">{f.help}</p>
              </div>
              <select
                value={outcomes[f.key]}
                onChange={(e) => setOutcomes((prev) => ({ ...prev, [f.key]: e.target.value as ConsumerDutyOutcomeStatus }))}
                className="h-fit rounded-sm border border-hairline bg-ink-800 px-3 py-2 text-sm text-ink-100"
              >
                {OUTCOME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <input
                value={notes[f.key]}
                onChange={(e) => setNotes((prev) => ({ ...prev, [f.key]: e.target.value }))}
                placeholder="Notes (optional)"
                className="rounded-sm border border-hairline bg-ink-800 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500"
              />
            </div>
          ))}
          <div>
            <p className="mb-1 text-sm text-ink-100">Overall notes</p>
            <textarea
              value={overallNotes}
              onChange={(e) => setOverallNotes(e.target.value)}
              rows={3}
              className="w-full rounded-sm border border-hairline bg-ink-800 px-3 py-2 text-sm text-ink-100"
            />
          </div>
          {error && <p className="text-sm text-rust-400">{error}</p>}
          <Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save review'}</Button>
        </div>
      </Card>

      <Card>
        <p className="mb-4 text-xs uppercase tracking-wide text-ink-300">Review history</p>
        {history.length === 0 ? (
          <p className="text-sm text-ink-400">No Consumer Duty reviews recorded yet.</p>
        ) : (
          <div className="space-y-4">
            {history.map((r) => (
              <div key={r.id} className="border-b border-hairline/50 pb-4 last:border-0 last:pb-0">
                <p className="mb-2 text-xs text-ink-300">{formatDate(r.reviewDate)}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={outcomeTone(r.priceValueOutcome)}>Price &amp; value: {r.priceValueOutcome}</Badge>
                  <Badge tone={outcomeTone(r.productsServicesOutcome)}>Products &amp; services: {r.productsServicesOutcome}</Badge>
                  <Badge tone={outcomeTone(r.understandingOutcome)}>Understanding: {r.understandingOutcome}</Badge>
                  <Badge tone={outcomeTone(r.supportOutcome)}>Support: {r.supportOutcome}</Badge>
                </div>
                {r.overallNotes && <p className="mt-2 text-sm text-ink-100">{r.overallNotes}</p>}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
