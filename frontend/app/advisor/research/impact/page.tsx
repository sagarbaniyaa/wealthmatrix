import { PageHeader } from '@/components/ui/PageHeader';
import { ImpactClient } from '@/components/research/ImpactClient';
import { serverApiGet } from '@/lib/server-api';
import type { Household, PagedFunds } from '@/lib/types';

export default async function ImpactPage({ searchParams }: { searchParams: { fundA?: string } }) {
  const [households, fundsPage] = await Promise.all([
    serverApiGet<Household[]>('households'),
    serverApiGet<PagedFunds>('funds?page=1&pageSize=100&sortBy=name&sortDir=ASC'),
  ]);

  return (
    <div>
      <PageHeader eyebrow="Research" title="Switch impact" />
      <p className="-mt-6 mb-6 text-sm text-ink-400">See the cost, risk, volatility and liquidity impact of switching a household's holding from one fund to another.</p>
      <ImpactClient households={households} funds={fundsPage.items} initialFundAId={searchParams.fundA} />
    </div>
  );
}
