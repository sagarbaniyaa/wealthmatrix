import { PageHeader } from '@/components/ui/PageHeader';
import { RetirementCashflowClient } from '@/components/retirement-cashflow/RetirementCashflowClient';
import { serverApiGet } from '@/lib/server-api';
import type { Household, RetirementCashflowScenario } from '@/lib/types';

export default async function RetirementCashflowPage({ params }: { params: { householdId: string } }) {
  const [household, scenarios] = await Promise.all([
    serverApiGet<Household>(`households/${params.householdId}`),
    serverApiGet<RetirementCashflowScenario[]>(`households/${params.householdId}/retirement-cashflow`),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={household.name} title="Retirement Cashflow" />
      <p className="-mt-4 text-sm text-ink-400">
        A Monte Carlo sustainability model — thousands of simulated return paths, not a single forecast — showing
        the probability this household's plan actually lasts.
      </p>
      <RetirementCashflowClient householdId={household.id} initialScenarios={scenarios} />
    </div>
  );
}
