import { PageHeader } from '@/components/ui/PageHeader';
import { ScreenerClient } from '@/components/research/ScreenerClient';
import { serverApiGet } from '@/lib/server-api';
import type { PagedFunds, FundScreen } from '@/lib/types';

export default async function ScreenerPage() {
  const [initialData, filterOptions, initialScreens] = await Promise.all([
    serverApiGet<PagedFunds>('funds/screener?page=1&pageSize=25'),
    serverApiGet<{ sectors: string[]; assetClasses: string[] }>('funds/filter-options'),
    serverApiGet<FundScreen[]>('funds/screener/saved'),
  ]);

  return (
    <div>
      <PageHeader eyebrow="Research" title="Screener" />
      <p className="-mt-6 mb-6 text-sm text-ink-400">Build a multi-filter screen, save it for later, and re-apply it any time.</p>
      <ScreenerClient initialData={initialData} filterOptions={filterOptions} initialScreens={initialScreens} />
    </div>
  );
}
