import { PageHeader } from '@/components/ui/PageHeader';
import { LookThroughView } from '@/components/portfolio-lookthrough/LookThroughView';
import { serverApiGet } from '@/lib/server-api';
import type { Household, PortfolioLookThroughResult } from '@/lib/types';

export default async function LookThroughPage({ params }: { params: { householdId: string } }) {
  const [household, result] = await Promise.all([
    serverApiGet<Household>(`households/${params.householdId}`),
    serverApiGet<PortfolioLookThroughResult>(`households/${params.householdId}/portfolio-lookthrough`),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={household.name} title="Portfolio Look-Through" />
      <p className="-mt-4 text-sm text-ink-400">
        True underlying exposure across every fund this household holds — not just which funds they own, but what
        those funds actually own, aggregated with what's held directly.
      </p>
      <LookThroughView result={result} />
    </div>
  );
}
