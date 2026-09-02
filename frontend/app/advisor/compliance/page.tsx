import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { ComplianceTable } from '@/components/compliance/ComplianceTable';
import { ComplianceScanButton } from '@/components/compliance/ComplianceScanButton';
import { AuditTrailViewer } from '@/components/compliance/AuditTrailViewer';
import { Button } from '@/components/ui/Button';
import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';
import type { ComplianceLogEntry, AuditLogEntry } from '@/lib/types';
import Link from 'next/link';

export default async function CompliancePage() {
  const session = await getSession();
  const entries = await serverApiGet<ComplianceLogEntry[]>('compliance-log');
  const auditEntries = session?.role === 'admin'
    ? await serverApiGet<AuditLogEntry[]>('audit-log/recent?limit=25')
    : null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="FCA-ready audit trail"
        title="Compliance log"
        action={
          <div className="flex items-center gap-3">
            <Link href="/advisor/compliance/consumer-duty">
              <Button variant="ghost">Consumer Duty register →</Button>
            </Link>
            <ComplianceScanButton />
            <Link href="/print/compliance" target="_blank">
              <Button variant="ghost">Export to PDF →</Button>
            </Link>
          </div>
        }
      />
      <Card>
        <ComplianceTable entries={entries} />
      </Card>

      {auditEntries && (
        <Card>
          <p className="mb-4 text-xs uppercase tracking-wide text-ink-300">Audit trail — recent changes (admin only)</p>
          <AuditTrailViewer entries={auditEntries} />
        </Card>
      )}
    </div>
  );
}
