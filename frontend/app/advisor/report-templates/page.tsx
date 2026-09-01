import { PageHeader } from '@/components/ui/PageHeader';
import { ReportTemplatesClient } from '@/components/report-builder/ReportTemplatesClient';
import { serverApiGet } from '@/lib/server-api';
import type { ReportTemplate } from '@/lib/types';

export default async function ReportTemplatesPage() {
  const templates = await serverApiGet<ReportTemplate[]>('report-templates');

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Report Builder" title="Report Templates" />
      <ReportTemplatesClient initialTemplates={templates} />
    </div>
  );
}
