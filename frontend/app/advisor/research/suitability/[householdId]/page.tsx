import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { StatTile } from '@/components/ui/StatTile';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { FundSuitabilityAiNotes } from '@/components/research/FundSuitabilityAiNotes';
import { serverApiGet } from '@/lib/server-api';
import { formatPct } from '@/lib/format';
import type { Household, FundSuitabilityResult } from '@/lib/types';

const RISK_TONE: Record<number, string> = { 1: 'positive', 2: 'positive', 3: 'positive', 4: 'warning', 5: 'warning', 6: 'breach', 7: 'breach' };

export default async function FundSuitabilityPage({ params }: { params: { householdId: string } }) {
  const [household, suitability] = await Promise.all([
    serverApiGet<Household>(`households/${params.householdId}`),
    serverApiGet<FundSuitabilityResult>(`funds/suitability/${params.householdId}`),
  ]);

  const [minBand, maxBand] = suitability.riskRatingBand ?? [null, null];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Research · Fund suitability"
        title={household.name}
        action={
          <Link href={`/advisor/households/${household.id}`} className="text-sm text-brass-400 hover:text-brass-300">
            ← Back to household
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
        <Card><StatTile label="Risk tolerance" value={suitability.riskTolerance ? capitalise(suitability.riskTolerance) : 'Not recorded'} /></Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-ink-300">Suitable fund-risk band</p>
          <div className="mt-1">
            {minBand !== null && maxBand !== null ? <Badge tone="info">{minBand} – {maxBand} / 7</Badge> : <span className="text-ink-500">—</span>}
          </div>
        </Card>
        <Card><StatTile label="Matching funds" value={String(suitability.matchingFunds.total)} /></Card>
      </div>

      {!suitability.riskTolerance && (
        <Card>
          <p className="text-sm text-ink-400">
            This household has no recorded risk tolerance yet, so results below aren't filtered by risk band —
            record one on the client's profile for a tighter match.
          </p>
        </Card>
      )}

      <Card>
        <p className="mb-4 text-xs uppercase tracking-wide text-ink-300">Matching funds (lowest cost first)</p>
        <DataTable
          keyFn={(f) => f.id}
          rows={suitability.matchingFunds.items}
          emptyLabel="No funds match this household's risk band yet."
          columns={[
            { header: 'Fund', render: (f) => <Link href={`/advisor/research/funds/${f.id}`} className="text-ink-100 hover:text-brass-400">{f.name}</Link> },
            { header: 'Sector', render: (f) => <span className="text-ink-300">{f.sector}</span> },
            { header: 'OCF', align: 'right', render: (f) => <span className="figure">{f.ocf !== null ? formatPct(Number(f.ocf) * 100, 2) : '—'}</span> },
            {
              header: 'Risk',
              align: 'right',
              render: (f) => (f.riskRating !== null ? <Badge tone={RISK_TONE[f.riskRating] ?? 'info'}>{f.riskRating}</Badge> : '—'),
            },
          ]}
        />
      </Card>

      <Card>
        <p className="mb-4 text-xs uppercase tracking-wide text-ink-300">AI suitability notes</p>
        <FundSuitabilityAiNotes householdId={household.id} />
      </Card>
    </div>
  );
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
