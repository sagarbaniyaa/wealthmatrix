import { PageHeader } from '@/components/ui/PageHeader';
import { ConsumerDutyReviewPanel } from '@/components/consumer-duty/ConsumerDutyReviewPanel';
import { serverApiGet } from '@/lib/server-api';
import type { Household, ConsumerDutyHouseholdDetail } from '@/lib/types';

export default async function HouseholdConsumerDutyPage({ params }: { params: { householdId: string } }) {
  const [household, detail] = await Promise.all([
    serverApiGet<Household>(`households/${params.householdId}`),
    serverApiGet<ConsumerDutyHouseholdDetail>(`households/${params.householdId}/consumer-duty`),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={household.name} title="Consumer Duty" />
      <ConsumerDutyReviewPanel
        householdId={household.id}
        vulnerabilityFlags={detail.vulnerabilityFlags}
        supportDocumented={detail.supportDocumented}
        initialHistory={detail.history}
      />
    </div>
  );
}
