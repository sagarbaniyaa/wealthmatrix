import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';
import { formatDate } from '@/lib/format';
import Link from 'next/link';
import type { Household, Scenario } from '@/lib/types';

interface WealthEntitySummary { id: string; name: string; entityType: string; householdId: string | null }

export default async function ReportsPage() {
  const session = await getSession();
  const [households, entities, scenarios] = await Promise.all([
    serverApiGet<Household[]>('households'),
    serverApiGet<WealthEntitySummary[]>('entities'),
    serverApiGet<Scenario[]>('scenarios'),
  ]);
  const householdName = (id: string) => households.find((h) => h.id === id)?.name ?? '—';

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Client reporting" title="Reports" />

      <Card>
        <p className="mb-4 text-xs uppercase tracking-wide text-ink-300">Household summary reports</p>
        <DataTable
          keyFn={(h) => h.id}
          rows={households}
          emptyLabel="No households yet."
          columns={[
            { header: 'Household', render: (h) => <span className="text-ink-100">{h.name}</span> },
            { header: 'Created', render: (h) => formatDate(h.createdAt) },
            { header: '', align: 'right', render: (h) => (
              <div className="flex justify-end gap-3">
                <Link href={`/print/suitability/${h.id}`} target="_blank"><Button variant="ghost" className="text-xs px-3 py-1">Suitability →</Button></Link>
                <Link href={`/print/household/${h.id}`} target="_blank"><Button variant="ghost" className="text-xs px-3 py-1">Export →</Button></Link>
              </div>
            ) },
          ]}
        />
      </Card>

      <Card>
        <p className="mb-4 text-xs uppercase tracking-wide text-ink-300">Entity reports</p>
        <DataTable
          keyFn={(e) => e.id}
          rows={entities}
          emptyLabel="No entities yet."
          columns={[
            { header: 'Entity', render: (e) => <span className="text-ink-100">{e.name}</span> },
            { header: 'Type', render: (e) => e.entityType.replace(/_/g, ' ') },
            { header: 'Household', render: (e) => (e.householdId ? householdName(e.householdId) : '—') },
            { header: '', align: 'right', render: (e) => (
              <Link href={`/print/entity/${e.id}`} target="_blank"><Button variant="ghost" className="text-xs px-3 py-1">Export →</Button></Link>
            ) },
          ]}
        />
      </Card>

      <Card>
        <p className="mb-4 text-xs uppercase tracking-wide text-ink-300">Scenario reports</p>
        <DataTable
          keyFn={(s) => s.id}
          rows={scenarios}
          emptyLabel="No scenarios have been run yet."
          columns={[
            { header: 'Scenario', render: (s) => <span className="text-ink-100">{s.name}</span> },
            { header: 'Household', render: (s) => householdName(s.householdId) },
            { header: 'Event', render: (s) => s.eventType.replace(/_/g, ' ') },
            { header: '', align: 'right', render: (s) => (
              <Link href={`/print/scenario/${s.id}`} target="_blank"><Button variant="ghost" className="text-xs px-3 py-1">Export →</Button></Link>
            ) },
          ]}
        />
      </Card>

      {session?.role === 'admin' && (
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-300">Adviser performance report</p>
              <p className="mt-1 text-sm text-ink-300">Firm-wide AUM, household counts, and open breaches by adviser.</p>
            </div>
            <Link href="/print/adviser-performance" target="_blank"><Button variant="ghost">Export →</Button></Link>
          </div>
        </Card>
      )}
    </div>
  );
}
