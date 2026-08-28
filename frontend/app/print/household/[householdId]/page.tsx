import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { serverApiGet, serverApiPost } from '@/lib/server-api';
import { formatCurrency, formatDate, formatPct } from '@/lib/format';
import { PrintButton } from '@/components/print/PrintButton';
import type { Household, HouseholdNetWorth, ComplianceLogEntry, Firm } from '@/lib/types';

interface RiskMetric { value: number | null; color: string; label: string; note: string | null }
interface HouseholdRiskMetrics {
  leverage: RiskMetric; concentration: RiskMetric; liquidity: RiskMetric;
  currencyExposure: RiskMetric; suitabilityDrift: RiskMetric;
}

export default async function HouseholdReportPage({ params }: { params: { householdId: string } }) {
  const session = await getSession();
  if (!session) redirect('/login/advisor');
  if (session.role === 'client') redirect('/client');

  const [household, netWorth, compliance, firms, risk] = await Promise.all([
    serverApiGet<Household>(`households/${params.householdId}`),
    serverApiGet<HouseholdNetWorth>(`households/${params.householdId}/net-worth`),
    serverApiGet<ComplianceLogEntry[]>(`compliance-log?householdId=${params.householdId}`),
    serverApiGet<Firm[]>('firms/me'),
    serverApiPost<HouseholdRiskMetrics>(`ai/risk-metrics/${params.householdId}`).catch(() => null),
  ]);

  const firm = firms[0];
  const unresolved = compliance.filter((c) => !c.resolvedAt);

  return (
    <div className="min-h-screen bg-paper py-12 print:py-0">
      <div className="mx-auto max-w-3xl px-10 font-sans text-ink-900 print:px-0">
        <PrintButton />

        <header className="mb-10 border-b-2 border-ink-900 pb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-ink-500">Household Summary Report</p>
          <h1 className="mt-1 text-2xl font-semibold">{household.name}</h1>
          <p className="mt-1 text-xs text-ink-500">{firm?.name} · Generated {formatDate(new Date().toISOString())}</p>
        </header>

        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-700">Net worth</h2>
          <div className="grid grid-cols-3 gap-4">
            <Tile label="Total net worth" value={formatCurrency(netWorth.totalNetWorth)} />
            <Tile label="Personal holdings" value={formatCurrency(netWorth.personalNetWorth)} />
            <Tile label="Attributed via entities" value={formatCurrency(netWorth.entityAttributedNetWorth)} />
          </div>
          {netWorth.entityBreakdown.length > 0 && (
            <table className="mt-4 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-ink-300 text-left text-xs uppercase tracking-wide text-ink-500">
                  <th className="py-2 pr-3">Entity</th>
                  <th className="py-2 pr-3">Ownership</th>
                  <th className="py-2 pr-3">Entity NAV</th>
                  <th className="py-2">Attributed value</th>
                </tr>
              </thead>
              <tbody>
                {netWorth.entityBreakdown.map((e) => (
                  <tr key={e.entityId} className="border-b border-ink-100">
                    <td className="py-2 pr-3">{e.entityName}</td>
                    <td className="py-2 pr-3">{formatPct(e.effectiveOwnershipPct)}</td>
                    <td className="py-2 pr-3">{formatCurrency(e.entityNetAssetValue)}</td>
                    <td className="py-2">{formatCurrency(e.attributedValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {risk && (
          <section className="mb-10">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-700">Risk profile</h2>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-ink-300 text-left text-xs uppercase tracking-wide text-ink-500">
                  <th className="py-2 pr-3">Metric</th>
                  <th className="py-2 pr-3">Value</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {([risk.leverage, risk.concentration, risk.liquidity, risk.currencyExposure, risk.suitabilityDrift]).map((m) => (
                  <tr key={m.label} className="border-b border-ink-100 align-top">
                    <td className="py-2 pr-3">{m.label}</td>
                    <td className="py-2 pr-3">{m.value === null ? '—' : `${m.value}%`}</td>
                    <td className="py-2 pr-3 uppercase">{m.color}</td>
                    <td className="py-2 text-ink-600">{m.note ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-700">
            Compliance ({unresolved.length} open of {compliance.length})
          </h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink-300 text-left text-xs uppercase tracking-wide text-ink-500">
                <th className="py-2 pr-3">Severity</th>
                <th className="py-2 pr-3">Finding</th>
                <th className="py-2 pr-3">Detected</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {compliance.map((c) => (
                <tr key={c.id} className="border-b border-ink-100 align-top">
                  <td className="py-2 pr-3 uppercase">{c.severity}</td>
                  <td className="py-2 pr-3">{c.message}</td>
                  <td className="py-2 pr-3">{formatDate(c.detectedAt)}</td>
                  <td className="py-2">{c.resolvedAt ? `Resolved ${formatDate(c.resolvedAt)}` : 'Open'}</td>
                </tr>
              ))}
              {compliance.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-ink-500">No compliance findings.</td></tr>
              )}
            </tbody>
          </table>
        </section>

        <footer className="mt-12 border-t border-ink-100 pt-4 text-xs text-ink-500">
          WealthMatrix Enterprise — household summary report.
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
