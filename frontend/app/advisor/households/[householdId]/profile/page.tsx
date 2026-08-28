import { serverApiGet } from '@/lib/server-api';
import { ClientProfile } from '@/components/profile/ClientProfile';
import type {
  Household, HouseholdMember, Person, Income, ClientNote, Account, Asset, Holding, Currency,
} from '@/lib/types';

// Client 360 profile — personal details, income, assets & liabilities, and
// adviser notes for the household's primary person. Scoped to one person
// (the 'head' household_member, or the first member) rather than every
// member, to keep the intake form and this page in step with each other —
// multi-member editing is a natural next step once this is in daily use.
export default async function ClientProfilePage({ params }: { params: { householdId: string } }) {
  const householdId = params.householdId;

  const [household, members, currencies, allAssets] = await Promise.all([
    serverApiGet<Household>(`households/${householdId}`),
    serverApiGet<HouseholdMember[]>(`household-members?householdId=${householdId}`),
    serverApiGet<Currency[]>('currencies'),
    serverApiGet<Asset[]>('assets'),
  ]);

  const primaryMember = members.find((m) => m.relationship === 'head') ?? members[0] ?? null;
  const person = primaryMember ? await serverApiGet<Person>(`people/${primaryMember.personId}`) : null;

  const [income, notes, accounts] = await Promise.all([
    person ? serverApiGet<Income[]>(`income?personId=${person.id}`) : Promise.resolve([] as Income[]),
    serverApiGet<ClientNote[]>(`client-notes?householdId=${householdId}`),
    person ? serverApiGet<Account[]>(`accounts?ownerPersonId=${person.id}`) : Promise.resolve([] as Account[]),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const holdingLists = await Promise.all(
    accounts.map((a) => serverApiGet<Holding[]>(`holdings/account/${a.id}/latest?asOfDate=${today}`)),
  );
  const holdingsByAccount: Record<string, Holding[]> = {};
  accounts.forEach((a, i) => { holdingsByAccount[a.id] = holdingLists[i]; });

  return (
    <ClientProfile
      household={household}
      person={person}
      income={income}
      notes={notes}
      accounts={accounts}
      holdingsByAccount={holdingsByAccount}
      assets={allAssets}
      currencies={currencies}
    />
  );
}
