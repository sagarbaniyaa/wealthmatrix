import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';
import { formatCurrency } from '@/lib/format';
import type { Income, Currency } from '@/lib/types';

function annualize(amount: number, frequency: string): number {
  switch (frequency) {
    case 'monthly': return amount * 12;
    case 'quarterly': return amount * 4;
    case 'one_off': return 0;
    default: return amount;
  }
}

export default async function ClientIncomePage() {
  const session = await getSession();
  if (!session?.personId) {
    return (
      <div>
        <PageHeader eyebrow="Income" title="Your income" />
        <p className="text-sm text-ink-300">No personal record is linked to your account yet — contact your adviser.</p>
      </div>
    );
  }

  const [income, currencies] = await Promise.all([
    serverApiGet<Income[]>(`income?personId=${session.personId}`),
    serverApiGet<Currency[]>('currencies'),
  ]);
  const currencyCode = (id: string) => currencies.find((c) => c.id === id)?.code ?? 'GBP';

  const today = new Date().toISOString().slice(0, 10);
  const annualTotal = income
    .filter((i) => !i.endDate || i.endDate >= today)
    .reduce((sum, i) => sum + annualize(Number(i.amount), i.frequency), 0);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Income" title="Your income" />

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-ink-300">Recorded income</p>
          <p className="figure text-sm text-ink-100">{formatCurrency(annualTotal)} / year (est.)</p>
        </div>
        <DataTable
          keyFn={(i) => i.id}
          rows={income}
          emptyLabel="No income on record yet. Your adviser can add this for you."
          columns={[
            { header: 'Type', render: (i) => i.incomeType.replace(/_/g, ' ') },
            { header: 'Description', render: (i) => i.description ?? '—' },
            { header: 'Amount', align: 'right', render: (i) => `${formatCurrency(Number(i.amount), currencyCode(i.currencyId))} / ${i.frequency.replace('_', ' ')}` },
          ]}
        />
      </Card>
    </div>
  );
}
