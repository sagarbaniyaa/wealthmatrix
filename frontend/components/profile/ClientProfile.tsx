'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Household, Person, Income, ClientNote, Account, Asset, Holding, Currency } from '@/lib/types';

const RISK_TOLERANCES = ['conservative', 'moderate', 'aggressive'];
const KYC_STATUSES = ['pending', 'verified', 'expired'];
const INCOME_TYPES = ['employment', 'self_employment', 'rental', 'dividend', 'pension', 'other'];
const FREQUENCIES = ['annual', 'monthly', 'quarterly', 'one_off'];
const ACCOUNT_TYPES = ['bank', 'investment', 'pension', 'loan', 'custody', 'other'];
const ASSET_CLASSES = ['cash', 'equity_public', 'equity_private', 'fixed_income', 'property', 'pension', 'private_equity_fund', 'debt_instrument', 'other'];
const SOURCE_OF_FUNDS = ['platform_investment', 'inheritance', 'employment_income', 'business_sale', 'other'];

const KYC_TONE: Record<string, string> = { verified: 'positive', pending: 'warning', expired: 'breach' };

export function ClientProfile({
  household, person, income, notes, accounts, holdingsByAccount, assets, currencies,
}: {
  household: Household;
  person: Person | null;
  income: Income[];
  notes: ClientNote[];
  accounts: Account[];
  holdingsByAccount: Record<string, Holding[]>;
  assets: Asset[];
  currencies: Currency[];
}) {
  const router = useRouter();
  // GBP first (this firm's base currency) rather than alphabetical, so it's
  // the default selection in every currency dropdown below.
  const sortedCurrencies = [...currencies].sort((a, b) => (a.code === 'GBP' ? -1 : b.code === 'GBP' ? 1 : 0));
  const currencyOptions = sortedCurrencies.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }));
  const assetById = (id: string) => assets.find((a) => a.id === id);
  const currencyCode = (id: string) => currencies.find((c) => c.id === id)?.code ?? 'GBP';

  return (
    <div className="max-w-4xl space-y-8">
      <PageHeader
        eyebrow={household.name}
        title={person ? `${person.firstName} ${person.lastName}` : 'Client profile'}
      />

      {!person ? (
        <Card><p className="text-sm text-ink-300">No primary contact is linked to this household yet.</p></Card>
      ) : (
        <>
          <PersonalDetailsSection person={person} onSaved={() => router.refresh()} />
          <DataPrivacySection personId={person.id} personName={`${person.firstName} ${person.lastName}`} onErased={() => router.refresh()} />
          <IncomeSection personId={person.id} income={income} currencyOptions={currencyOptions} currencyCode={currencyCode} onChanged={() => router.refresh()} />
          <AssetsSection
            personId={person.id}
            accounts={accounts}
            holdingsByAccount={holdingsByAccount}
            assetById={assetById}
            currencyOptions={currencyOptions}
            currencyCode={currencyCode}
            onChanged={() => router.refresh()}
          />
        </>
      )}

      <NotesSection householdId={household.id} notes={notes} onChanged={() => router.refresh()} />
    </div>
  );
}

// ---------------------------------------------------------------- Personal details

function PersonalDetailsSection({ person, onSaved }: { person: Person; onSaved: () => void }) {
  const [form, setForm] = useState({
    firstName: person.firstName, lastName: person.lastName,
    dateOfBirth: person.dateOfBirth ?? '', taxResidency: person.taxResidency ?? '', domicile: person.domicile ?? '',
    phone: person.phone ?? '', email: person.email ?? '',
    addressLine1: person.addressLine1 ?? '', addressLine2: person.addressLine2 ?? '',
    city: person.city ?? '', postalCode: person.postalCode ?? '', country: person.country ?? '',
    riskTolerance: person.riskTolerance ?? '', kycStatus: person.kycStatus, kycVerifiedAt: person.kycVerifiedAt ?? '',
    sourceOfWealth: person.sourceOfWealth ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, v === '' ? null : v]),
      );
      payload.kycStatus = form.kycStatus || 'pending'; // required field, never null
      await api.patch(`people/${person.id}`, payload);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-ink-300">Personal details</p>
        <Badge tone={KYC_TONE[form.kycStatus] ?? 'info'}>KYC: {form.kycStatus}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <TextField label="First name" value={form.firstName} onChange={set('firstName')} />
        <TextField label="Last name" value={form.lastName} onChange={set('lastName')} />
        <TextField label="Date of birth" type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} />
        <TextField label="Tax residency" value={form.taxResidency} onChange={set('taxResidency')} placeholder="GB" />
        <TextField label="Domicile" value={form.domicile} onChange={set('domicile')} placeholder="GB" />
        <TextField label="Phone" value={form.phone} onChange={set('phone')} />
        <TextField label="Email" type="email" value={form.email} onChange={set('email')} />
        <TextField label="Address line 1" value={form.addressLine1} onChange={set('addressLine1')} />
        <TextField label="Address line 2" value={form.addressLine2} onChange={set('addressLine2')} />
        <TextField label="City" value={form.city} onChange={set('city')} />
        <TextField label="Postal code" value={form.postalCode} onChange={set('postalCode')} />
        <TextField label="Country" value={form.country} onChange={set('country')} placeholder="GB" />
        <SelectField label="Risk tolerance" value={form.riskTolerance} onChange={set('riskTolerance')} options={optionize(RISK_TOLERANCES, true)} />
        <SelectField label="KYC status" value={form.kycStatus} onChange={set('kycStatus')} options={optionize(KYC_STATUSES)} />
        <TextField label="KYC verified date" type="date" value={form.kycVerifiedAt} onChange={set('kycVerifiedAt')} />
        <TextField label="Source of wealth" value={form.sourceOfWealth} onChange={set('sourceOfWealth')} placeholder="e.g. business sale, inheritance" />
      </div>
      {error && <p className="mt-3 text-sm text-rust-400">{error}</p>}
      <div className="mt-4">
        <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save details'}</Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- Data & privacy (GDPR)

