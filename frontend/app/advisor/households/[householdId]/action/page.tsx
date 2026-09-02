import { PageHeader } from '@/components/ui/PageHeader';
import { ClientActionClient } from '@/components/client-action/ClientActionClient';
import { serverApiGet } from '@/lib/server-api';
import type { Household, ActionOption, HouseholdAction, ActionChecklist } from '@/lib/types';

export default async function ClientActionPage({ params }: { params: { householdId: string } }) {
  const [household, options, current, history] = await Promise.all([
    serverApiGet<Household>(`households/${params.householdId}`),
    serverApiGet<ActionOption[]>(`households/${params.householdId}/action/options`),
    serverApiGet<HouseholdAction | null>(`households/${params.householdId}/action`),
    serverApiGet<HouseholdAction[]>(`households/${params.householdId}/action/history`),
  ]);
  const checklist = current
    ? await serverApiGet<ActionChecklist | null>(`households/${params.householdId}/action/checklist`)
    : null;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={household.name} title="Client Action" />
      <p className="text-sm text-ink-400">
        Pick what you&apos;re doing for this client and the platform pulls together exactly what it needs — required
        documents, compliance checks, the right suitability template, provider send status, and (where relevant) a
        DFM/fund category recommendation — checked live against what&apos;s actually on file.
      </p>
      <ClientActionClient
        householdId={household.id}
        options={options}
        initialCurrent={current}
        initialChecklist={checklist}
        initialHistory={history}
      />
    </div>
  );
}
