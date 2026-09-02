import { PageHeader } from '@/components/ui/PageHeader';
import { DfmRecommendationClient } from '@/components/dfm-recommendation/DfmRecommendationClient';
import { serverApiGet } from '@/lib/server-api';
import type { Household, DfmRecommendation } from '@/lib/types';

export default async function DfmRecommendationPage({ params }: { params: { householdId: string } }) {
  const [household, recommendations] = await Promise.all([
    serverApiGet<Household>(`households/${params.householdId}`),
    serverApiGet<DfmRecommendation[]>(`households/${params.householdId}/dfm-recommendation`),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={household.name} title="DFM & Fund Category Recommendation" />
      <DfmRecommendationClient householdId={household.id} initialRecommendations={recommendations} />
    </div>
  );
}
