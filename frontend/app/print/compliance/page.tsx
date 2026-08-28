import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';
import { formatDate } from '@/lib/format';
import { PrintButton } from '@/components/print/PrintButton';
import type { ComplianceLogEntry, Household, Firm } from '@/lib/types';

// Standalone route (outside the dashboard route group, no sidebar/chrome)
// so it prints cleanly as a document — an FCA compliance review pack.
// Light "paper" surface deliberately, not the app's dark ledger theme —
// this is a document meant to be printed/saved as PDF.
export default async function ComplianceExportPage() {
  const session = await getSession();
  if (!session) redirect('/login/advisor');
  if (session.role === 'client') redirect('/client');

  const [entries, households, firms] = await Promise.all([
    serverApiGet<ComplianceLogEntry[]>('compliance-log'),
    serverApiGet<Household[]>('households'),
    serverApiGet<Firm[]>('firms/me'),
  ]);

  const firm = firms[0];
  const householdName = (id: string | null) => households.find((h) => h.id === id)?.name ?? 'Firm-wide';
  const unresolved = entries.filter((e) => !e.resolvedAt);
  const bySeverity = (sev: string) => unresolved.filter((e) => e.severity === sev).length;
  const generatedAt = new Date().toISOString();

  return (
    <div className="min-h-screen bg-paper py-12 print:py-0">
    <div className="mx-auto max-w-3xl px-10 font-sans text-ink-900 print:px-0">
      <PrintButton />

      <header className="mb-10 border-b-2 border-ink-900 pb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-ink-500">Compliance Review Pack</p>
        <h1 className="mt-1 text-2xl font-semibold">{firm?.name ?? 'WealthMatrix'}</h1>
        {firm?.fcaReference && <p className="mt-1 text-sm text-ink-500">FCA reference: {firm.fcaReference}</p>}
        <p className="mt-1 text-xs text-ink-500">Generated {formatDate(generatedAt)}</p>
      </header>

      <section className="mb-10 grid grid-cols-4 gap-4">
        <SummaryTile label="Open findings" value={unresolved.length} />
        <SummaryTile label="Breach" value={bySeverity('breach')} />
        <SummaryTile label="Warning" value={bySeverity('warning')} />
        <SummaryTile label="Info" value={bySeverity('info')} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-700">All findings ({entries.length})</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-ink-300 text-left text-xs uppercase tracking-wide text-ink-500">
              <th className="py-2 pr-3">Household</th>
              <th className="py-2 pr-3">Severity</th>
              <th className="py-2 pr-3">Rule</th>
              <th className="py-2 pr-3">Finding</th>
              <th className="py-2 pr-3">Detected</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-ink-100 align-top">
                <td className="py-2 pr-3">{householdName(e.householdId)}</td>
                <td className="py-2 pr-3 uppercase">{e.severity}</td>
                <td className="py-2 pr-3 font-mono text-xs">{e.ruleCode}</td>
                <td className="py-2 pr-3">{e.message}</td>
                <td className="py-2 pr-3">{formatDate(e.detectedAt)}</td>
                <td className="py-2">{e.resolvedAt ? `Resolved ${formatDate(e.resolvedAt)}` : 'Open'}</td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr><td colSpan={6} className="py-6 text-center text-ink-500">No compliance findings on record.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <footer className="mt-12 border-t border-ink-100 pt-4 text-xs text-ink-500">
        Prepared for internal FCA review purposes. WealthMatrix Enterprise — {firm?.name}.
      </footer>
    </div>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-ink-100 p-3">
      <p className="text-xs uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
