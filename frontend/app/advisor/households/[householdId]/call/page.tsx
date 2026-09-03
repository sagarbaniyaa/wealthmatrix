import { PageHeader } from '@/components/ui/PageHeader';
import { TelephonyClient } from '@/components/telephony/TelephonyClient';
import { CallSessionClient } from '@/components/call-session/CallSessionClient';
import { serverApiGet } from '@/lib/server-api';
import type { Household, ClientCallLog } from '@/lib/types';

export default async function CallSessionPage({ params }: { params: { householdId: string } }) {
  const [household, calls] = await Promise.all([
    serverApiGet<Household>(`households/${params.householdId}`),
    serverApiGet<ClientCallLog[]>(`households/${params.householdId}/telephony/calls`),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={household.name} title="Client Call" />
      <TelephonyClient householdId={household.id} initialCalls={calls} />
      <CallSessionClient householdId={household.id} />
    </div>
  );
}
