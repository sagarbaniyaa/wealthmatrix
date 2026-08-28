import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { EntityStructureGraph, type EntityNavInfo } from '@/components/graph/EntityStructureGraph';
import { serverApiGet } from '@/lib/server-api';
import type { OwnershipGraph, HouseholdNetWorth } from '@/lib/types';

export default async function StructurePage({ params }: { params: { householdId: string } }) {
  const [graph, netWorth] = await Promise.all([
    serverApiGet<OwnershipGraph>(`entities/household/${params.householdId}/graph`),
    serverApiGet<HouseholdNetWorth>(`households/${params.householdId}/net-worth`),
  ]);

  const navByEntityId: Record<string, EntityNavInfo> = {};
  netWorth.entityBreakdown.forEach((e) => {
    navByEntityId[e.entityId] = {
      nav: e.entityNetAssetValue,
      attributedValue: e.attributedValue,
      effectiveOwnershipPct: e.effectiveOwnershipPct,
    };
  });

  return (
    <div>
      <PageHeader eyebrow="Entity structure" title="Ownership map" />
      <Card>
        <EntityStructureGraph graph={graph} navByEntityId={navByEntityId} />
      </Card>
    </div>
  );
}
