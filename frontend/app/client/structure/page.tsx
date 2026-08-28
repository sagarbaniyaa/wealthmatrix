import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { EntityStructureGraph, type EntityNavInfo } from '@/components/graph/EntityStructureGraph';
import { serverApiGet } from '@/lib/server-api';
import type { Household, OwnershipGraph, HouseholdNetWorth } from '@/lib/types';

export default async function ClientStructurePage() {
  const household = await serverApiGet<Household | null>('households/me');

  if (!household) {
    return <p className="text-sm text-ink-300">No household is linked to your account yet.</p>;
  }

  const [graph, netWorth] = await Promise.all([
    serverApiGet<OwnershipGraph>(`entities/household/${household.id}/graph`),
    serverApiGet<HouseholdNetWorth>(`households/${household.id}/net-worth`),
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
      <PageHeader eyebrow={household.name} title="Your structure" />
      <Card>
        <EntityStructureGraph graph={graph} navByEntityId={navByEntityId} />
      </Card>
    </div>
  );
}
