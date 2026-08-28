import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { serverApiGet, serverApiPost } from '@/lib/server-api';
import { formatCurrency, formatDate, formatPct } from '@/lib/format';
import { PrintButton } from '@/components/print/PrintButton';
import type { Firm, SuitabilityReportResult } from '@/lib/types';

export default async function SuitabilityReportPage({ params }: { params: { householdId: string } }) {
  const session = await getSession();
  if (!session) redirect('/login/advisor');
  if (session.role === 'client') redirect('/client');

  const [firms, report] = await Promise.all([
    serverApiGet<Firm[]>('firms/me'),
    serverApiPost<SuitabilityReportResult>(`ai/suitability-report/${params.householdId}`),
  ]);
  const firm = firms[0];
  const { context, narrative, narrativeError } = report;
  const factFind = context.factFind;

  return (
    <div className="min-h-screen bg-paper py-12 print:py-0">
      <div className="mx-auto max-w-3xl px-10 font-sans text-ink-900 print:px-0">
        <PrintButton />

        <header className="mb-10 border-b-2 border-ink-900 pb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-ink-500">Suitability Report — Draft</p>
          <h1 className="mt-1 text-2xl font-semibold">{context.household.name}</h1>
          <p className="mt-1 text-xs text-ink-500">{firm?.name} · Generated {formatDate(new Date().toISOString())}</p>
          <p className="mt-3 text-xs italic text-ink-500">
            This is an AI-assisted working draft for the adviser to review and edit. It is not independent
            financial advice and must not be issued to a client without adviser review.
          </p>
        </header>

        {!factFind ? (
          <section className="mb-10 rounded-sm border border-ink-200 bg-ink-50 p-6 print:border-ink-300">
            <p className="text-sm text-ink-700">
              No completed fact find exists for this household yet. A suitability report needs the client's
              objectives and attitude-to-risk answers first —{' '}
              <Link href={`/advisor/households/${context.household.id}/fact-find`} className="underline">complete a fact find</Link> before generating this report.
            </p>
          </section>
        ) : (
          <>
            <section className="mb-10">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-700">Client circumstances &amp; objectives</h2>
              <p className="text-sm text-ink-700">
                {((factFind.reviewPurposes?.selected as string[]) ?? []).join('; ') || 'No purposes recorded.'}
              </p>
              {factFind.reviewPurposes?.reviewNotes && <p className="mt-2 text-sm text-ink-600">{factFind.reviewPurposes.reviewNotes}</p>}
              {factFind.investmentQuestions?.investmentObjectives && (
                <p className="mt-2 text-sm text-ink-600"><span className="font-medium text-ink-800">Investment objectives: </span>{factFind.investmentQuestions.investmentObjectives}</p>
              )}
            </section>

            <section className="mb-10">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-700">Risk profile &amp; capacity for loss</h2>
              <div className="grid grid-cols-3 gap-4">
                <Tile label="ATR score" value={factFind.riskScore !== null ? String(factFind.riskScore) : '—'} />
                <Tile label="ATR category" value={factFind.riskCategory ? factFind.riskCategory.replace('_', ' ') : '—'} />
                <Tile label="Fact find completed" value={factFind.completedOn ? formatDate(factFind.completedOn) : '—'} />
              </div>
              {context.riskMetrics && (
                <table className="mt-4 w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-ink-300 text-left text-xs uppercase tracking-wide text-ink-500">
                      <th className="py-2 pr-3">Metric</th><th className="py-2 pr-3">Value</th><th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(['leverage', 'concentration', 'liquidity', 'currencyExposure', 'suitabilityDrift'] as const).map((key) => {
                      const m = context.riskMetrics?.[key];
                      if (!m) return null;
                      return (
                        <tr key={key} className="border-b border-ink-100">
                          <td className="py-2 pr-3">{m.label}</td>
                          <td className="py-2 pr-3">{m.value === null ? '—' : `${m.value}%`}</td>
                          <td className="py-2 uppercase">{m.color}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </section>

            {context.netWorth && (
              <section className="mb-10">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-700">Net worth</h2>
                <div className="grid grid-cols-3 gap-4">
                  <Tile label="Total net worth" value={formatCurrency(context.netWorth.totalNetWorth)} />
                  <Tile label="Personal holdings" value={formatCurrency(context.netWorth.personalNetWorth)} />
                  <Tile label="Attributed via entities" value={formatCurrency(context.netWorth.entityAttributedNetWorth)} />
                </div>
              </section>
            )}

            {context.suitableFunds && context.suitableFunds.matchingFunds.items.length > 0 && (
              <section className="mb-10">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-700">Suitability-matched fund shortlist</h2>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-ink-300 text-left text-xs uppercase tracking-wide text-ink-500">
                      <th className="py-2 pr-3">Fund</th><th className="py-2 pr-3">Sector</th><th className="py-2 pr-3">OCF</th><th className="py-2">Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {context.suitableFunds.matchingFunds.items.slice(0, 10).map((f) => (
                      <tr key={f.id} className="border-b border-ink-100">
                        <td className="py-2 pr-3">{f.name}</td>
                        <td className="py-2 pr-3">{f.sector}</td>
                        <td className="py-2 pr-3">{f.ocf !== null ? formatPct(Number(f.ocf) * 100, 2) : '—'}</td>
                        <td className="py-2">{f.riskRating ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            <section className="mb-10">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-700">Suitability assessment</h2>
              {narrative ? (
                <div className="space-y-3 text-sm leading-relaxed text-ink-700">
                  {narrative.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}
                </div>
              ) : (
                <p className="text-sm text-ink-500">AI narrative unavailable — {narrativeError ?? 'unknown error.'}</p>
              )}
            </section>
          </>
        )}

        <footer className="mt-12 border-t border-ink-100 pt-4 text-xs text-ink-500">
          WealthMatrix Enterprise — suitability report draft. Adviser review required before issue to client.
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
