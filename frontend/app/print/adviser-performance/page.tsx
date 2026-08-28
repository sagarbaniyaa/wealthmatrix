import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';
import { formatCurrency, formatDate } from '@/lib/format';
import { PrintButton } from '@/components/print/PrintButton';
import type { Household, HouseholdNetWorth, ComplianceLogEntry, Firm } from '@/lib/types';

interface AppUser { id: string; email: string; role: string }
interface Assignment { adviserId: string; householdId: string }

// Grouped by adviser_household_assignment — the table that actually
// gates access (HouseholdService.findAllForUser) — rather than the
// household.primaryAdviserId display field, so this report always
// matches what each adviser can actually see.
export default async function AdviserPerformanceReportPage() {
  const session = await getSession();
  if (!session) redirect('/login/advisor');
  if (session.role !== 'admin') redirect('/advisor/dashboard');

  const [households, advisers, assignments, compliance, firms] = await Promise.all([
    serverApiGet<Household[]>('households'),
    serverApiGet<AppUser[]>('users?role=adviser'),
    serverApiGet<Assignment[]>('adviser-assignments'),
    serverApiGet<ComplianceLogEntry[]>('compliance-log'),
    serverApiGet<Firm[]>('firms/me'),
  ]);

  const firm = firms[0];
  const netWorths = await Promise.all(
    households.map((h) => serverApiGet<HouseholdNetWorth>(`households/${h.id}/net-worth`).catch(() => null)),
  );
  const netWorthByHousehold: Record<string, number> = {};
  households.forEach((h, i) => { netWorthByHousehold[h.id] = netWorths[i]?.totalNetWorth ?? 0; });

  const openBreachesByHousehold: Record<string, number> = {};
  compliance.filter((c) => !c.resolvedAt).forEach((c) => {
    if (c.householdId) openBreachesByHousehold[c.householdId] = (openBreachesByHousehold[c.householdId] ?? 0) + 1;
  });

  const assignedHouseholdIds = new Set(assignments.map((a) => a.householdId));
  const groups = [
    ...advisers.map((a) => ({
      adviser: a,
      households: households.filter((h) => assignments.some((asn) => asn.adviserId === a.id && asn.householdId === h.id)),
    })),
    { adviser: null, households: households.filter((h) => !assignedHouseholdIds.has(h.id)) },
  ].filter((g) => g.households.length > 0);

  const firmAum = households.reduce((s, h) => s + netWorthByHousehold[h.id], 0);
  const firmBreaches = Object.values(openBreachesByHousehold).reduce((s, n) => s + n, 0);

  return (
    <div className="min-h-screen bg-paper py-12 print:py-0">
      <div className="mx-auto max-w-3xl px-10 font-sans text-ink-900 print:px-0">
        <PrintButton />

        <header className="mb-10 border-b-2 border-ink-900 pb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-ink-500">Adviser Performance Report</p>
          <h1 className="mt-1 text-2xl font-semibold">{firm?.name ?? 'WealthMatrix'}</h1>
          <p className="mt-1 text-xs text-ink-500">Generated {formatDate(new Date().toISOString())}</p>
        </header>

        <section className="mb-10 grid grid-cols-3 gap-4">
          <Tile label="Firm AUM" value={formatCurrency(firmAum)} />
          <Tile label="Households" value={String(households.length)} />
          <Tile label="Open breaches" value={String(firmBreaches)} />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-700">By adviser</h2>
          {groups.map((g) => {
            const aum = g.households.reduce((s, h) => s + netWorthByHousehold[h.id], 0);
            const breaches = g.households.reduce((s, h) => s + (openBreachesByHousehold[h.id] ?? 0), 0);
            return (
              <div key={g.adviser?.id ?? 'unassigned'} className="mb-6 border-b border-ink-100 pb-6">
                <p className="mb-2 text-sm font-semibold">{g.adviser?.email ?? 'Unassigned'}</p>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <p>AUM: <span className="font-medium">{formatCurrency(aum)}</span></p>
                  <p>Households: <span className="font-medium">{g.households.length}</span></p>
                  <p>Open breaches: <span className="font-medium">{breaches}</span></p>
                </div>
                <ul className="mt-2 text-xs text-ink-600">
                  {g.households.map((h) => (
                    <li key={h.id}>{h.name} — {formatCurrency(netWorthByHousehold[h.id])}{(openBreachesByHousehold[h.id] ?? 0) > 0 ? ` (${openBreachesByHousehold[h.id]} open finding${openBreachesByHousehold[h.id] > 1 ? 's' : ''})` : ''}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>

        <footer className="mt-12 border-t border-ink-100 pt-4 text-xs text-ink-500">
          WealthMatrix Enterprise — adviser performance report. Admin only.
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
