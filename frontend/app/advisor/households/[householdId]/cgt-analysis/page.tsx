import { PageHeader } from '@/components/ui/PageHeader';
import { CgtAnalysisClient } from '@/components/cgt-analysis/CgtAnalysisClient';
import { serverApiGet } from '@/lib/server-api';
import type { Household, HouseholdMember, Person, Account, CgtAnalysis } from '@/lib/types';

export default async function CgtAnalysisPage({ params }: { params: { householdId: string } }) {
  const [household, members, analyses] = await Promise.all([
    serverApiGet<Household>(`households/${params.householdId}`),
    serverApiGet<HouseholdMember[]>(`household-members?householdId=${params.householdId}`),
    serverApiGet<CgtAnalysis[]>(`households/${params.householdId}/cgt-analysis`),
  ]);

  const persons = await Promise.all(members.map((m) => serverApiGet<Person>(`people/${m.personId}`)));
  const accountsByPerson = await Promise.all(persons.map((p) => serverApiGet<Account[]>(`accounts?ownerPersonId=${p.id}`)));

  const investmentAccounts = persons.flatMap((p, i) =>
    accountsByPerson[i]
      .filter((a) => a.accountType === 'investment')
      .map((a) => ({ id: a.id, provider: a.provider, personName: `${p.firstName} ${p.lastName}`, taxWrapper: a.taxWrapper })));

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={household.name} title="CGT & Portfolio Intelligence" />
      <p className="text-sm text-ink-400">
        Analyses this household&apos;s personally-held GIA investment accounts for unrealised capital gains — tag
        each account&apos;s tax wrapper below (ISAs/SIPPs are excluded automatically), then run the analysis.
      </p>
      <CgtAnalysisClient householdId={household.id} investmentAccounts={investmentAccounts} initialAnalyses={analyses} />
    </div>
  );
}
