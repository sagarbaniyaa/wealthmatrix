'use client';

import { useState } from 'react';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/format';
import type { AuditLogEntry } from '@/lib/types';

const ACTION_TONE: Record<string, string> = { INSERT: 'positive', UPDATE: 'warning', DELETE: 'breach' };

export function AuditTrailViewer({ entries }: { entries: AuditLogEntry[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div>
      <DataTable
        keyFn={(e) => e.id}
        rows={entries}
        emptyLabel="No audit activity yet."
        columns={[
          { header: 'Action', render: (e) => <Badge tone={ACTION_TONE[e.action] ?? 'info'}>{e.action}</Badge> },
          { header: 'Table', render: (e) => <span className="font-mono text-xs">{e.tableName}</span> },
          { header: 'Row', render: (e) => <span className="font-mono text-xs text-ink-500">{e.rowId.slice(0, 8)}…</span> },
          { header: 'When', render: (e) => formatDate(e.changedAt) },
          {
            header: '', align: 'right', render: (e) => (
              <button
                onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                className="text-xs text-brass-400 hover:text-brass-300"
              >
                {expanded === e.id ? 'Hide' : 'View diff'}
              </button>
            ),
          },
        ]}
      />
      {expanded && (
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-hairline pt-4">
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-ink-300">Before</p>
            <pre className="max-h-64 overflow-auto rounded-sm bg-ink-800 p-3 text-xs text-ink-300">
              {JSON.stringify(entries.find((e) => e.id === expanded)?.beforeData ?? null, null, 2)}
            </pre>
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-ink-300">After</p>
            <pre className="max-h-64 overflow-auto rounded-sm bg-ink-800 p-3 text-xs text-ink-300">
              {JSON.stringify(entries.find((e) => e.id === expanded)?.afterData ?? null, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
