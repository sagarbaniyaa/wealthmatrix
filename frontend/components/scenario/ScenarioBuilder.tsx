'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import type { ScenarioEventType } from '@/lib/types';

const EVENT_TYPES: { value: ScenarioEventType; label: string }[] = [
  { value: 'business_sale', label: 'Business sale' },
  { value: 'inheritance', label: 'Inheritance' },
  { value: 'relocation', label: 'Relocation' },
  { value: 'divorce', label: 'Divorce' },
  { value: 'tax_residency_change', label: 'Tax residency change' },
  { value: 'property_sale', label: 'Property sale' },
  { value: 'liquidity_event', label: 'Liquidity event' },
  { value: 'pe_exit', label: 'Private equity exit' },
  { value: 'dividend_recap', label: 'Dividend recapitalisation' },
  { value: 'leverage_change', label: 'Leverage change' },
  { value: 'custom', label: 'Custom' },
];

// Parameter fields shown depend on event type — mirrors what
// ScenarioEngineService's handlers actually read from `parameters`.
export function ScenarioBuilder({ householdId }: { householdId: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [eventType, setEventType] = useState<ScenarioEventType>('business_sale');
  const [eventDate, setEventDate] = useState('');
  const [amount, setAmount] = useState('');
  const [taxRatePct, setTaxRatePct] = useState('');
  const [entityId, setEntityId] = useState('');
  const [sellerOwnershipPct, setSellerOwnershipPct] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isBusinessSale = eventType === 'business_sale';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const parameters = isBusinessSale
        ? {
            salePrice: Number(amount),
            capitalGainsTaxRatePct: taxRatePct ? Number(taxRatePct) : undefined,
            entityId: entityId || undefined,
            sellerOwnershipPct: sellerOwnershipPct ? Number(sellerOwnershipPct) : undefined,
          }
        : { amount: Number(amount), taxRatePct: taxRatePct ? Number(taxRatePct) : undefined };

      const scenario = await api.post<{ id: string }>('scenarios', {
        householdId, name, eventType, eventDate, parameters,
      });
      await api.post(`scenarios/${scenario.id}/run`);
      router.push(`/advisor/households/${householdId}/scenarios/${scenario.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <TextField label="Scenario name" value={name} onChange={setName} placeholder="Sale of TechCo Holdings" />
        <SelectField label="Event type" value={eventType} onChange={(v) => setEventType(v as ScenarioEventType)} options={EVENT_TYPES} />
        <TextField label="Event date" value={eventDate} onChange={setEventDate} type="date" />
        {isBusinessSale && <TextField label="Entity being sold (ID)" value={entityId} onChange={setEntityId} placeholder="entity UUID" />}
        <TextField label={isBusinessSale ? 'Sale price' : 'Amount'} value={amount} onChange={setAmount} type="number" placeholder="3000000" />
        {isBusinessSale && <TextField label="Seller ownership %" value={sellerOwnershipPct} onChange={setSellerOwnershipPct} type="number" placeholder="100" />}
        <TextField label={isBusinessSale ? 'Capital gains tax %' : 'Tax rate %'} value={taxRatePct} onChange={setTaxRatePct} type="number" placeholder="20" />
      </div>
      <Button type="submit" disabled={submitting}>{submitting ? 'Running…' : 'Run scenario'}</Button>
    </form>
  );
}

function TextField({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wide text-ink-300">{label}</span>
      <input
        type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-sm border border-hairline bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none focus:border-brass-500"
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wide text-ink-300">{label}</span>
      <select
        value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-sm border border-hairline bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none focus:border-brass-500"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
