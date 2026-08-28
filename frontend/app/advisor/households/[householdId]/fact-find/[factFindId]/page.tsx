import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { FactFindForm } from '@/components/fact-find/FactFindForm';
import { serverApiGet } from '@/lib/server-api';
import type { Household, FactFind, RiskQuestion } from '@/lib/types';

export default async function FactFindEditPage({ params }: { params: { householdId: string; factFindId: string } }) {
  const isNew = params.factFindId === 'new';

  const [household, riskQuestions, factFind] = await Promise.all([
    serverApiGet<Household>(`households/${params.householdId}`),
    serverApiGet<RiskQuestion[]>('fact-find-risk-questionnaire'),
    isNew ? Promise.resolve(null) : serverApiGet<FactFind>(`households/${params.householdId}/fact-finds/${params.factFindId}`),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={household.name}
        title={isNew ? 'New Fact Find' : 'Fact Find'}
        action={
          <Link href={`/advisor/households/${household.id}/fact-find`} className="text-sm text-brass-400 hover:text-brass-300">
            ← All fact finds
          </Link>
        }
      />
      <FactFindForm householdId={household.id} factFind={factFind} riskQuestions={riskQuestions} />
    </div>
  );
}
