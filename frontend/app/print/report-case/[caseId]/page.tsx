import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';
import { formatDate } from '@/lib/format';
import { PrintButton } from '@/components/print/PrintButton';
import type { Firm, Household, ReportCase } from '@/lib/types';

// The caseId alone doesn't tell us the household — report cases are
// listed under /households/:householdId/report-cases/:id, but we don't
// have the householdId in this route's params. Resolve it by walking the
// household's own case list isn't available here either, so instead this
// page takes the householdId via a query param set by the link that
// brought the adviser here (see ReportBuilderClient).
export default async function ReportCasePrintPage({ params, searchParams }: { params: { caseId: string }; searchParams: { householdId?: string } }) {
  const session = await getSession();
  if (!session) redirect('/login/advisor');
  if (session.role === 'client') redirect('/client');
  if (!searchParams.householdId) redirect('/advisor/households');

  const [firms, household, reportCase] = await Promise.all([
    serverApiGet<Firm[]>('firms/me'),
    serverApiGet<Household>(`households/${searchParams.householdId}`),
    serverApiGet<ReportCase>(`households/${searchParams.householdId}/report-cases/${params.caseId}`),
  ]);
  const firm = firms[0];

  return (
    <div className="min-h-screen bg-paper py-12 print:py-0">
      <div className="mx-auto max-w-3xl px-10 font-sans text-ink-900 print:px-0">
        <PrintButton />

        <header className="mb-10 border-b-2 border-ink-900 pb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-ink-500">{reportCase.reportType.replace(/_/g, ' ')} — {reportCase.status === 'final' ? 'Final' : 'Draft'}</p>
          <h1 className="mt-1 text-2xl font-semibold">{household.name}</h1>
          <p className="mt-1 text-xs text-ink-500">{firm?.name} · Generated {formatDate(reportCase.createdAt)}</p>
          {reportCase.status !== 'final' && (
            <p className="mt-3 text-xs italic text-ink-500">
              This report is still a draft — an AI-assisted working document for the adviser to review and edit.
              It is not independent financial advice and must not be issued to a client before adviser review and
              being marked final.
            </p>
          )}
        </header>

        {!reportCase.content ? (
          <section className="rounded-sm border border-ink-200 bg-ink-50 p-6">
            <p className="text-sm text-ink-700">
              {reportCase.generationError ?? 'This report has no content yet.'}
            </p>
          </section>
        ) : (
          <RenderedReport content={reportCase.content} />
        )}

        <footer className="mt-12 border-t border-ink-100 pt-4 text-xs text-ink-500">
          WealthMatrix Enterprise — {reportCase.reportType.replace(/_/g, ' ')} report.
        </footer>
      </div>
    </div>
  );
}

// Minimal markdown-ish rendering: a "## Heading" LINE becomes a section
// header; everything else accumulates into paragraphs, split wherever a
// blank line appears. Deliberately line-by-line rather than block-by-block
// (splitting the whole content on blank lines first) — a heading is very
// often immediately followed by body text with no blank line between them
// in the AI's output, and block-level splitting would swallow that body
// text into the same all-caps heading element.
function RenderedReport({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let paragraphLines: string[] = [];

  function flushParagraph(key: string) {
    const text = paragraphLines.join(' ').trim();
    if (text) elements.push(<p key={key}>{text}</p>);
    paragraphLines = [];
  }

  lines.forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (line.startsWith('## ')) {
      flushParagraph(`p${i}`);
      elements.push(<h2 key={`h${i}`} className="mt-6 text-sm font-semibold uppercase tracking-wide text-ink-800 first:mt-0">{line.slice(3)}</h2>);
    } else if (line === '') {
      flushParagraph(`p${i}`);
    } else {
      paragraphLines.push(line);
    }
  });
  flushParagraph('p-last');

  return <div className="space-y-3 text-sm leading-relaxed text-ink-700">{elements}</div>;
}
