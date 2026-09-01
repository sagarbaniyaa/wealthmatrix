import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { LookThroughView } from '@/components/portfolio-lookthrough/LookThroughView';
import { serverApiGet } from '@/lib/server-api';
import type { Household, PortfolioLookThroughResult } from '@/lib/types';

export default async function ClientLookThroughPage() {
  const household = await serverApiGet<Household | null>('households/me');

  if (!household) {
    return (
      <div>
        <PageHeader eyebrow="Portfolio" title="What you really own" />
        <Card><p className="text-sm text-ink-300">No household record is linked to your account yet — contact your adviser.</p></Card>
      </div>
    );
  }

  const result = await serverApiGet<PortfolioLookThroughResult>(`households/${household.id}/portfolio-lookthrough`);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Portfolio" title="What you really own" />
      <p className="-mt-4 text-sm text-ink-400">
        Your true underlying exposure — not just which funds you hold, but what those funds actually invest in,
        combined with anything you hold directly.
      </p>
      <LookThroughView result={result} />
    </div>
  );
}
