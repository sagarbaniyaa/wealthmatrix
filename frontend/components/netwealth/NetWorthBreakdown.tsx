import { StatTile } from '@/components/ui/StatTile';
import { Card } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { formatCurrency, formatPct } from '@/lib/format';
import type { HouseholdNetWorth } from '@/lib/types';

export function NetWorthBreakdown({ data }: { data: HouseholdNetWorth }) {
  const currency = data.baseCurrencyCode || 'GBP';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-8">
        <StatTile label="Total net worth" value={formatCurrency(data.totalNetWorth, currency)} />
        <StatTile label="Personal holdings" value={formatCurrency(data.personalNetWorth, currency)} />
        <StatTile
          label="Attributed via entities"
          value={formatCurrency(data.entityAttributedNetWorth, currency)}
        />
      </div>

      <Card>
        <p className="mb-4 text-xs uppercase tracking-wide text-ink-300">
          Entity attribution — effective ownership × entity net asset value
        </p>
        <DataTable
          keyFn={(row) => row.entityId}
          rows={data.entityBreakdown}
          emptyLabel="No indirect entity holdings for this household."
          columns={[
            { header: 'Entity', render: (r) => r.entityName },
            { header: 'Effective ownership', render: (r) => formatPct(r.effectiveOwnershipPct), align: 'right' },
            { header: 'Entity NAV', render: (r) => <span className="figure">{formatCurrency(r.entityNetAssetValue, currency)}</span>, align: 'right' },
            { header: 'Attributed value', render: (r) => <span className="figure text-brass-400">{formatCurrency(r.attributedValue, currency)}</span>, align: 'right' },
          ]}
        />
      </Card>
    </div>
  );
}
