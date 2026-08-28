import { PageHeader } from '@/components/ui/PageHeader';
import { ProviderDirectoryClient } from '@/components/provider-hub/ProviderDirectoryClient';
import { ComplianceProviderLog } from '@/components/provider-hub/ComplianceProviderLog';
import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';
import type { Provider, ComplianceProviderAction } from '@/lib/types';

export default async function ProvidersPage() {
  const session = await getSession();
  const isAdmin = session?.role === 'admin';

  const [providers, actions] = await Promise.all([
    serverApiGet<Provider[]>('providers'),
    isAdmin ? serverApiGet<ComplianceProviderAction[]>('compliance-provider-actions') : Promise.resolve([] as ComplianceProviderAction[]),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Provider Hub" title="Providers" />
      <p className="-mt-6 text-sm text-ink-400">
        Every contact email below started as a guessed placeholder — confirm it (or edit it) before sending any client pack.
        LOA templates, per-client packs, and sending live on each household's page.
      </p>
      <ProviderDirectoryClient initialProviders={providers} />
      {isAdmin && <ComplianceProviderLog initialActions={actions} providers={providers} />}
    </div>
  );
}