function DataPrivacySection({ personId, personName, onErased }: { personId: string; personName: string; onErased: () => void }) {
  const [exporting, setExporting] = useState(false);
  const [erasing, setErasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [erased, setErased] = useState(false);

  async function runExport() {
    setExporting(true);
    setError(null);
    try {
      const blob = await api.getBlob(`people/${personId}/gdpr-export`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${personName.replace(/\s+/g, '_')}_data_export.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not export this person\'s data.');
    } finally {
      setExporting(false);
    }
  }

  async function runErase() {
    if (!window.confirm(
      `Erase ${personName}'s personal data? Name, date of birth, contact details, address and NI ` +
        'number will be permanently removed. Financial records (accounts, holdings, transactions, ' +
        'income) are retained under statutory record-keeping obligations. This cannot be undone.',
    )) {
      return;
    }
    setErasing(true);
    setError(null);
    try {
      await api.post(`people/${personId}/gdpr-erase`);
      setErased(true);
      onErased();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not erase this person\'s data.');
    } finally {
      setErasing(false);
    }
  }

  return (
    <Card>
      <p className="mb-1 text-xs uppercase tracking-wide text-ink-300">Data & privacy</p>
      <p className="mb-4 text-xs text-ink-500">
        Handles a GDPR subject access request (export everything held) or right-to-erasure request
        for this person.
      </p>
      {erased ? (
        <p className="text-sm text-ink-300">This person&apos;s personal data has been erased.</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          <Button onClick={runExport} disabled={exporting}>{exporting ? 'Exporting…' : 'Export data (JSON)'}</Button>
          <Button onClick={runErase} disabled={erasing} variant="danger">{erasing ? 'Erasing…' : 'Erase personal data'}</Button>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-rust-400">{error}</p>}
    </Card>
  );
}

// ---------------------------------------------------------------- Income

function IncomeSection({ personId, income, currencyOptions, currencyCode, onChanged }: {
  personId: string; income: Income[]; currencyOptions: { value: string; label: string }[];
  currencyCode: (id: string) => string; onChanged: () => void;
}) {
  const [incomeType, setIncomeType] = useState(INCOME_TYPES[0]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currencyId, setCurrencyId] = useState(currencyOptions[0]?.value ?? '');
  const [frequency, setFrequency] = useState(FREQUENCIES[0]);
  const [startDate, setStartDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post('income', {
        personId, incomeType, description: description || undefined,
        amount: Number(amount), currencyId, frequency,
        startDate: startDate || undefined,
      });
      setDescription(''); setAmount(''); setStartDate('');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add income.');
    } finally {
      setSubmitting(false);
    }
  }

  const annualTotal = income
    .filter((i) => !i.endDate || i.endDate >= new Date().toISOString().slice(0, 10))
    .reduce((sum, i) => sum + annualize(Number(i.amount), i.frequency), 0);

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-ink-300">Income</p>
        <p className="figure text-sm text-ink-100">{formatCurrency(annualTotal)} / year (est.)</p>
      </div>

      <DataTable
        keyFn={(i) => i.id}
        rows={income}
        emptyLabel="No income recorded yet."
        columns={[
          { header: 'Type', render: (i) => i.incomeType.replace(/_/g, ' ') },
          { header: 'Description', render: (i) => i.description ?? '—' },
          { header: 'Amount', align: 'right', render: (i) => `${formatCurrency(Number(i.amount), currencyCode(i.currencyId))} / ${i.frequency.replace('_', ' ')}` },
        ]}
      />

      <form onSubmit={add} className="mt-6 grid grid-cols-2 gap-4 border-t border-hairline pt-6">
        <SelectField label="Type" value={incomeType} onChange={setIncomeType} options={optionize(INCOME_TYPES)} />
        <TextField label="Description" value={description} onChange={setDescription} placeholder="e.g. Base salary" />
        <TextField label="Amount" type="number" value={amount} onChange={setAmount} placeholder="120000" />
        <SelectField label="Currency" value={currencyId} onChange={setCurrencyId} options={currencyOptions} />
        <SelectField label="Frequency" value={frequency} onChange={setFrequency} options={optionize(FREQUENCIES)} />
        <TextField label="Start date" type="date" value={startDate} onChange={setStartDate} />
        {error && <p className="col-span-2 text-sm text-rust-400">{error}</p>}
        <div className="col-span-2">
          <Button type="submit" disabled={submitting}>{submitting ? 'Adding…' : '+ Add income'}</Button>
        </div>
      </form>
    </Card>
  );
}

