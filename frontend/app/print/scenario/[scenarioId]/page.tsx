import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { serverApiGet, serverApiPost } from '@/lib/server-api';
import { formatCurrency, formatDate } from '@/lib/format';
import { PrintButton } from '@/components/print/PrintButton';
import type { Scenario, Household, Firm } from '@/lib/types';

interface ScenarioImpact {
  taxImpact: number | null; liquidityChange: number | null; entityValuationShift: number | null;
}
interface ScenarioExplainResult {
  impact: ScenarioImpact | null; explanation: string | null; explanationError: string | null;
}

export default async function ScenarioReportPage({ params }: { params: { scenarioId: string } }) {
  const session = await getSession();
  if (!session) redirect('/login/advisor');
  if (session.role === 'client') redirect('/client');

  const scenario = await serverApiGet<Scenario>(`scenarios/${params.scenarioId}`);
  const [household, firms, explain] = await Promise.all([
    serverApiGet<Household>(`households/${scenario.householdId}`),
    serverApiGet<Firm[]>('firms/me'),
    serverApiPost<ScenarioExplainResult>(`ai/scenario-explain/${params.scenarioId}`).catch(() => null),
  ]);

  const firm = firms[0];
  const result = scenario.result;

  return (
    <div className="min-h-screen bg-paper py-12 print:py-0">
      <div className="mx-auto max-w-3xl px-10 font-sans text-ink-900 print:px-0">
        <PrintButton />

        <header className="mb-10 border-b-2 border-ink-900 pb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-ink-500">Scenario Report</p>
          <h1 className="mt-1 text-2xl font-semibold">{scenario.name}</h1>
          <p className="mt-1 text-sm text-ink-500">{scenario.eventType.replace(/_/g, ' ')} · {household.name}</p>
          <p className="mt-1 text-xs text-ink-500">{firm?.name} · Generated {formatDate(new Date().toISOString())}</p>
        </header>

        {result ? (
          <>
            <section className="mb-10 grid grid-cols-3 gap-4">
              <Tile label="Baseline net worth" value={formatCurrency(result.baselineNetWorth)} />
              <Tile label="Projected net worth" value={formatCurrency(result.projectedNetWorth)} />
              <Tile label="Net worth change" value={`${result.delta >= 0 ? '+' : ''}${formatCurrency(result.delta)}`} />
            </section>

            {explain?.impact && (
              <section className="mb-10">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-700">Impact breakdown</h2>
                <div className="grid grid-cols-3 gap-4">
                  {explain.impact.taxImpact !== null && <Tile label="Tax impact" value={formatCurrency(explain.impact.taxImpact)} />}
                  {explain.impact.liquidityChange !== null && <Tile label="Liquidity change" value={`${explain.impact.liquidityChange >= 0 ? '+' : ''}${formatCurrency(explain.impact.liquidityChange)}`} />}
                  {explain.impact.entityValuationShift !== null && <Tile label="Entity valuation shift" value={`${explain.impact.entityValuationShift >= 0 ? '+' : ''}${formatCurrency(explain.impact.entityValuationShift)}`} />}
                </div>
              </section>
            )}

            <section className="mb-6">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-700">Narrative</h2>
              <p className="text-sm leading-relaxed text-ink-700">{result.narrative}</p>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-700">AI summary</h2>
              {explain?.explanation ? (
                <p className="text-sm leading-relaxed text-ink-700">{explain.explanation}</p>
              ) : (
                <p className="text-xs text-ink-500">AI summary unavailable — {explain?.explanationError ?? 'not generated.'}</p>
              )}
            </section>
          </>
        ) : (
          <p className="text-sm text-ink-500">This scenario has not been run yet.</p>
        )}

        <footer className="mt-12 border-t border-ink-100 pt-4 text-xs text-ink-500">
          WealthMatrix Enterprise — scenario report.
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
