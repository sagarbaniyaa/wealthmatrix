'use client';

import Link from 'next/link';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/format';
import type { ConsumerDutyRegisterRow, ConsumerDutyOutcomeStatus } from '@/lib/types';

function outcomeTone(status: ConsumerDutyOutcomeStatus): string {
  if (status === 'met') return 'positive';
  if (status === 'concern') return 'breach';
  return 'draft';
}

export function ConsumerDutyRegisterTable({ rows }: { rows: ConsumerDutyRegisterRow[] }) {
  return (
    <DataTable
      keyFn={(r) => r.householdId}
      rows={rows}
      emptyLabel="No households in your book yet."
      columns={[
        {
          header: 'Household',
          render: (r) => (
            <Link href={`/advisor/households/${r.householdId}/consumer-duty`} className="text-brass-400 hover:text-brass-300">
              {r.householdName}
            </Link>
          ),
        },
        {
          header: 'Vulnerability',
          render: (r) =>
            r.isVulnerable ? (
              <div className="space-y-1">
                <Badge tone="warning">Flagged</Badge>
                <p className="text-xs text-ink-300">{r.vulnerabilityFlags.map((f) => f.label).join(', ')}</p>
                {!r.supportDocumented && <p className="text-xs text-rust-400">No support documented</p>}
              </div>
            ) : (
              <span className="text-xs text-ink-400">None recorded</span>
            ),
        },
        {
          header: 'Last review',
          render: (r) =>
            r.latestFactFindCompletedOn ? (
              <span className={r.reviewOverdue ? 'text-rust-400' : 'text-ink-100'}>
                {formatDate(r.latestFactFindCompletedOn)}
                {r.reviewOverdue && <span className="ml-1 text-xs uppercase">(overdue)</span>}
              </span>
            ) : (
              <span className="text-xs text-rust-400">Never completed</span>
            ),
        },
        {
          header: 'Outcomes',
          render: (r) =>
            r.latestOutcomeReview ? (
              <div className="flex flex-wrap gap-1">
                <Badge tone={outcomeTone(r.latestOutcomeReview.priceValueOutcome)}>P&amp;V</Badge>
                <Badge tone={outcomeTone(r.latestOutcomeReview.productsServicesOutcome)}>Prod</Badge>
                <Badge tone={outcomeTone(r.latestOutcomeReview.understandingOutcome)}>Und</Badge>
                <Badge tone={outcomeTone(r.latestOutcomeReview.supportOutcome)}>Sup</Badge>
              </div>
            ) : (
              <span className="text-xs text-ink-400">Not assessed</span>
            ),
        },
        {
          header: '',
          align: 'right',
          render: (r) => (
            <Link href={`/advisor/households/${r.householdId}/consumer-duty`} className="text-xs text-brass-400 hover:text-brass-300">
              Review →
            </Link>
          ),
        },
      ]}
    />
  );
}
