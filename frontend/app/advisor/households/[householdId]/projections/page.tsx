import { PageHeader } from '@/components/ui/PageHeader';
import { ChargeProjectionClient } from '@/components/charge-projection/ChargeProjectionClient';
import { serverApiGet } from '@/lib/server-api';
import type { Household, ChargeProjection } from '@/lib/types';

export default async function ProjectionsPage({ params }: { params: { householdId: string } }) {
  const [household, projections] = await Promise.all([
    serverApiGet<Household>(`households/${params.householdId}`),
    serverApiGet<ChargeProjection[]>(`households/${params.householdId}/charge-projections`),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={household.name} title="Projections" />
      <p className="-mt-4 text-sm text-ink-400">
        Compare an existing arrangement against a proposed new one — same assumed growth rate on both sides, so the
        gap shown is the charge difference, isolated.
      </p>
      <ChargeProjectionClient householdId={household.id} initialProjections={projections} />
    </div>
  );
}
