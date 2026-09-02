'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { ActionOption, HouseholdAction, ActionChecklist, ActionType } from '@/lib/types';

function StatusDot({ ok }: { ok: boolean }) {
  return <Badge tone={ok ? 'positive' : 'warning'}>{ok ? 'Ready' : 'Needed'}</Badge>;
}

export function ClientActionClient({
  householdId, options, initialCurrent, initialChecklist, initialHistory,
}: {
  householdId: string; options: ActionOption[]; initialCurrent: HouseholdAction | null;
  initialChecklist: ActionChecklist | null; initialHistory: HouseholdAction[];
}) {
  const [current, setCurrent] = useState(initialCurrent);
  const [checklist, setChecklist] = useState(initialChecklist);
  const [history, setHistory] = useState(initialHistory);
  const [actionType, setActionType] = useState<ActionType>(initialCurrent?.actionType ?? options[0]?.actionType);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setAction() {
    setSaving(true);
    setError(null);
    try {
      const saved = await api.post<HouseholdAction>(`households/${householdId}/action`, { actionType, notes: notes || undefined });
      setCurrent(saved);
      setHistory((prev) => [saved, ...prev]);
      setNotes('');
      const newChecklist = await api.get<ActionChecklist>(`households/${householdId}/action/checklist`);
      setChecklist(newChecklist);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set this action.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <p className="mb-3 text-xs uppercase tracking-wide text-ink-300">What are we doing for this client?</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-wide text-ink-300">Action</span>
            <select
              value={actionType} onChange={(e) => setActionType(e.target.value as ActionType)}
              className="rounded-sm border border-hairline bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none focus:border-brass-500"
            >
              {options.map((o) => <option key={o.actionType} value={o.actionType}>{o.label}</option>)}
            </select>
          </label>
          <label className="block flex-1 min-w-[240px]">
            <span className="mb-1.5 block text-xs uppercase tracking-wide text-ink-300">Notes (optional)</span>
            <input
              value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Transfer from Aviva to Fidelity"
              className="w-full rounded-sm border border-hairline bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brass-500"
            />
          </label>
          <Button onClick={setAction} disabled={saving} className="px-4 py-2 text-xs">
            {saving ? 'Setting…' : current ? 'Change action' : 'Set action'}
          </Button>
        </div>
        {error && <p className="mt-2 text-xs text-rust-400">{error}</p>}
        {current && (
          <p className="mt-3 text-xs text-ink-400">
            Current: <span className="text-ink-100">{options.find((o) => o.actionType === current.actionType)?.label}</span>
            {current.notes && ` — ${current.notes}`} (set {formatDate(current.createdAt)})
          </p>
        )}
      </Card>

      {checklist && (
        <>
          <Card>
            <p className="mb-3 text-xs uppercase tracking-wide text-ink-300">Required documents</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {checklist.documents.map((d) => (
                <div key={d.type} className="flex items-center justify-between rounded-sm border border-hairline px-3 py-2">
                  <div>
                    <p className="text-sm text-ink-100">{d.label}</p>
                    {d.latestFileName && <p className="text-xs text-ink-500">{d.latestFileName}</p>}
                  </div>
                  <StatusDot ok={d.satisfied} />
                </div>
              ))}
            </div>
            <Link href={`/advisor/households/${householdId}/documents`} className="mt-3 inline-block text-xs text-brass-400 hover:text-brass-300">
              Upload documents →
            </Link>
          </Card>

          <Card>
            <p className="mb-3 text-xs uppercase tracking-wide text-ink-300">Compliance checks</p>
            <div className="space-y-2">
              {checklist.complianceChecks.map((c) => (
                <div key={c.key} className="flex items-center justify-between rounded-sm border border-hairline px-3 py-2">
                  <div>
                    <p className="text-sm text-ink-100">{c.label}</p>
                    <p className="text-xs text-ink-500">{c.detail}</p>
                  </div>
                  <StatusDot ok={c.satisfied} />
                </div>
              ))}
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <p className="mb-3 text-xs uppercase tracking-wide text-ink-300">Suitability report</p>
              <p className="text-sm text-ink-100">Section: {checklist.suitability.sectionLabel}</p>
              <div className="mt-2 flex items-center gap-2">
                <StatusDot ok={checklist.suitability.templateFound} />
                <span className="text-xs text-ink-400">
                  {checklist.suitability.templateFound ? 'Template on file' : `No "${checklist.suitability.sectionLabel}" template uploaded yet`}
                </span>
              </div>
              {checklist.suitability.reportCaseId && (
                <p className="mt-1 text-xs text-ink-400">Report case: {checklist.suitability.reportCaseStatus}</p>
              )}
              <Link href={`/advisor/households/${householdId}/report-builder`} className="mt-3 inline-block text-xs text-brass-400 hover:text-brass-300">
                Open Report Builder →
              </Link>
            </Card>

            {checklist.provider.required && (
              <Card>
                <p className="mb-3 text-xs uppercase tracking-wide text-ink-300">Provider</p>
                <div className="flex items-center gap-2">
                  <StatusDot ok={checklist.provider.hasAction} />
                  <span className="text-xs text-ink-400">
                    {checklist.provider.hasAction ? `Latest status: ${checklist.provider.latestStatus}` : 'No provider action started yet'}
                  </span>
                </div>
                <Link href={`/advisor/households/${householdId}/provider-hub`} className="mt-3 inline-block text-xs text-brass-400 hover:text-brass-300">
                  Open Provider Hub →
                </Link>
              </Card>
            )}

            {checklist.dfm.relevant && (
              <Card>
                <p className="mb-3 text-xs uppercase tracking-wide text-ink-300">DFM &amp; fund category</p>
                <div className="flex items-center gap-2">
                  <StatusDot ok={checklist.dfm.hasRecommendation} />
                  <span className="text-xs text-ink-400">
                    {checklist.dfm.hasRecommendation ? checklist.dfm.latestMandate : 'No recommendation generated yet'}
                  </span>
                </div>
                <Link href={`/advisor/households/${householdId}/dfm-recommendation`} className="mt-3 inline-block text-xs text-brass-400 hover:text-brass-300">
                  Open DFM Recommendation →
                </Link>
              </Card>
            )}

            <Card>
              <p className="mb-3 text-xs uppercase tracking-wide text-ink-300">LOA template</p>
              <div className="flex items-center gap-2">
                <StatusDot ok={checklist.loa.hasActiveTemplate} />
                <span className="text-xs text-ink-400">{checklist.loa.hasActiveTemplate ? 'Firm LOA template on file' : 'No LOA template uploaded yet'}</span>
              </div>
              <Link href={`/advisor/households/${householdId}/provider-hub`} className="mt-3 inline-block text-xs text-brass-400 hover:text-brass-300">
                Open Provider Hub →
              </Link>
            </Card>
          </div>
        </>
      )}

      {history.length > 0 && (
        <Card>
          <p className="mb-3 text-xs uppercase tracking-wide text-ink-300">History</p>
          <ul className="divide-y divide-hairline/50">
            {history.map((h) => (
              <li key={h.id} className="py-2 text-sm text-ink-300">
                {options.find((o) => o.actionType === h.actionType)?.label ?? h.actionType} — {formatDate(h.createdAt)}
                {h.notes && <span className="text-ink-500"> ({h.notes})</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
