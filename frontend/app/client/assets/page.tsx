import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { StatTile } from '@/components/ui/StatTile';
import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';
import { formatCurrency } from '@/lib/format';
import type { Account, Asset, Holding, Currency } from '@/lib/types';

export default async function ClientAssetsPage() {
  const session = await getSession();
  if (!session?.personId) {
    return (
      <div>
        <PageHeader eyebrow="Assets & liabilities" title="Your holdings" />
        <p className="text-sm text-ink-300">No personal record is linked to your account yet — contact your adviser.</p>
      </div>
    );
  }

  const [accounts, currencies] = await Promise.all([
    serverApiGet<Account[]>(`accounts?ownerPersonId=${session.personId}`),
    serverApiGet<Currency[]>('currencies'),
  ]);
  const currencyCode = (id: string) => currencies.find((c) => c.id === id)?.code ?? 'GBP';

  const today = new Date().toISOString().slice(0, 10);
  const holdingLists = await Promise.all(
    accounts.map((a) => serverApiGet<Holding[]>(`holdings/account/${a.id}/latest?asOfDate=${today}`)),
  );
  const allHoldings = holdingLists.flat();
  const assetIds = Array.from(new Set(allHoldings.map((h) => h.assetId)));
  const assets = await Promise.all(assetIds.map((id) => serverApiGet<Asset>(`assets/${id}`)));
  const assetById = (id: string) => assets.find((a) => a.id === id);

  const totalAssets = allHoldings.filter((h) => !assetById(h.assetId)?.isLiability).reduce((s, h) => s + Number(h.marketValue), 0);
  const totalLiabilities = allHoldings.filter((h) => assetById(h.assetId)?.isLiability).reduce((s, h) => s + Number(h.marketValue), 0);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Assets & liabilities" title="Your holdings" />

      <div className="grid grid-cols-3 gap-6">
        <Card><StatTile label="Total assets" value={formatCurrency(totalAssets)} tone="positive" /></Card>
        <Card><StatTile label="Total liabilities" value={formatCurrency(totalLiabilities)} tone={totalLiabilities > 0 ? 'negative' : 'neutral'} /></Card>
        <Card><StatTile label="Net" value={formatCurrency(totalAssets - totalLiabilities)} /></Card>
      </div>

      {accounts.length === 0 ? (
        <Card><p className="text-sm text-ink-300">No accounts on record yet.</p></Card>
      ) : (
        accounts.map((acc) => (
          <Card key={acc.id}>
            <p className="mb-4 text-xs uppercase tracking-wide text-ink-300">
              {acc.provider ?? 'Account'} — {acc.accountType.replace(/_/g, ' ')}
            </p>
            <DataTable
              keyFn={(h) => h.id}
              rows={holdingLists[accounts.indexOf(acc)] ?? []}
              emptyLabel="No holdings on this account."
              columns={[
                { header: 'Asset', render: (h) => assetById(h.assetId)?.name ?? h.assetId },
                { header: 'Class', render: (h) => assetById(h.assetId)?.assetClass.replace(/_/g, ' ') ?? '—' },
                {
                  header: 'Type', render: (h) => (
                    <Badge tone={assetById(h.assetId)?.isLiability ? 'breach' : 'positive'}>
                      {assetById(h.assetId)?.isLiability ? 'Liability' : 'Asset'}
                    </Badge>
                  ),
                },
                {
                  header: 'Value', align: 'right', render: (h) => (
                    <span className={assetById(h.assetId)?.isLiability ? 'text-rust-400' : ''}>
                      {assetById(h.assetId)?.isLiability ? '−' : ''}{formatCurrency(Number(h.marketValue), currencyCode(h.currencyId))}
                    </span>
                  ),
                },
              ]}
            />
          </Card>
        ))
      )}
    </div>
  );
}
