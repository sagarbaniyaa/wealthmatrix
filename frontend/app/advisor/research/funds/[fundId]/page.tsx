import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { StatTile } from '@/components/ui/StatTile';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { FundPerformanceChart } from '@/components/research/FundPerformanceChart';
import { FundAiSummary } from '@/components/research/FundAiSummary';
import { serverApiGet } from '@/lib/server-api';
import { formatCurrency, formatDate, formatPct } from '@/lib/format';
import type { Fund, FundPerformance, FundHolding, FundAllocation } from '@/lib/types';

const RISK_TONE: Record<number, string> = { 1: 'positive', 2: 'positive', 3: 'positive', 4: 'warning', 5: 'warning', 6: 'breach', 7: 'breach' };

export default async function FundDetailPage({ params }: { params: { fundId: string } }) {
  const [fund, performance, holdings, allocation] = await Promise.all([
    serverApiGet<Fund>(`funds/${params.fundId}`),
    serverApiGet<FundPerformance[]>(`funds/${params.fundId}/performance`),
    serverApiGet<FundHolding[]>(`funds/${params.fundId}/holdings`),
    serverApiGet<FundAllocation[]>(`funds/${params.fundId}/allocation`),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`${fund.sector} · ${fund.assetClass.replace('_', ' ')}`}
        title={fund.name}
        action={
          <Link href={`/advisor/research/impact?fundA=${fund.id}`} className="text-sm text-brass-400 hover:text-brass-300">
            Use in switch impact tool →
          </Link>
        }
      />
      <p className="-mt-6 font-mono text-xs text-ink-500">ISIN {fund.isin}{fund.sedol && ` · SEDOL ${fund.sedol}`}</p>

      <div className="grid grid-cols-2 gap-6 md:grid-cols-5">
        <Card><StatTile label="OCF" value={fund.ocf !== null ? formatPct(Number(fund.ocf) * 100, 2) : '—'} /></Card>
        <Card><StatTile label="Yield" value={fund.yieldPct !== null ? formatPct(Number(fund.yieldPct)) : '—'} tone="positive" /></Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-ink-300">Risk rating</p>
          <div className="mt-1">{fund.riskRating !== null ? <Badge tone={RISK_TONE[fund.riskRating] ?? 'info'}>{fund.riskRating} / 7</Badge> : <span className="text-ink-500">—</span>}</div>
        </Card>
        <Card><StatTile label="Volatility" value={fund.volatilityPct !== null ? formatPct(Number(fund.volatilityPct)) : '—'} /></Card>
        <Card><StatTile label="Max drawdown" value={fund.maxDrawdownPct !== null ? formatPct(Number(fund.maxDrawdownPct)) : '—'} tone="negative" /></Card>
      </div>

      <div className="grid grid-cols-2 gap-8">
        <Card>
          <p className="mb-4 text-xs uppercase tracking-wide text-ink-300">Performance</p>
          <FundPerformanceChart performance={performance} />
        </Card>

        <Card>
          <p className="mb-4 text-xs uppercase tracking-wide text-ink-300">Asset allocation</p>
          {allocation.length === 0 ? (
            <p className="text-sm text-ink-400">No allocation data recorded for this fund yet.</p>
          ) : (
            <div className="space-y-3">
              {allocation.map((a) => (
                <div key={a.id}>
                  <div className="mb-1 flex items-baseline justify-between text-xs">
                    <span className="uppercase tracking-wide text-ink-300">{a.category.replace('_', ' ')}</span>
                    <span className="figure text-ink-100">{formatPct(Number(a.weightPct))}</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-ink-800">
                    <div className="h-2.5 rounded-full bg-brass-500" style={{ width: `${Math.min(Number(a.weightPct), 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <p className="mb-4 text-xs uppercase tracking-wide text-ink-300">Top holdings</p>
        <DataTable
          keyFn={(h) => h.id}
          rows={holdings}
          emptyLabel="No holdings data recorded for this fund yet."
          columns={[
            { header: 'Holding', render: (h) => h.holdingName },
            { header: 'Weight', align: 'right', render: (h) => <span className="figure">{formatPct(Number(h.holdingWeightPct))}</span> },
          ]}
        />
      </Card>

      <Card>
        <p className="mb-4 text-xs uppercase tracking-wide text-ink-300">Fund details</p>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          <Field label="Manager" value={fund.manager ?? '—'} />
          <Field label="Manager tenure" value={fund.managerTenureYears !== null ? `${Number(fund.managerTenureYears).toFixed(1)} years` : '—'} />
          <Field label="ESG score" value={fund.esgScore !== null ? Number(fund.esgScore).toFixed(0) : '—'} />
          <Field label="Inception date" value={fund.inceptionDate ? formatDate(fund.inceptionDate) : '—'} />
          <Field label="AUM" value={fund.aum !== null ? formatCurrency(Number(fund.aum)) : '—'} />
          <Field label="Data source" value={fund.dataSource ?? '—'} />
        </div>
        {fund.description && <p className="mt-4 border-t border-hairline pt-4 text-sm text-ink-300">{fund.description}</p>}
      </Card>

      <Card>
        <p className="mb-4 text-xs uppercase tracking-wide text-ink-300">AI summary</p>
        <FundAiSummary fundId={fund.id} />
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-ink-300">{label}</p>
      <p className="mt-1 text-sm text-ink-100">{value}</p>
    </div>
  );
}
