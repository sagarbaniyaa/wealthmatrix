'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import type { Provider } from '@/lib/types';

/**
 * Every email here started as a guessed placeholder (loa@providername.com
 * etc. — see the migration seed). email_verified is false until someone
 * confirms the real address, and the send flow in the provider hub blocks
 * (with an override) on an unverified provider — this table is where that
 * verification actually happens.
 */
export function ProviderDirectoryClient({ initialProviders }: { initialProviders: Provider[] }) {
  const [providers, setProviders] = useState(initialProviders);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ providerEmail: string; servicingEmail: string; newBusinessEmail: string }>({ providerEmail: '', servicingEmail: '', newBusinessEmail: '' });
  const [saving, setSaving] = useState(false);

  function startEdit(p: Provider) {
    setEditingId(p.id);
    setDraft({ providerEmail: p.providerEmail, servicingEmail: p.servicingEmail ?? '', newBusinessEmail: p.newBusinessEmail ?? '' });
  }

  async function saveEdit(id: string) {
    setSaving(true);
    try {
      const updated = await api.patch<Provider>(`providers/${id}`, {
        providerEmail: draft.providerEmail,
        servicingEmail: draft.servicingEmail || undefined,
        newBusinessEmail: draft.newBusinessEmail || undefined,
      });
      setProviders((prev) => prev.map((p) => (p.id === id ? updated : p)));
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  }

  async function verify(id: string) {
    const updated = await api.patch<Provider>(`providers/${id}/verify-email`);
    setProviders((prev) => prev.map((p) => (p.id === id ? updated : p)));
  }

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-xs uppercase tracking-wide text-ink-300">
              <th className="pb-3 font-medium">Provider</th>
              <th className="pb-3 font-medium">LOA email</th>
              <th className="pb-3 font-medium">Servicing email</th>
              <th className="pb-3 font-medium">New business email</th>
              <th className="pb-3 font-medium">Status</th>
              <th className="pb-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {providers.map((p) => {
              const editing = editingId === p.id;
              return (
                <tr key={p.id} className="border-b border-hairline/50 last:border-0">
                  <td className="py-3 text-ink-100">{p.providerName}</td>
                  {editing ? (
                    <>
                      <td className="py-2 pr-2"><EditableEmail value={draft.providerEmail} onChange={(v) => setDraft((d) => ({ ...d, providerEmail: v }))} /></td>
                      <td className="py-2 pr-2"><EditableEmail value={draft.servicingEmail} onChange={(v) => setDraft((d) => ({ ...d, servicingEmail: v }))} /></td>
                      <td className="py-2 pr-2"><EditableEmail value={draft.newBusinessEmail} onChange={(v) => setDraft((d) => ({ ...d, newBusinessEmail: v }))} /></td>
                    </>
                  ) : (
                    <>
                      <td className="py-3 font-mono text-xs text-ink-300">{p.providerEmail}</td>
                      <td className="py-3 font-mono text-xs text-ink-300">{p.servicingEmail ?? '—'}</td>
                      <td className="py-3 font-mono text-xs text-ink-300">{p.newBusinessEmail ?? '—'}</td>
                    </>
                  )}
                  <td className="py-3">
                    {p.emailVerified ? <Badge tone="positive">Verified</Badge> : <Badge tone="warning">Unverified</Badge>}
                  </td>
                  <td className="py-3 text-right">
                    {editing ? (
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" className="px-3 py-1 text-xs" onClick={() => setEditingId(null)}>Cancel</Button>
                        <Button className="px-3 py-1 text-xs" onClick={() => saveEdit(p.id)} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        {!p.emailVerified && <Button variant="ghost" className="px-3 py-1 text-xs" onClick={() => verify(p.id)}>Mark verified</Button>}
                        <Button variant="ghost" className="px-3 py-1 text-xs" onClick={() => startEdit(p)}>Edit</Button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function EditableEmail({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="email" value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-sm border border-hairline bg-ink-800 px-2 py-1 font-mono text-xs text-ink-100 outline-none focus:border-brass-500"
    />
  );
}
