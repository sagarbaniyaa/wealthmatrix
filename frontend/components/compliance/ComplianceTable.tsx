'use client';

import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { ComplianceLogEntry } from '@/lib/types';
import { useRouter } from 'next/navigation';

export function ComplianceTable({ entries }: { entries: ComplianceLogEntry[] }) {
  const router = useRouter();

  async function resolve(id: string) {
    await api.patch(`compliance-log/${id}/resolve`);
    router.refresh();
  }

  return (
    <DataTable
      keyFn={(r) => r.id}
      rows={entries}
      emptyLabel="No compliance findings."
      columns={[
        { header: 'Severity', render: (r) => <Badge tone={r.severity}>{r.severity}</Badge> },
        { header: 'Rule', render: (r) => <span className="font-mono text-xs text-ink-300">{r.ruleCode}</span> },
        { header: 'Finding', render: (r) => r.message },
        { header: 'Detected', render: (r) => formatDate(r.detectedAt) },
        {
          header: 'Status',
          align: 'right',
          render: (r) =>
            r.resolvedAt ? (
              <span className="text-xs text-verdigris-400">Resolved {formatDate(r.resolvedAt)}</span>
            ) : (
              <Button variant="ghost" onClick={() => resolve(r.id)} className="text-xs px-3 py-1">
                Mark resolved
              </Button>
            ),
        },
      ]}
    />
  );
}
