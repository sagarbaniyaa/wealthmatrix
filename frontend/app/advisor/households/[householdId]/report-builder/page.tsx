import { PageHeader } from '@/components/ui/PageHeader';
import { ReportBuilderClient } from '@/components/report-builder/ReportBuilderClient';
import { serverApiGet } from '@/lib/server-api';
import type { Household, ReportTemplate, ReportCase } from '@/lib/types';

export default async function ReportBuilderPage({ params }: { params: { householdId: string } }) {
  const [household, templates, cases] = await Promise.all([
    serverApiGet<Household>(`households/${params.householdId}`),
    serverApiGet<ReportTemplate[]>('report-templates'),
    serverApiGet<ReportCase[]>(`households/${params.householdId}/report-cases`),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={household.name} title="Report Builder" />
      <ReportBuilderClient householdId={household.id} initialTemplates={templates} initialCases={cases} />
    </div>
  );
}
