'use client';

// Hidden via @media print — browsers' own "Save as PDF" print target is
// the export mechanism here, so there's no new backend dependency for it.
export function PrintButton() {
  return (
    <div className="mb-6 flex justify-end print:hidden">
      <button
        onClick={() => window.print()}
        className="rounded-sm bg-ink-900 px-4 py-2 text-sm font-medium text-paper hover:bg-ink-700"
      >
        Print / Save as PDF
      </button>
    </div>
  );
}
