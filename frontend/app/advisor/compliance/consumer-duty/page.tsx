import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { StatTile } from '@/components/ui/StatTile';
import { ConsumerDutyRegisterTable } from '@/components/consumer-duty/ConsumerDutyRegisterTable';
import { serverApiGet } from '@/lib/server-api';
import type { ConsumerDutyRegister } from '@/lib/types';

export default async function ConsumerDutyPage() {
  const register = await serverApiGet<ConsumerDutyRegister>('consumer-duty');
  const { summary } = register;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="FCA Consumer Duty" title="Consumer Duty register" />

      <div className="grid grid-cols-4 gap-6">
        <Card><StatTile label="Households" value={String(summary.totalHouseholds)} /></Card>
        <Card>
          <StatTile
            label="Flagged vulnerable"
            value={String(summary.vulnerableCount)}
            tone={summary.vulnerableCount ? 'negative' : 'positive'}
          />
        </Card>
        <Card>
          <StatTile
            label="Vulnerable, no support documented"
            value={String(summary.vulnerableWithoutDocumentedSupport)}
            tone={summary.vulnerableWithoutDocumentedSupport ? 'negative' : 'positive'}
          />
        </Card>
        <Card>
          <StatTile
            label="Review overdue"
            value={String(summary.reviewOverdueCount)}
            tone={summary.reviewOverdueCount ? 'negative' : 'positive'}
          />
        </Card>
      </div>

      <Card>
        <p className="mb-4 text-xs uppercase tracking-wide text-ink-300">
          Vulnerability is read from each household&apos;s latest Fact Find. The four outcome badges reflect the
          most recent dated adviser attestation — open a household to record one.
        </p>
        <ConsumerDutyRegisterTable rows={register.households} />
      </Card>
    </div>
  );
}
