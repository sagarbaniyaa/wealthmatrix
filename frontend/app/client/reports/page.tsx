import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { NetWorthBreakdown } from '@/components/netwealth/NetWorthBreakdown';
import { PrintButton } from '@/components/print/PrintButton';
import { serverApiGet, serverApiPost } from '@/lib/server-api';
import { formatDate } from '@/lib/format';
import type { Household, HouseholdNetWorth } from '@/lib/types';

interface RiskMetric { value: number | null; color: string; label: string; note: string | null }
interface HouseholdRiskMetrics {
  leverage: RiskMetric; concentration: RiskMetric; liquidity: RiskMetric;
  currencyExposure: RiskMetric; suitabilityDrift: RiskMetric;
}

// Client-only report view — net worth and risk profile only. Deliberately
// excludes compliance findings and anything else adviser-internal (see
// the household print report for the full adviser version).
export default async function ClientReportsPage() {
  const household = await serverApiGet<Household | null>('households/me');

  if (!household) {
    return (
      <div>
        <PageHeader eyebrow="Reports" title="Your report" />
        <p className="text-sm text-ink-300">No household is linked to your account yet — contact your adviser.</p>
      </div>
    );
  }

  const [netWorth, risk] = await Promise.all([
    serverApiGet<HouseholdNetWorth>(`households/${household.id}/net-worth`),
    serverApiPost<HouseholdRiskMetrics>(`ai/risk-metrics/${household.id}`).catch(() => null),
  ]);

  return (
    <div className="space-y-6">
      <PrintButton />
      <PageHeader eyebrow={household.name} title="Your report" />
      <p className="text-xs text-ink-500">Generated {formatDate(new Date().toISOString())}</p>

      <NetWorthBreakdown data={netWorth} />

      {risk && (
        <Card>
          <p className="mb-4 text-xs uppercase tracking-wide text-ink-300">Risk profile</p>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            {([risk.leverage, risk.concentration, risk.liquidity, risk.currencyExposure, risk.suitabilityDrift]).map((m) => (
              <div key={m.label} className="rounded-sm border border-hairline bg-ink-800/50 p-4">
                <p className="text-xs uppercase tracking-wide text-ink-300">{m.label}</p>
                <p className="figure mt-1 text-xl text-ink-100">{m.value === null ? '—' : `${m.value}%`}</p>
                <p className="mt-2 text-xs text-ink-400">{m.note ?? 'No note available.'}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
