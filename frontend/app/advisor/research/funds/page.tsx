import { PageHeader } from '@/components/ui/PageHeader';
import { FundsExplorer } from '@/components/research/FundsExplorer';
import { serverApiGet } from '@/lib/server-api';
import type { PagedFunds } from '@/lib/types';

export default async function FundsPage() {
  const [initialData, filterOptions] = await Promise.all([
    serverApiGet<PagedFunds>('funds?page=1&pageSize=25'),
    serverApiGet<{ sectors: string[]; assetClasses: string[] }>('funds/filter-options'),
  ]);

  return (
    <div>
      <PageHeader eyebrow="Research" title="Funds" />
      <FundsExplorer initialData={initialData} filterOptions={filterOptions} />
    </div>
  );
}