function annualize(amount: number, frequency: string): number {
  switch (frequency) {
    case 'monthly': return amount * 12;
    case 'quarterly': return amount * 4;
    case 'one_off': return 0;
    default: return amount;
  }
}

// ---------------------------------------------------------------- Assets & liabilities

function AssetsSection({ personId, accounts, holdingsByAccount, assetById, currencyOptions, currencyCode, onChanged }: {
  personId: string;
  accounts: Account[];
  holdingsByAccount: Record<string, Holding[]>;
  assetById: (id: string) => Asset | undefined;
  currencyOptions: { value: string; label: string }[];
  currencyCode: (id: string) => string;
  onChanged: () => void;
}) {
  const [accountType, setAccountType] = useState(ACCOUNT_TYPES[0]);
  const [provider, setProvider] = useState('');
  const [accountCurrencyId, setAccountCurrencyId] = useState(currencyOptions[0]?.value ?? '');
  const [addingAccount, setAddingAccount] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  const [assetName, setAssetName] = useState('');
  const [assetClass, setAssetClass] = useState(ASSET_CLASSES[0]);
  const [isLiability, setIsLiability] = useState(false);
  const [sourceOfFunds, setSourceOfFunds] = useState(SOURCE_OF_FUNDS[0]);
  const [holdingAccountId, setHoldingAccountId] = useState(accounts[0]?.id ?? '');
  const [marketValue, setMarketValue] = useState('');
  const [assetCurrencyId, setAssetCurrencyId] = useState(currencyOptions[0]?.value ?? '');
  const [addingAsset, setAddingAsset] = useState(false);
  const [assetError, setAssetError] = useState<string | null>(null);

  async function addAccount(e: React.FormEvent) {
    e.preventDefault();
    setAddingAccount(true);
    setAccountError(null);
    try {
      await api.post('accounts', { ownerPersonId: personId, accountType, provider: provider || undefined, currencyId: accountCurrencyId });
      setProvider('');
      onChanged();
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Could not add account.');
    } finally {
      setAddingAccount(false);
    }
  }

  async function addAsset(e: React.FormEvent) {
    e.preventDefault();
    if (!holdingAccountId) { setAssetError('Add an account first.'); return; }
    setAddingAsset(true);
    setAssetError(null);
    try {
      const asset = await api.post<{ id: string }>('assets', {
        name: assetName, assetClass, isLiability, sourceOfFunds, currencyId: assetCurrencyId,
      });
      await api.post('holdings', {
        accountId: holdingAccountId, assetId: asset.id,
        asOfDate: new Date().toISOString().slice(0, 10),
        marketValue: Number(marketValue), currencyId: assetCurrencyId, source: 'manual',
      });
      setAssetName(''); setMarketValue('');
      onChanged();
    } catch (err) {
      setAssetError(err instanceof Error ? err.message : 'Could not add asset.');
    } finally {
      setAddingAsset(false);
    }
  }

  return (
    <Card>
      <p className="mb-4 text-xs uppercase tracking-wide text-ink-300">Assets &amp; liabilities</p>

      {accounts.length === 0 ? (
        <p className="text-sm text-ink-300">No accounts yet — add one below before recording assets.</p>
      ) : (
        <div className="space-y-6">
          {accounts.map((acc) => (
            <div key={acc.id}>
              <p className="mb-2 text-sm text-ink-100">
                {acc.provider ?? 'Account'} <span className="text-ink-500">— {acc.accountType.replace(/_/g, ' ')}</span>
              </p>
              <DataTable
                keyFn={(h) => h.id}
                rows={holdingsByAccount[acc.id] ?? []}
                emptyLabel="No holdings on this account yet."
                columns={[
                  { header: 'Asset', render: (h) => assetById(h.assetId)?.name ?? h.assetId },
                  { header: 'Class', render: (h) => assetById(h.assetId)?.assetClass.replace(/_/g, ' ') ?? '—' },
                  {
                    header: 'Source', render: (h) => {
                      const sof = assetById(h.assetId)?.sourceOfFunds;
                      return sof ? <Badge tone="info">{sof.replace(/_/g, ' ')}</Badge> : '—';
                    },
                  },
                  {
                    header: 'Value', align: 'right', render: (h) => (
                      <span className={assetById(h.assetId)?.isLiability ? 'text-rust-400' : ''}>
                        {assetById(h.assetId)?.isLiability ? '−' : ''}{formatCurrency(Number(h.marketValue), currencyCode(h.currencyId))}
                      </span>
                    ),
                  },
                ]}
              />
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-6 border-t border-hairline pt-6">
        <form onSubmit={addAccount} className="space-y-4">
          <p className="text-xs uppercase tracking-wide text-ink-300">Add account</p>
          <SelectField label="Account type" value={accountType} onChange={setAccountType} options={optionize(ACCOUNT_TYPES)} />
          <TextField label="Provider" value={provider} onChange={setProvider} placeholder="e.g. Coutts" />
          <SelectField label="Currency" value={accountCurrencyId} onChange={setAccountCurrencyId} options={currencyOptions} />
          {accountError && <p className="text-sm text-rust-400">{accountError}</p>}
          <Button type="submit" variant="ghost" disabled={addingAccount}>{addingAccount ? 'Adding…' : '+ Add account'}</Button>
        </form>

        <form onSubmit={addAsset} className="space-y-4">
          <p className="text-xs uppercase tracking-wide text-ink-300">Add asset / liability</p>
          <TextField label="Name" value={assetName} onChange={setAssetName} placeholder="e.g. Global Equity Portfolio" />
          <SelectField label="Class" value={assetClass} onChange={setAssetClass} options={optionize(ASSET_CLASSES)} />
          <label className="flex items-center gap-2 text-sm text-ink-100">
            <input type="checkbox" checked={isLiability} onChange={(e) => setIsLiability(e.target.checked)} />
            This is a liability (debt)
          </label>
          <SelectField label="Source of funds" value={sourceOfFunds} onChange={setSourceOfFunds} options={optionize(SOURCE_OF_FUNDS)} />
          <SelectField label="Account" value={holdingAccountId} onChange={setHoldingAccountId} options={accounts.map((a) => ({ value: a.id, label: `${a.provider ?? a.accountType}` }))} />
          <TextField label="Market value" type="number" value={marketValue} onChange={setMarketValue} placeholder="500000" />
          <SelectField label="Currency" value={assetCurrencyId} onChange={setAssetCurrencyId} options={currencyOptions} />
          {assetError && <p className="text-sm text-rust-400">{assetError}</p>}
          <Button type="submit" variant="ghost" disabled={addingAsset}>{addingAsset ? 'Adding…' : '+ Add asset'}</Button>
        </form>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- Notes

function NotesSection({ householdId, notes, onChanged }: { householdId: string; notes: ClientNote[]; onChanged: () => void }) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setSubmitting(true);
    try {
      await api.post('client-notes', { householdId, note });
      setNote('');
      onChanged();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <p className="mb-4 text-xs uppercase tracking-wide text-ink-300">Notes &amp; activity</p>
      <div className="space-y-3">
        {notes.length === 0 && <p className="text-sm text-ink-300">No notes yet.</p>}
        {notes.map((n) => (
          <div key={n.id} className="border-b border-hairline/50 pb-3 last:border-0">
            <p className="text-sm text-ink-100">{n.note}</p>
            <p className="mt-1 text-xs text-ink-500">{formatDate(n.createdAt)}</p>
          </div>
        ))}
      </div>
      <form onSubmit={add} className="mt-4 flex gap-3 border-t border-hairline pt-4">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Log a call, meeting, or update…"
          rows={2}
          className="flex-1 rounded-sm border border-hairline bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brass-500"
        />
        <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Add note'}</Button>
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------- Shared field helpers

function optionize(values: string[], includeBlank = false): { value: string; label: string }[] {
  const opts = values.map((v) => ({ value: v, label: v.replace(/_/g, ' ') }));
  return includeBlank ? [{ value: '', label: '—' }, ...opts] : opts;
}

function TextField({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wide text-ink-300">{label}</span>
      <input
        type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-sm border border-hairline bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brass-500"
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
