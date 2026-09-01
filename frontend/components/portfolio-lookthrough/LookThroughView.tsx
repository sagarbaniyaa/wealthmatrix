import { Card } from '@/components/ui/Card';
import { StatTile } from '@/components/ui/StatTile';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatPct } from '@/lib/format';
import type { PortfolioLookThroughResult } from '@/lib/types';

export function LookThroughView({ result }: { result: PortfolioLookThroughResult }) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
        <Card><StatTile label="Total portfolio value" value={formatCurrency(result.totalValue)} /></Card>
        <Card><StatTile label="Looked through" value={formatCurrency(result.lookedThroughValue)} /></Card>
        <Card><StatTile label="Look-through coverage" value={formatPct(result.lookedThroughPct)} /></Card>
      </div>

      {result.totalValue === 0 && (
        <Card><p className="text-sm text-ink-400">No holdings recorded yet.</p></Card>
      )}

      {result.lookedThroughPct < 100 && result.totalValue > 0 && (
        <Card>
          <p className="text-sm text-ink-400">
            {formatPct(100 - result.lookedThroughPct)} of this portfolio is held directly or in a fund not in our
            research universe — shown at face value below, not broken down further.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <Card>
          <p className="mb-4 text-xs uppercase tracking-wide text-ink-300">Top underlying exposures</p>
          {result.topExposures.length === 0 ? (
            <p className="text-sm text-ink-400">No exposures to show.</p>
          ) : (
            <div className="space-y-3">
              {result.topExposures.map((e) => <ExposureBar key={e.name} exposure={e} />)}
            </div>
          )}
        </Card>

        <Card>
          <p className="mb-4 text-xs uppercase tracking-wide text-ink-300">Asset class breakdown</p>
          {result.assetClassBreakdown.length === 0 ? (
            <p className="text-sm text-ink-400">No breakdown to show.</p>
          ) : (
            <div className="space-y-3">
              {result.assetClassBreakdown.map((e) => <ExposureBar key={e.name} exposure={e} label={e.name.replace(/_/g, ' ')} />)}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <p className="mb-4 text-xs uppercase tracking-wide text-ink-300">Holdings detail</p>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-xs uppercase tracking-wide text-ink-300">
              <th className="pb-3 font-medium">Holding</th>
              <th className="pb-3 text-right font-medium">Value</th>
              <th className="pb-3 font-medium">Look-through</th>
            </tr>
          </thead>
          <tbody>
            {result.holdings.map((h, i) => (
              <tr key={i} className="border-b border-hairline/50 last:border-0">
                <td className="py-3 text-ink-100">{h.assetName}</td>
                <td className="py-3 text-right figure">{formatCurrency(h.value)}</td>
                <td className="py-3">
                  {h.lookedThrough ? <Badge tone="positive">{h.matchedFundName}</Badge> : <Badge tone="draft">Not matched</Badge>}
                </td>
              </tr>
            ))}
            {result.holdings.length === 0 && (
              <tr><td colSpan={3} className="py-8 text-center text-ink-400">No holdings recorded.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function ExposureBar({ exposure, label }: { exposure: { name: string; value: number; pct: number }; label?: string }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="text-ink-100">{label ?? exposure.name}</span>
        <span className="figure text-ink-300">{formatCurrency(exposure.value)} · {formatPct(exposure.pct)}</span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-ink-800">
        <div className="h-2.5 rounded-full bg-brass-500" style={{ width: `${Math.min(exposure.pct, 100)}%` }} />
      </div>
    </div>
  );
}
