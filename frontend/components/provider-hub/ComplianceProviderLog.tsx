'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { ComplianceProviderAction, Provider, ProviderActionStatus } from '@/lib/types';

const STATUS_TONE: Record<ProviderActionStatus, string> = { SENT: 'positive', RECEIVED: 'positive', PENDING: 'warning', FAILED: 'breach' };
const STATUSES: ProviderActionStatus[] = ['PENDING', 'SENT', 'RECEIVED', 'FAILED'];

/** Firm-wide compliance log viewer (admin only — same pattern as the audit trail on /advisor/compliance). */
export function ComplianceProviderLog({ initialActions, providers }: { initialActions: ComplianceProviderAction[]; providers: Provider[] }) {
  const [actions, setActions] = useState(initialActions);
  // ProviderHubClient embeds this component and prepends a new row to its
  // own `actions` state right after a send — without this sync, the copy
  // taken by useState above would stay frozen at whatever it was on
  // mount (initial props only seed state once) and the new send would
  // never show up here. The standalone admin page never changes its
  // initialActions after mount, so this is a no-op there.
  useEffect(() => setActions(initialActions), [initialActions]);
  const providerName = (id: string) => providers.find((p) => p.id === id)?.providerName ?? id;

  async function updateStatus(id: string, status: ProviderActionStatus) {
    const updated = await api.patch<ComplianceProviderAction>(`compliance-provider-actions/${id}/status`, { status });
    setActions((prev) => prev.map((a) => (a.id === id ? updated : a)));
  }

  return (
    <Card>
      <p className="mb-4 text-xs uppercase tracking-wide text-ink-300">Provider send log</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-xs uppercase tracking-wide text-ink-300">
              <th className="pb-3 font-medium">Provider</th>
              <th className="pb-3 font-medium">Documents</th>
              <th className="pb-3 font-medium">Status</th>
              <th className="pb-3 font-medium">Sent</th>
              <th className="pb-3 font-medium">Logged</th>
            </tr>
          </thead>
          <tbody>
            {actions.map((a) => (
              <tr key={a.id} className="border-b border-hairline/50 last:border-0">
                <td className="py-3 text-ink-100">{providerName(a.providerId)}</td>
                <td className="py-3 text-xs text-ink-400">{a.documentsSent.length} file{a.documentsSent.length === 1 ? '' : 's'}</td>
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    <Badge tone={STATUS_TONE[a.emailStatus]}>{a.emailStatus}</Badge>
                    <select
                      value={a.emailStatus}
                      onChange={(e) => updateStatus(a.id, e.target.value as ProviderActionStatus)}
                      className="rounded-sm border border-hairline bg-ink-800 px-1.5 py-0.5 text-xs text-ink-300 outline-none focus:border-brass-500"
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  {a.emailStatus === 'FAILED' && a.emailError && <p className="mt-1 text-xs text-rust-400">{a.emailError}</p>}
                </td>
                <td className="py-3 text-xs text-ink-400">{a.sentAt ? formatDate(a.sentAt) : '—'}</td>
                <td className="py-3 text-xs text-ink-400">{formatDate(a.createdAt)}</td>
              </tr>
            ))}
            {actions.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center text-ink-400">No provider sends logged yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
