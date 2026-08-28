import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { AdviserAssignmentCell } from '@/components/household/AdviserAssignmentCell';
import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';
import { formatDate } from '@/lib/format';
import Link from 'next/link';
import type { Household } from '@/lib/types';

interface Adviser { id: string; email: string }
interface Assignment { id: string; adviserId: string; householdId: string }

export default async function HouseholdsPage() {
  const session = await getSession();
  const isAdmin = session?.role === 'admin';

  const [households, advisers, assignments] = await Promise.all([
    serverApiGet<Household[]>('households'),
    isAdmin ? serverApiGet<Adviser[]>('users?role=adviser') : Promise.resolve([] as Adviser[]),
    isAdmin ? serverApiGet<Assignment[]>('adviser-assignments') : Promise.resolve([] as Assignment[]),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Client roster"
        title="Households"
        action={
          <Link href="/advisor/households/new">
            <Button>+ New client</Button>
          </Link>
        }
      />
      <Card>
        <DataTable
          keyFn={(h) => h.id}
          rows={households}
          emptyLabel="No households yet."
          columns={[
            { header: 'Household', render: (h) => (
              <Link href={`/advisor/households/${h.id}`} className="text-ink-100 hover:text-brass-400">{h.name}</Link>
            ) },
            { header: 'Created', render: (h) => formatDate(h.createdAt) },
            ...(isAdmin ? [{
              header: 'Adviser(s)',
              render: (h: Household) => <AdviserAssignmentCell householdId={h.id} advisers={advisers} assignments={assignments} />,
            }] : []),
          ]}
        />
      </Card>
    </div>
  );
}
