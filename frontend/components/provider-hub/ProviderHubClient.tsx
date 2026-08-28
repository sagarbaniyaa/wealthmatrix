'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ComplianceProviderLog } from './ComplianceProviderLog';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type {
  Provider, LoaTemplate, ClientDocument, ComplianceProviderAction, PackManifestEntry, UploadableDocumentType,
} from '@/lib/types';

const UPLOADABLE_TYPES: { type: UploadableDocumentType; label: string }[] = [
  { type: 'KYC', label: 'KYC' },
  { type: 'ID_PROOF', label: 'ID Proof' },
  { type: 'ADDRESS_PROOF', label: 'Address Proof' },
  { type: 'BANK_STATEMENT', label: 'Bank Statements' },
];

export function ProviderHubClient({
  householdId, initialProviders, initialTemplates, initialDocuments, initialActions,
}: {
  householdId: string;
  initialProviders: Provider[];
  initialTemplates: LoaTemplate[];
  initialDocuments: ClientDocument[];
  initialActions: ComplianceProviderAction[];
}) {
  const [providerId, setProviderId] = useState(initialProviders[0]?.id ?? '');
  const [templates, setTemplates] = useState(initialTemplates);
  const [templateId, setTemplateId] = useState(initialTemplates[0]?.id ?? '');
  const [documents, setDocuments] = useState(initialDocuments);
  const [actions, setActions] = useState(initialActions);

  const [preview, setPreview] = useState<{ manifest: PackManifestEntry[]; missingRequired: string[] } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [confirmUnverified, setConfirmUnverified] = useState(false);

  const [templateName, setTemplateName] = useState('');
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [uploadingDocType, setUploadingDocType] = useState<UploadableDocumentType | null>(null);

  const provider = useMemo(() => initialProviders.find((p) => p.id === providerId) ?? null, [initialProviders, providerId]);

  function docsOfType(type: UploadableDocumentType): ClientDocument[] {
    return documents.filter((d) => d.documentType === type && d.source === 'uploaded').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async function uploadTemplate(file: File) {
    if (!templateName.trim()) { setPreviewError('Give the template a name first.'); return; }
    setUploadingTemplate(true);
    try {
      const form = new FormData();
      form.append('name', templateName.trim());
      form.append('file', file);
      const saved = await api.postForm<LoaTemplate>('loa-templates', form);
      setTemplates((prev) => [saved, ...prev.filter((t) => t.name !== saved.name)]);
      setTemplateId(saved.id);
      setTemplateName('');
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Could not upload this LOA template.');
    } finally {
      setUploadingTemplate(false);
    }
  }

  async function uploadDocument(type: UploadableDocumentType, file: File) {
    setUploadingDocType(type);
    try {
      const form = new FormData();
      form.append('documentType', type);
      form.append('file', file);
      const saved = await api.postForm<ClientDocument>(`households/${householdId}/documents`, form);
      setDocuments((prev) => [saved, ...prev]);
    } finally {
      setUploadingDocType(null);
    }
  }

  async function deleteDocument(id: string) {
    await api.delete(`households/${householdId}/documents/${id}`);
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }

  function packBody() {
    return { providerId, loaTemplateId: templateId || undefined };
  }

  async function runPreview() {
    setPreviewLoading(true);
    setPreviewError(null);
    setSendSuccess(null);
    try {
      const res = await api.post<{ manifest: PackManifestEntry[]; missingRequired: string[] }>(`households/${householdId}/provider-pack/preview`, packBody());
      setPreview(res);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Could not build a preview.');
    } finally {
      setPreviewLoading(false);
    }
  }

  async function runGenerate() {
    setGenerating(true);
    setPreviewError(null);
    try {
      const blob = await api.postBlob(`households/${householdId}/provider-pack/generate`, packBody());
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'provider_pack.zip';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Could not generate the pack.');
    } finally {
      setGenerating(false);
    }
  }

  async function runSend(override = false) {
    setSending(true);
    setSendError(null);
    setSendSuccess(null);
    try {
      const res = await api.post<{ action: ComplianceProviderAction; manifest: PackManifestEntry[]; missingRequired: string[] }>(
        `households/${householdId}/provider-pack/send`,
        { ...packBody(), overrideUnverifiedEmail: override },
      );
      setActions((prev) => [res.action, ...prev]);
      setConfirmUnverified(false);
      setSendSuccess(res.action.emailStatus === 'SENT' ? 'Sent to provider.' : `Logged with status ${res.action.emailStatus}.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not send to provider.';
      if (!override && message.includes("hasn't been verified")) {
        setConfirmUnverified(true);
      } else {
        setSendError(message);
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <p className="mb-3 text-xs uppercase tracking-wide text-ink-300">Provider</p>
        <div className="grid gap-4 md:grid-cols-2">
          <select
            value={providerId} onChange={(e) => { setProviderId(e.target.value); setPreview(null); }}
            className="w-full rounded-sm border border-hairline bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none focus:border-brass-500"
          >
            {initialProviders.map((p) => <option key={p.id} value={p.id}>{p.providerName}</option>)}
          </select>
          {provider && (
            <div className="flex items-center gap-2 text-xs text-ink-400">
              <span className="font-mono">{provider.providerEmail}</span>
              {provider.emailVerified ? <Badge tone="positive">Verified</Badge> : <Badge tone="warning">Unverified</Badge>}
            </div>
          )}
        </div>
        {provider && (
          <div className="mt-4 border-t border-hairline pt-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-ink-300">Required documents</p>
            <ul className="flex flex-wrap gap-2 text-xs text-ink-300">
              {provider.requiredDocuments.map((d) => <li key={d} className="rounded-sm border border-hairline px-2 py-1">{d}</li>)}
            </ul>
          </div>
        )}
      </Card>

      <Card>
        <p className="mb-3 text-xs uppercase tracking-wide text-ink-300">LOA template</p>
        {templates.length > 0 && (
          <select
            value={templateId} onChange={(e) => setTemplateId(e.target.value)}
            className="w-full rounded-sm border border-hairline bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none focus:border-brass-500"
          >
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name} (v{t.version})</option>)}
          </select>
        )}
        {templates.length === 0 && <p className="mb-3 text-sm text-ink-400">No LOA template uploaded yet — upload one below (.docx with {'{{'}client_name{'}}'}-style markers, or a fillable PDF form).</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="text" placeholder="Template name" value={templateName} onChange={(e) => setTemplateName(e.target.value)}
            className="rounded-sm border border-hairline bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brass-500"
          />
          <label className="cursor-pointer rounded-sm border border-hairline px-3 py-2 text-xs text-ink-300 hover:border-brass-500 hover:text-ink-100">
            {uploadingTemplate ? 'Uploading…' : 'Upload template'}
            <input
              type="file" accept=".docx,.pdf" className="hidden" disabled={uploadingTemplate}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadTemplate(f); e.target.value = ''; }}
            />
          </label>
        </div>
      </Card>

      <Card>
        <p className="mb-3 text-xs uppercase tracking-wide text-ink-300">Client documents</p>
        <div className="grid gap-4 md:grid-cols-2">
          {UPLOADABLE_TYPES.map(({ type, label }) => {
            const latest = docsOfType(type)[0];
            return (
              <div key={type} className="rounded-sm border border-hairline p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wide text-ink-300">{label}</span>
                  <label className="cursor-pointer text-xs text-brass-400 hover:text-brass-300">
                    {uploadingDocType === type ? 'Uploading…' : latest ? 'Replace' : 'Upload'}
                    <input
                      type="file" className="hidden" disabled={uploadingDocType === type}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadDocument(type, f); e.target.value = ''; }}
                    />
                  </label>
                </div>
                {latest ? (
                  <div className="mt-2 flex items-center justify-between text-xs text-ink-400">
                    <span className="truncate">{latest.fileName} · {formatDate(latest.createdAt)}</span>
                    <button onClick={() => deleteDocument(latest.id)} className="text-rust-400 hover:text-rust-300">Remove</button>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-ink-500">Not uploaded.</p>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" className="px-4 py-2 text-xs" onClick={runPreview} disabled={!providerId || previewLoading}>
            {previewLoading ? 'Building preview…' : 'Auto-fill preview'}
          </Button>
          <Button variant="ghost" className="px-4 py-2 text-xs" onClick={runGenerate} disabled={!providerId || generating}>
            {generating ? 'Generating…' : 'Generate pack'}
          </Button>
          <Button className="px-4 py-2 text-xs" onClick={() => runSend(false)} disabled={!providerId || sending}>
            {sending ? 'Sending…' : 'Send to Provider'}
          </Button>
        </div>
        {previewError && <p className="mt-3 text-xs text-rust-400">{previewError}</p>}
        {sendError && <p className="mt-3 text-xs text-rust-400">{sendError}</p>}
        {sendSuccess && <p className="mt-3 text-xs text-verdigris-400">{sendSuccess}</p>}

        {confirmUnverified && (
          <div className="mt-4 rounded-sm border border-brass-500/40 bg-brass-500/10 p-4">
            <p className="text-sm text-ink-100">
              {provider?.providerName}'s email hasn't been verified — it's a placeholder guess, and this pack includes client PII
              (NI number, bank statements, ID). Confirm the real address on the <a href="/advisor/providers" className="text-brass-400 underline">Providers page</a> if you can,
              or send anyway if you've already checked it another way.
            </p>
            <div className="mt-3 flex gap-2">
              <Button variant="ghost" className="px-3 py-1 text-xs" onClick={() => setConfirmUnverified(false)}>Cancel</Button>
              <Button className="px-3 py-1 text-xs" onClick={() => runSend(true)} disabled={sending}>Send anyway</Button>
            </div>
          </div>
        )}

        {preview && (
          <div className="mt-4 border-t border-hairline pt-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-ink-300">Pack contents</p>
            <ul className="space-y-1 text-xs">
              {preview.manifest.map((m) => (
                <li key={m.documentType} className={m.included ? 'text-ink-300' : 'text-ink-500'}>
                  {m.included ? '✓' : '—'} {m.documentType} {m.included && `(${m.fileName})`}
                </li>
              ))}
            </ul>
            {preview.missingRequired.length > 0 && (
              <p className="mt-2 text-xs text-brass-400">Missing (required by this provider): {preview.missingRequired.join(', ')}</p>
            )}
          </div>
        )}
      </Card>

      <ComplianceProviderLog initialActions={actions} providers={initialProviders} />
    </div>
  );
}
