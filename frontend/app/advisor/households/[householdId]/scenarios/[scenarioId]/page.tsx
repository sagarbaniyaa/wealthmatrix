import { PageHeader } from '@/components/ui/PageHeader';
import { ScenarioResultCard } from '@/components/scenario/ScenarioResultCard';
import { serverApiGet } from '@/lib/server-api';
import type { Scenario } from '@/lib/types';

export default async function ScenarioDetailPage({ params }: { params: { householdId: string; scenarioId: string } }) {
  const scenario = await serverApiGet<Scenario>(`scenarios/${params.scenarioId}`);

  return (
    <div>
      <PageHeader eyebrow="Scenario result" title={scenario.name} />
      <ScenarioResultCard scenario={scenario} />
    </div>
  );
}
