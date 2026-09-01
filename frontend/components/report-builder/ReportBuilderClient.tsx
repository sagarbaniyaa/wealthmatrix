'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { RepeatingRows } from '@/components/fact-find/fields';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { ReportTemplate, ReportCase } from '@/lib/types';

export function ReportBuilderClient({
  householdId, initialTemplates, initialCases,
}: {
  householdId: string;
  initialTemplates: ReportTemplate[];
  initialCases: ReportCase[];
}) {
  const [templateId, setTemplateId] = useState(initialTemplates[0]?.id ?? '');
  const [summary, setSummary] = useState('');
  const [facts, setFacts] = useState<{ label: string; value: string }[]>([{ label: '', value: '' }]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cases, setCases] = useState(initialCases);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(initialCases[0]?.id ?? null);
  const [draftContent, setDraftContent] = useState(initialCases[0]?.content ?? '');
  const [saving, setSaving] = useState(false);

  const activeCase = cases.find((c) => c.id === activeCaseId) ?? null;

  function selectCase(c: ReportCase) {
    setActiveCaseId(c.id);
    setDraftContent(c.content ?? '');
  }

  async function generate() {
    if (!templateId) { setError('Upload a report template first (Report Templates page).'); return; }
    setGenerating(true);
    setError(null);
    try {
      const generated = await api.post<ReportCase>(`households/${householdId}/report-cases`, {
        reportTemplateId: templateId,
        caseDetails: { summary, facts: facts.filter((f) => f.label.trim() || f.value.trim()) },
      });
      setCases((prev) => [generated, ...prev]);
      selectCase(generated);
      setSummary('');
      setFacts([{ label: '', value: '' }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate this report.');
    } finally {
      setGenerating(false);
    }
  }

  async function save(status?: 'draft' | 'final') {
    if (!activeCase) return;
    setSaving(true);
    try {
      const updated = await api.patch<ReportCase>(`households/${householdId}/report-cases/${activeCase.id}`, { content: draftContent, status });
      setCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-[380px_1fr] gap-6">
      <div className="space-y-4">
        <Card>
          <p className="mb-3 text-xs uppercase tracking-wide text-ink-300">New report</p>
          {initialTemplates.length === 0 ? (
            <p className="text-sm text-ink-400">
              No report templates yet — upload one on the{' '}
              <Link href="/advisor/report-templates" className="text-brass-400 underline">Report Templates page</Link> first.
            </p>
          ) : (
            <>
              <select
                value={templateId} onChange={(e) => setTemplateId(e.target.value)}
                className="mb-3 w-full rounded-sm border border-hairline bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none focus:border-brass-500"
              >
                {initialTemplates.map((t) => <option key={t.id} value={t.id}>{t.reportType.replace(/_/g, ' ')} — {t.name}</option>)}
              </select>
              <label className="mb-1.5 block text-xs uppercase tracking-wide text-ink-300">What's this case about?</label>
              <textarea
                value={summary} onChange={(e) => setSummary(e.target.value)} rows={3}
                placeholder="e.g. Pension transfer from Aviva to Fidelity — client wants a wider fund range and lower charges."
                className="mb-3 w-full rounded-sm border border-hairline bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brass-500"
              />
              <label className="mb-1.5 block text-xs uppercase tracking-wide text-ink-300">Key facts (optional)</label>
              <RepeatingRows
                rows={facts}
                onChange={setFacts}
                emptyRow={{ label: '', value: '' }}
                addLabel="Add fact"
                renderRow={(row, update) => (
                  <>
                    <input value={row.label} onChange={(e) => update({ label: e.target.value })} placeholder="e.g. Transfer value"
                      className="rounded-sm border border-hairline bg-ink-800 px-2 py-1.5 text-xs text-ink-100 outline-none placeholder:text-ink-500 focus:border-brass-500" />
                    <input value={row.value} onChange={(e) => update({ value: e.target.value })} placeholder="e.g. £150,000"
                      className="rounded-sm border border-hairline bg-ink-800 px-2 py-1.5 text-xs text-ink-100 outline-none placeholder:text-ink-500 focus:border-brass-500" />
                  </>
                )}
              />
              <Button className="mt-4 w-full px-4 py-2 text-xs" onClick={generate} disabled={generating}>
                {generating ? 'Drafting…' : 'Generate report'}
              </Button>
              {error && <p className="mt-2 text-xs text-rust-400">{error}</p>}
              <p className="mt-2 text-xs text-ink-500">Uses the household's latest completed fact find automatically.</p>
            </>
          )}
        </Card>

        <Card>
          <p className="mb-3 text-xs uppercase tracking-wide text-ink-300">Past reports</p>
          <ul className="divide-y divide-hairline/50">
            {cases.map((c) => (
              <li key={c.id}>
                <button onClick={() => selectCase(c)} className={`block w-full py-2 text-left text-sm ${activeCaseId === c.id ? 'text-brass-400' : 'text-ink-300 hover:text-ink-100'}`}>
                  <div className="flex items-center justify-between">
                    <span>{c.reportType.replace(/_/g, ' ')}</span>
                    <Badge tone={c.status === 'final' ? 'positive' : 'draft'}>{c.status}</Badge>
                  </div>
                  <p className="text-xs text-ink-500">{formatDate(c.createdAt)}</p>
                </button>
              </li>
            ))}
            {cases.length === 0 && <p className="py-2 text-sm text-ink-400">No reports generated yet.</p>}
          </ul>
        </Card>
      </div>

      <Card>
        {!activeCase ? (
          <p className="text-sm text-ink-400">Generate a report, or select one from "Past reports", to view it here.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-300">{activeCase.reportType.replace(/_/g, ' ')}</p>
                <p className="text-xs text-ink-500">{activeCase.caseDetails.summary}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={activeCase.status === 'final' ? 'positive' : 'draft'}>{activeCase.status}</Badge>
                <Link href={`/print/report-case/${activeCase.id}?householdId=${householdId}`} target="_blank">
                  <Button variant="ghost" className="px-3 py-1 text-xs">Print / PDF →</Button>
                </Link>
              </div>
            </div>

            {activeCase.generationError && !activeCase.content && (
              <p className="text-sm text-rust-400">AI draft unavailable — {activeCase.generationError}. Write the report manually below.</p>
            )}

            <textarea
              value={draftContent} onChange={(e) => setDraftContent(e.target.value)} rows={24}
              className="w-full rounded-sm border border-hairline bg-ink-800 px-3 py-3 font-mono text-xs leading-relaxed text-ink-100 outline-none focus:border-brass-500"
              placeholder="Report content — use ## for section headings."
            />
            <div className="flex gap-2">
              <Button variant="ghost" className="px-4 py-2 text-xs" onClick={() => save('draft')} disabled={saving}>{saving ? 'Saving…' : 'Save draft'}</Button>
              <Button className="px-4 py-2 text-xs" onClick={() => save('final')} disabled={saving}>Mark final</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
