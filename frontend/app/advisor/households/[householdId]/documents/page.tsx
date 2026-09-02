import { PageHeader } from '@/components/ui/PageHeader';
import { DocumentIntakeClient } from '@/components/document-intake/DocumentIntakeClient';
import { serverApiGet } from '@/lib/server-api';
import type { Household, ClientDocument } from '@/lib/types';

export default async function HouseholdDocumentsPage({ params }: { params: { householdId: string } }) {
  const [household, documents] = await Promise.all([
    serverApiGet<Household>(`households/${params.householdId}`),
    serverApiGet<ClientDocument[]>(`households/${params.householdId}/documents`),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={household.name} title="Documents" />
      <p className="text-sm text-ink-400">
        Upload a Fact Find, risk profile, KYC/ID, proof of address, or a statement — each is OCR/NLP-extracted
        automatically, and the result (auto-filled fields or a summary note) shows right below it. Nothing here
        blocks the upload if extraction fails; the file is always saved.
      </p>
      <DocumentIntakeClient householdId={household.id} initialDocuments={documents} />
    </div>
  );
}
