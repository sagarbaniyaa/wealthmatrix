import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { NetWorthComparisonChart } from './NetWorthComparisonChart';
import { ScenarioAiSummary } from './ScenarioAiSummary';
import type { Scenario } from '@/lib/types';

export function ScenarioResultCard({ scenario }: { scenario: Scenario }) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-300">{scenario.eventType.replace(/_/g, ' ')}</p>
          <h2 className="font-display text-xl text-ink-100">{scenario.name}</h2>
        </div>
        <Badge tone={scenario.status}>{scenario.status}</Badge>
      </div>

      {scenario.result ? (
        <div className="space-y-6">
          <NetWorthComparisonChart baseline={scenario.result.baselineNetWorth} projected={scenario.result.projectedNetWorth} />
          <p className="border-t border-hairline pt-4 text-sm leading-relaxed text-ink-300">
            {scenario.result.narrative}
          </p>
          <ScenarioAiSummary scenarioId={scenario.id} />
        </div>
      ) : (
        <p className="text-sm text-ink-300">
          {scenario.status === 'running' ? 'Projection running…' : 'Not yet run.'}
        </p>
      )}
    </Card>
  );
}
