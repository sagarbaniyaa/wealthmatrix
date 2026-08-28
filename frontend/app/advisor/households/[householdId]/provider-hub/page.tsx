import { PageHeader } from '@/components/ui/PageHeader';
import { ProviderHubClient } from '@/components/provider-hub/ProviderHubClient';
import { serverApiGet } from '@/lib/server-api';
import type { Household, Provider, LoaTemplate, ClientDocument, ComplianceProviderAction } from '@/lib/types';

export default async function ProviderHubPage({ params }: { params: { householdId: string } }) {
  const [household, providers, templates, documents, actions] = await Promise.all([
    serverApiGet<Household>(`households/${params.householdId}`),
    serverApiGet<Provider[]>('providers'),
    serverApiGet<LoaTemplate[]>('loa-templates'),
    serverApiGet<ClientDocument[]>(`households/${params.householdId}/documents`),
    serverApiGet<ComplianceProviderAction[]>(`households/${params.householdId}/provider-pack/actions`),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={household.name} title="Provider Hub" />
      <ProviderHubClient
        householdId={household.id}
        initialProviders={providers}
        initialTemplates={templates}
        initialDocuments={documents}
        initialActions={actions}
      />
    </div>
  );
}
