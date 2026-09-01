import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import type { HouseholdJourney, JourneyStepStatus } from '@/lib/types';

const STATUS_STYLE: Record<JourneyStepStatus, { dot: string; text: string }> = {
  done: { dot: 'bg-verdigris-500', text: 'text-verdigris-400' },
  in_progress: { dot: 'bg-brass-500', text: 'text-brass-400' },
  not_started: { dot: 'bg-ink-700', text: 'text-ink-500' },
};

/**
 * A rollup of state that already lives across five separate modules
 * (fact find, risk profile, provider sends, report cases) — not a new
 * source of truth, just a "where is this client" view so an adviser
 * doesn't have to visit five pages to find out. See
 * HouseholdJourneyService for what "done" means per step, including the
 * one documented simplification (Suitability = "ready", not
 * "generated", since that report is computed on demand and never saved).
 */
export function JourneyTracker({ journey }: { journey: HouseholdJourney }) {
  return (
    <Card>
      <p className="mb-4 text-xs uppercase tracking-wide text-ink-300">Client journey</p>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {journey.steps.map((step, i) => {
          const style = STATUS_STYLE[step.status];
          return (
            <Link key={step.key} href={step.linkPath} className="group block">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`} />
                <span className="text-xs uppercase tracking-wide text-ink-300 group-hover:text-ink-100">{i + 1}. {step.label}</span>
              </div>
              <p className={`mt-1.5 text-xs ${style.text}`}>{step.detail}</p>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
