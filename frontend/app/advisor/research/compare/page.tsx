import { PageHeader } from '@/components/ui/PageHeader';
import { CompareClient } from '@/components/research/CompareClient';
import { serverApiGet } from '@/lib/server-api';
import type { PagedFunds } from '@/lib/types';

export default async function ComparePage() {
  const [initialData, filterOptions] = await Promise.all([
    serverApiGet<PagedFunds>('funds?page=1&pageSize=25'),
    serverApiGet<{ sectors: string[]; assetClasses: string[] }>('funds/filter-options'),
  ]);

  return (
    <div>
      <PageHeader eyebrow="Research" title="Compare" />
      <p className="-mt-6 mb-6 text-sm text-ink-400">Pick 2–5 funds to compare cost, risk, performance and allocation side by side.</p>
      <CompareClient initialData={initialData} filterOptions={filterOptions} />
    </div>
  );
}
