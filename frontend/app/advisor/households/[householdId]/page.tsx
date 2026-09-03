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
            <Link href={`/advisor/households/${household.id}/call`} className="text-sm text-brass-400 hover:text-brass-300">
              Start Client Call →
            </Link>
            <Link href={`/advisor/households/${household.id}/action`} className="text-sm text-brass-400 hover:text-brass-300">
              Client Action →
            </Link>
            <Link href={`/advisor/households/${household.id}/documents`} className="text-sm text-brass-400 hover:text-brass-300">
              Documents →
            </Link>
            <Link href={`/advisor/households/${household.id}/dfm-recommendation`} className="text-sm text-brass-400 hover:text-brass-300">
              DFM Recommendation →
            </Link>
            <Link href={`/advisor/households/${household.id}/cgt-analysis`} className="text-sm text-brass-400 hover:text-brass-300">
              CGT Analysis →
            </Link>
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
            <Link href={`/advisor/households/${household.id}/look-through`} className="text-sm text-brass-400 hover:text-brass-300">
              Portfolio Look-Through →
            </Link>
            <Link href={`/advisor/households/${household.id}/retirement-cashflow`} className="text-sm text-brass-400 hover:text-brass-300">
              Retirement Cashflow →
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
            <Link href={`/advisor/households/${household.id}/consumer-duty`} className="text-sm text-brass-400 hover:text-brass-300">
              Consumer Duty →
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
