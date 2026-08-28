import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { serverApiGet } from '@/lib/server-api';
import { formatDate } from '@/lib/format';
import type { Household, FactFind } from '@/lib/types';

export default async function FactFindListPage({ params }: { params: { householdId: string } }) {
  const [household, factFinds] = await Promise.all([
    serverApiGet<Household>(`households/${params.householdId}`),
    serverApiGet<FactFind[]>(`households/${params.householdId}/fact-finds`),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={household.name}
        title="Fact Finds"
        action={
          <Link href={`/advisor/households/${household.id}/fact-find/new`}>
            <Button className="px-4 py-2 text-xs">+ New fact find</Button>
          </Link>
        }
      />
      <Card>
        <DataTable
          keyFn={(f) => f.id}
          rows={factFinds}
          emptyLabel="No fact finds recorded yet for this household."
          columns={[
            { header: 'Status', render: (f) => <Badge tone={f.status === 'completed' ? 'positive' : 'draft'}>{f.status}</Badge> },
            { header: 'Risk category', render: (f) => f.riskCategory ? f.riskCategory.replace('_', ' ') : '—' },
            { header: 'Completed', render: (f) => f.completedOn ? formatDate(f.completedOn) : '—' },
            { header: 'Last updated', render: (f) => formatDate(f.updatedAt) },
            { header: '', align: 'right', render: (f) => (
              <Link href={`/advisor/households/${household.id}/fact-find/${f.id}`} className="text-xs text-brass-400 hover:text-brass-300">Open →</Link>
            ) },
          ]}
        />
      </Card>
    </div>
  );
}
