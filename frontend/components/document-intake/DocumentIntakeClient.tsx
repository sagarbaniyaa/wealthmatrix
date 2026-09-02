'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { ClientDocument, UploadableDocumentType, DocumentExtractionStatus } from '@/lib/types';

const INTAKE_TYPES: { type: UploadableDocumentType; label: string; help: string }[] = [
  { type: 'FACT_FIND_SOURCE', label: 'Fact Find', help: 'A completed fact-find (PDF, DOCX, or a photo of a paper form) — auto-fills the client record and creates a draft Fact Find.' },
  { type: 'RISK_PROFILE', label: 'Risk Profile', help: 'A risk-profiling questionnaire or report — summarised for adviser review.' },
  { type: 'KYC', label: 'KYC', help: 'A KYC document — identity fields are filled onto the client record.' },
  { type: 'ID_PROOF', label: 'ID', help: 'Passport/driving licence — identity fields are filled onto the client record.' },
  { type: 'ADDRESS_PROOF', label: 'Address Proof', help: 'A utility bill or similar — address fields are filled onto the client record.' },
  { type: 'BANK_STATEMENT', label: 'Bank Statement', help: 'Summarised into a client note for adviser review — figures are never auto-applied.' },
  { type: 'PROVIDER_STATEMENT', label: 'Provider Statement', help: 'A pension/investment provider statement — summarised into a client note.' },
  { type: 'FILE_NOTE', label: 'File Note', help: 'An adviser note — summarised and filed.' },
];

const STATUS_TONE: Record<DocumentExtractionStatus, string> = {
  pending: 'draft', processing: 'running', done: 'positive', failed: 'breach', unsupported: 'warning',
};
const STATUS_LABEL: Record<DocumentExtractionStatus, string> = {
  pending: 'Queued', processing: 'Processing…', done: 'Processed', failed: 'Failed', unsupported: 'Unsupported file',
};

export function DocumentIntakeClient({ householdId, initialDocuments }: { householdId: string; initialDocuments: ClientDocument[] }) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [uploadingType, setUploadingType] = useState<UploadableDocumentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  function docsOfType(type: UploadableDocumentType): ClientDocument[] {
    return documents.filter((d) => d.documentType === type).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async function uploadDocument(type: UploadableDocumentType, file: File) {
    setUploadingType(type);
    setError(null);
    try {
      const form = new FormData();
      form.append('documentType', type);
      form.append('file', file);
      const saved = await api.postForm<ClientDocument>(`households/${householdId}/documents`, form);
      setDocuments((prev) => [saved, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploadingType(null);
    }
  }

  async function reprocess(id: string) {
    const saved = await api.post<ClientDocument>(`households/${householdId}/documents/${id}/reprocess`);
    setDocuments((prev) => prev.map((d) => (d.id === id ? saved : d)));
  }

  async function deleteDocument(id: string) {
    await api.delete(`households/${householdId}/documents/${id}`);
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-rust-400">{error}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {INTAKE_TYPES.map(({ type, label, help }) => {
          const docs = docsOfType(type);
          const latest = docs[0];
          return (
            <Card key={type}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-ink-100">{label}</span>
                <label className="cursor-pointer text-xs text-brass-400 hover:text-brass-300">
                  {uploadingType === type ? 'Uploading + extracting…' : 'Upload'}
                  <input
                    type="file" accept=".pdf,.docx,.png,.jpg,.jpeg,.webp" className="hidden" disabled={uploadingType === type}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadDocument(type, f); e.target.value = ''; }}
                  />
                </label>
              </div>
              <p className="mt-1 text-xs text-ink-400">{help}</p>

              {docs.length > 0 && (
                <div className="mt-3 space-y-3 border-t border-hairline pt-3">
                  {docs.map((d) => (
                    <div key={d.id} className="text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-ink-200">{d.fileName}</span>
                        <div className="flex items-center gap-2">
                          <Badge tone={STATUS_TONE[d.extractionStatus]}>{STATUS_LABEL[d.extractionStatus]}</Badge>
                          <button onClick={() => deleteDocument(d.id)} className="text-ink-500 hover:text-rust-400">Delete</button>
                        </div>
                      </div>
                      <p className="mt-0.5 text-ink-500">{formatDate(d.createdAt)}</p>
                      {d.appliedSummary && <p className="mt-1 text-verdigris-400">{d.appliedSummary}</p>}
                      {d.extractionError && (
                        <div className="mt-1">
                          <p className="text-rust-400">{d.extractionError}</p>
                          <button onClick={() => reprocess(d.id)} className="mt-1 text-brass-400 hover:text-brass-300">Retry extraction</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {latest === undefined && <p className="mt-3 text-xs text-ink-500">Nothing uploaded yet.</p>}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
