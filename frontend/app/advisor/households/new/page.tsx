'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';

// Adviser-facing intake form. Three backend calls chained into one action:
// create the household, create the primary person, then link them via
// household_member — mirrors what the seed script does by hand in SQL.
export default function NewClientPage() {
  const router = useRouter();
  const [householdName, setHouseholdName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [taxResidency, setTaxResidency] = useState('');
  const [domicile, setDomicile] = useState('');
  const [relationship, setRelationship] = useState('head');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const household = await api.post<{ id: string }>('households', { name: householdName });
      const person = await api.post<{ id: string }>('people', {
        firstName,
        lastName,
        taxResidency: taxResidency || undefined,
        domicile: domicile || undefined,
      });
      await api.post('household-members', {
        householdId: household.id,
        personId: person.id,
        relationship: relationship || undefined,
      });
      router.push(`/advisor/households/${household.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create client.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl">
      <PageHeader eyebrow="Client roster" title="New client" />
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Household name" value={householdName} onChange={setHouseholdName} placeholder="e.g. Sterling Family" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="First name" value={firstName} onChange={setFirstName} />
            <Field label="Last name" value={lastName} onChange={setLastName} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tax residency" value={taxResidency} onChange={setTaxResidency} placeholder="GB" optional />
            <Field label="Domicile" value={domicile} onChange={setDomicile} placeholder="GB" optional />
          </div>
          <Field label="Relationship to household" value={relationship} onChange={setRelationship} placeholder="head" optional />

          {error && <p className="text-sm text-rust-400">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={loading}>{loading ? 'Creating…' : 'Create client'}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, optional = false,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; optional?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wide text-ink-300">
        {label}
        {optional && <span className="text-ink-500 normal-case"> (optional)</span>}
      </span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        required={!optional}
        className="w-full rounded-sm border border-hairline bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brass-500"
      />
    </label>
  );
}
