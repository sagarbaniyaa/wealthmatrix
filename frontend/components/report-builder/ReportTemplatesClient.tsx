'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { ReportTemplate } from '@/lib/types';

/**
 * Report Template Builder's directory: upload a real example of each
 * report type once (ISA setup, pension transfer, crystallisation — the
 * list is open-ended, advisers can add new types freely). Uploading a
 * new file under a name that already exists bumps its version and
 * retires the old one, same pattern as LOA templates.
 */
export function ReportTemplatesClient({ initialTemplates }: { initialTemplates: ReportTemplate[] }) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [name, setName] = useState('');
  const [reportType, setReportType] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byType = groupByType(templates);

  async function upload(file: File) {
    if (!name.trim() || !reportType.trim()) {
      setError('Give the template a name and a report type first.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('name', name.trim());
      form.append('reportType', slugify(reportType));
      form.append('file', file);
      const saved = await api.postForm<ReportTemplate>('report-templates', form);
      setTemplates((prev) => [saved, ...prev.filter((t) => t.name !== saved.name)]);
      setName('');
      setReportType('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload this template.');
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string) {
    await api.delete(`report-templates/${id}`);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="space-y-6">
      <Card>
        <p className="mb-3 text-xs uppercase tracking-wide text-ink-300">Upload a report template</p>
        <p className="mb-4 text-sm text-ink-400">
          Upload a real, full example of one report type (a .docx or .pdf you've actually sent to a client before).
          Its structure and section headings become the format future reports of this type follow — client details
          in the example are never copied into new reports, only its shape and tone are used.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <input
            type="text" placeholder="Template name (e.g. Standard Pension Transfer)" value={name} onChange={(e) => setName(e.target.value)}
            className="rounded-sm border border-hairline bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brass-500"
          />
          <input
            type="text" placeholder="Report type (e.g. Pension Transfer)" value={reportType} onChange={(e) => setReportType(e.target.value)}
            className="rounded-sm border border-hairline bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brass-500"
          />
          <label className="flex cursor-pointer items-center justify-center rounded-sm border border-dashed border-hairline px-3 py-2 text-sm text-ink-300 hover:border-brass-500 hover:text-brass-400">
            {uploading ? 'Uploading…' : 'Choose file (.docx / .pdf)'}
            <input
              type="file" accept=".docx,.pdf" className="hidden" disabled={uploading}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }}
            />
          </label>
        </div>
        {error && <p className="mt-2 text-xs text-rust-400">{error}</p>}
      </Card>

      {Object.entries(byType).map(([type, items]) => (
        <Card key={type}>
          <p className="mb-3 text-xs uppercase tracking-wide text-brass-400">{type.replace(/_/g, ' ')}</p>
          <ul className="divide-y divide-hairline/50">
            {items.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="text-sm text-ink-100">{t.name} <Badge tone="info">v{t.version}</Badge></p>
                  <p className="text-xs text-ink-500">{t.fileName} · uploaded {formatDate(t.createdAt)}</p>
                </div>
                <Button variant="ghost" className="px-3 py-1 text-xs text-rust-400" onClick={() => remove(t.id)}>Delete</Button>
              </li>
            ))}
          </ul>
        </Card>
      ))}

      {templates.length === 0 && (
        <Card><p className="text-sm text-ink-400">No report templates uploaded yet.</p></Card>
      )}
    </div>
  );
}

function groupByType(templates: ReportTemplate[]): Record<string, ReportTemplate[]> {
  const out: Record<string, ReportTemplate[]> = {};
  for (const t of templates) (out[t.reportType] ??= []).push(t);
  return out;
}

function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
