import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { StatTile } from '@/components/ui/StatTile';
import { serverApiGet } from '@/lib/server-api';
import { formatCurrency } from '@/lib/format';
import Link from 'next/link';
import type { Household, ComplianceLogEntry, HouseholdNetWorth, RiskExposure, ComplianceSeverity } from '@/lib/types';

// Whole-book triage: every household in one table, worst-first, so an
// adviser/admin can scan the entire firm and see who needs attention
// without opening each household individually. Per-household net worth
// and risk are fetched in parallel; compliance findings are fetched once
// (firm-wide) and grouped client-side by householdId.
interface Row {
  household: Household;
  netWorth: HouseholdNetWorth | null;
  risk: RiskExposure | null;
  findings: ComplianceLogEntry[];
}

const SEVERITY_RANK: Record<ComplianceSeverity, number> = { breach: 3, warning: 2, info: 1 };

function worstSeverity(findings: ComplianceLogEntry[]): ComplianceSeverity | null {
  if (findings.length === 0) return null;
  return findings.reduce<ComplianceSeverity>(
    (worst, f) => (SEVERITY_RANK[f.severity] > SEVERITY_RANK[worst] ? f.severity : worst),
    findings[0].severity,
  );
}

function isRiskFlagged(risk: RiskExposure | null): boolean {
  if (!risk) return false;
  return (risk.leverageRatio ?? 0) > 0.5 || (risk.concentrationPct ?? 0) > 30 || (risk.liquidityRatio ?? 1) < 0.1;
}

export default async function AdviserDashboardPage() {
  const [households, unresolved] = await Promise.all([
    serverApiGet<Household[]>('households'),
    serverApiGet<ComplianceLogEntry[]>('compliance-log/unresolved'),
  ]);

  const rows: Row[] = await Promise.all(
    households.map(async (household) => {
      const [netWorth, risk] = await Promise.all([
        serverApiGet<HouseholdNetWorth>(`households/${household.id}/net-worth`).catch(() => null),
        serverApiGet<RiskExposure | null>(`risk-exposure/household/${household.id}/latest`).catch(() => null),
      ]);
      return {
        household,
        netWorth,
        risk,
        findings: unresolved.filter((f) => f.householdId === household.id),
      };
    }),
  );

  // Triage order: breaches first, then warnings, then flagged risk, then largest book.
  const severityScore = (findings: ComplianceLogEntry[]) => {
    const worst = worstSeverity(findings);
    return worst ? SEVERITY_RANK[worst] : 0;
  };
  rows.sort((a, b) => {
    const sevDiff = severityScore(b.findings) - severityScore(a.findings);
    if (sevDiff !== 0) return sevDiff;
    const riskDiff = Number(isRiskFlagged(b.risk)) - Number(isRiskFlagged(a.risk));
    if (riskDiff !== 0) return riskDiff;
    return (b.netWorth?.totalNetWorth ?? 0) - (a.netWorth?.totalNetWorth ?? 0);
  });

  const totalAum = rows.reduce((sum, r) => sum + (r.netWorth?.totalNetWorth ?? 0), 0);
  const flaggedCount = rows.filter((r) => r.findings.length > 0 || isRiskFlagged(r.risk)).length;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Whole-book triage" title="Firm dashboard" />

      <div className="grid grid-cols-4 gap-6">
        <Card><StatTile label="Households" value={String(households.length)} /></Card>
        <Card><StatTile label="Total AUM (est.)" value={formatCurrency(totalAum)} /></Card>
        <Card><StatTile label="Open compliance findings" value={String(unresolved.length)} tone={unresolved.length ? 'negative' : 'positive'} /></Card>
        <Card><StatTile label="Households needing attention" value={String(flaggedCount)} tone={flaggedCount ? 'negative' : 'positive'} /></Card>
      </div>

      <Card>
        <p className="mb-4 text-xs uppercase tracking-wide text-ink-300">
          Book — sorted by what needs attention first
        </p>
        <DataTable
          keyFn={(r) => r.household.id}
          rows={rows}
          emptyLabel="No households yet — add your first client."
          columns={[
            {
              header: 'Household',
              render: (r) => (
                <Link href={`/advisor/households/${r.household.id}`} className="text-ink-100 hover:text-brass-400">
                  {r.household.name}
                </Link>
              ),
            },
            {
              header: 'Net worth',
              align: 'right',
              render: (r) => (r.netWorth ? formatCurrency(r.netWorth.totalNetWorth, r.netWorth.baseCurrencyCode) : '—'),
            },
            {
              header: 'Risk',
              render: (r) =>
                r.risk ? (
                  <Badge tone={isRiskFlagged(r.risk) ? 'breach' : 'positive'}>
                    {isRiskFlagged(r.risk) ? 'Flagged' : 'Within limits'}
                  </Badge>
                ) : (
                  <span className="text-ink-500">No data</span>
                ),
            },
            {
              header: 'Compliance',
              render: (r) => {
                const worst = worstSeverity(r.findings);
                if (!worst) return <span className="text-ink-500">Clear</span>;
                return (
                  <Badge tone={worst}>
                    {r.findings.length} open · {worst}
                  </Badge>
                );
              },
            },
            {
              header: '',
              render: (r) => (
                <Link href={`/advisor/households/${r.household.id}`} className="text-xs text-brass-400 hover:text-brass-300">
                  Open →
                </Link>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
