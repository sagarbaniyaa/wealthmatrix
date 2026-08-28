import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { ScenarioBuilder } from '@/components/scenario/ScenarioBuilder';
import { serverApiGet } from '@/lib/server-api';
import { formatDate } from '@/lib/format';
import Link from 'next/link';
import type { Scenario } from '@/lib/types';

export default async function ScenariosPage({ params }: { params: { householdId: string } }) {
  const scenarios = await serverApiGet<Scenario[]>(`scenarios?householdId=${params.householdId}`);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="What-if modelling" title="Scenarios" />

      <Card>
        <p className="mb-4 text-xs uppercase tracking-wide text-ink-300">New scenario</p>
        <ScenarioBuilder householdId={params.householdId} />
      </Card>

      <Card>
        <p className="mb-4 text-xs uppercase tracking-wide text-ink-300">History</p>
        <DataTable
          keyFn={(s) => s.id}
          rows={scenarios}
          emptyLabel="No scenarios run yet."
          columns={[
            { header: 'Scenario', render: (s) => (
              <Link href={`/advisor/households/${params.householdId}/scenarios/${s.id}`} className="text-ink-100 hover:text-brass-400">
                {s.name}
              </Link>
            ) },
            { header: 'Event', render: (s) => s.eventType.replace(/_/g, ' ') },
            { header: 'Date', render: (s) => formatDate(s.eventDate) },
            { header: 'Status', render: (s) => <Badge tone={s.status}>{s.status}</Badge> },
          ]}
        />
      </Card>
    </div>
  );
}
