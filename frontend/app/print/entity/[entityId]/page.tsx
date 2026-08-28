import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';
import { formatCurrency, formatDate, formatPct } from '@/lib/format';
import { PrintButton } from '@/components/print/PrintButton';
import type { Firm, Account, Holding, Asset, Currency, Person, Household } from '@/lib/types';

interface WealthEntity {
  id: string; name: string; entityType: string; jurisdiction: string | null;
  registrationNumber: string | null; householdId: string | null; createdAt: string;
}
interface OwnershipRecord {
  id: string; ownerPersonId: string | null; ownerEntityId: string | null;
  ownedEntityId: string; ownershipPct: number; ownershipClass: string | null; validFrom: string; validTo: string | null;
}

export default async function EntityReportPage({ params }: { params: { entityId: string } }) {
  const session = await getSession();
  if (!session) redirect('/login/advisor');
  if (session.role === 'client') redirect('/client');

  const [entity, ownership, accounts, currencies, firms] = await Promise.all([
    serverApiGet<WealthEntity>(`entities/${params.entityId}`),
    serverApiGet<OwnershipRecord[]>(`entity-ownership?ownedEntityId=${params.entityId}`),
    serverApiGet<Account[]>(`accounts?ownerEntityId=${params.entityId}`),
    serverApiGet<Currency[]>('currencies'),
    serverApiGet<Firm[]>('firms/me'),
  ]);

  const firm = firms[0];
  const currencyCode = (id: string) => currencies.find((c) => c.id === id)?.code ?? 'GBP';
  const today = new Date().toISOString().slice(0, 10);
  const holdingLists = await Promise.all(
    accounts.map((a) => serverApiGet<Holding[]>(`holdings/account/${a.id}/latest?asOfDate=${today}`)),
  );
  const allHoldings = holdingLists.flat();
  const assetIds = Array.from(new Set(allHoldings.map((h) => h.assetId)));
  const assets = await Promise.all(assetIds.map((id) => serverApiGet<Asset>(`assets/${id}`)));
  const assetById = (id: string) => assets.find((a) => a.id === id);

  const grossAssets = allHoldings.filter((h) => !assetById(h.assetId)?.isLiability).reduce((s, h) => s + Number(h.marketValue), 0);
  const grossLiabilities = allHoldings.filter((h) => assetById(h.assetId)?.isLiability).reduce((s, h) => s + Number(h.marketValue), 0);
  const nav = grossAssets - grossLiabilities;

  const ownerNames = await Promise.all(ownership.map(async (o) => {
    if (o.ownerPersonId) {
      const p = await serverApiGet<Person>(`people/${o.ownerPersonId}`);
      return `${p.firstName} ${p.lastName}`;
    }
    if (o.ownerEntityId) {
      const e = await serverApiGet<WealthEntity>(`entities/${o.ownerEntityId}`);
      return e.name;
    }
    return 'Unknown';
  }));

  const household = entity.householdId ? await serverApiGet<Household>(`households/${entity.householdId}`).catch(() => null) : null;

  return (
    <div className="min-h-screen bg-paper py-12 print:py-0">
      <div className="mx-auto max-w-3xl px-10 font-sans text-ink-900 print:px-0">
        <PrintButton />

        <header className="mb-10 border-b-2 border-ink-900 pb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-ink-500">Entity Report</p>
          <h1 className="mt-1 text-2xl font-semibold">{entity.name}</h1>
          <p className="mt-1 text-sm text-ink-500">
            {entity.entityType.replace(/_/g, ' ')} · {entity.jurisdiction ?? 'jurisdiction n/a'}
            {household && ` · ${household.name}`}
          </p>
          <p className="mt-1 text-xs text-ink-500">{firm?.name} · Generated {formatDate(new Date().toISOString())}</p>
        </header>

        <section className="mb-10 grid grid-cols-3 gap-4">
          <Tile label="Gross assets" value={formatCurrency(grossAssets)} />
          <Tile label="Gross liabilities" value={formatCurrency(grossLiabilities)} />
          <Tile label="Net asset value" value={formatCurrency(nav)} />
        </section>

        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-700">Ownership ({ownership.length})</h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink-300 text-left text-xs uppercase tracking-wide text-ink-500">
                <th className="py-2 pr-3">Owner</th>
                <th className="py-2 pr-3">Class</th>
                <th className="py-2 pr-3">Ownership %</th>
                <th className="py-2">Since</th>
              </tr>
            </thead>
            <tbody>
              {ownership.map((o, i) => (
                <tr key={o.id} className="border-b border-ink-100">
                  <td className="py-2 pr-3">{ownerNames[i]}</td>
                  <td className="py-2 pr-3">{o.ownershipClass ?? '—'}</td>
                  <td className="py-2 pr-3">{formatPct(Number(o.ownershipPct))}</td>
                  <td className="py-2">{formatDate(o.validFrom)}</td>
                </tr>
              ))}
              {ownership.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-ink-500">No ownership records.</td></tr>
              )}
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-700">Holdings ({allHoldings.length})</h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink-300 text-left text-xs uppercase tracking-wide text-ink-500">
                <th className="py-2 pr-3">Asset</th>
                <th className="py-2 pr-3">Class</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2">Value</th>
              </tr>
            </thead>
            <tbody>
              {allHoldings.map((h) => {
                const asset = assetById(h.assetId);
                return (
                  <tr key={h.id} className="border-b border-ink-100">
                    <td className="py-2 pr-3">{asset?.name ?? h.assetId}</td>
                    <td className="py-2 pr-3">{asset?.assetClass.replace(/_/g, ' ') ?? '—'}</td>
                    <td className="py-2 pr-3">{asset?.isLiability ? 'Liability' : 'Asset'}</td>
                    <td className="py-2">{asset?.isLiability ? '−' : ''}{formatCurrency(Number(h.marketValue), currencyCode(h.currencyId))}</td>
                  </tr>
                );
              })}
              {allHoldings.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-ink-500">No holdings recorded.</td></tr>
              )}
            </tbody>
          </table>
        </section>

        <footer className="mt-12 border-t border-ink-100 pt-4 text-xs text-ink-500">
          WealthMatrix Enterprise — entity report.
        </footer>
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-ink-100 p-3">
      <p className="text-xs uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
