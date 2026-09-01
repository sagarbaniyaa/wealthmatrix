import { PageHeader } from '@/components/ui/PageHeader';
import { NetWorthBreakdown } from '@/components/netwealth/NetWorthBreakdown';
import { RiskInsightsPanel } from '@/components/insights/RiskInsightsPanel';
import { JourneyTracker } from '@/components/household/JourneyTracker';
import { serverApiGet } from '@/lib/server-api';
import type { Household, HouseholdNetWorth, HouseholdJourney } from '@/lib/types';
import Link from 'next/link';

export default async function HouseholdDetailPage({ params }: { params: { householdId: string } }) {
  const [household, netWorth, journey] = await Promise.all([
    serverApiGet<Household>(`households/${params.householdId}`),
    serverApiGet<HouseholdNetWorth>(`households/${params.householdId}/net-worth`),
    serverApiGet<HouseholdJourney>(`households/${params.householdId}/journey`),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Household"
        title={household.name}
        action={
          <div className="flex gap-3">
            <Link href={`/advisor/households/${household.id}/profile`} className="text-sm text-brass-400 hover:text-brass-300">
              Client profile →
            </Link>
            <Link href={`/advisor/households/${household.id}/fact-find`} className="text-sm text-brass-400 hover:text-brass-300">
              Fact Finds →
            </Link>
            <Link href={`/print/suitability/${household.id}`} target="_blank" className="text-sm text-brass-400 hover:text-brass-300">
              Suitability report →
            </Link>
            <Link href={`/advisor/households/${household.id}/report-builder`} className="text-sm text-brass-400 hover:text-brass-300">
              Report Builder →
            </Link>
            <Link href={`/advisor/households/${household.id}/projections`} className="text-sm text-brass-400 hover:text-brass-300">
              Projections →
            </Link>
            <Link href={`/advisor/households/${household.id}/structure`} className="text-sm text-brass-400 hover:text-brass-300">
              View structure map →
            </Link>
            <Link href={`/advisor/households/${household.id}/scenarios`} className="text-sm text-brass-400 hover:text-brass-300">
              Scenarios →
            </Link>
            <Link href={`/advisor/research/suitability/${household.id}`} className="text-sm text-brass-400 hover:text-brass-300">
              Fund suitability →
            </Link>
            <Link href={`/advisor/households/${household.id}/provider-hub`} className="text-sm text-brass-400 hover:text-brass-300">
              Provider Hub →
            </Link>
          </div>
        }
      />
      <JourneyTracker journey={journey} />
      <NetWorthBreakdown data={netWorth} />
      <RiskInsightsPanel householdId={household.id} />
    </div>
  );
}
