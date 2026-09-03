import { PageHeader } from '@/components/ui/PageHeader';
import { CallSessionClient } from '@/components/call-session/CallSessionClient';
import { serverApiGet } from '@/lib/server-api';
import type { Household } from '@/lib/types';

export default async function CallSessionPage({ params }: { params: { householdId: string } }) {
  const household = await serverApiGet<Household>(`households/${params.householdId}`);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={household.name} title="Client Call" />
      <CallSessionClient householdId={household.id} />
    </div>
  );
}
