import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';
import { formatDate } from '@/lib/format';
import type { Person } from '@/lib/types';

const KYC_TONE: Record<string, string> = { verified: 'positive', pending: 'warning', expired: 'breach' };

// Read-only for the client — editing is an adviser action (see the
// adviser-side client profile page). This is the client's own record,
// resolved from their JWT's personId, never another household's.
export default async function ClientProfilePage() {
  const session = await getSession();
  if (!session?.personId) {
    return (
      <div>
        <PageHeader eyebrow="Profile" title="Your details" />
        <p className="text-sm text-ink-300">No personal record is linked to your account yet — contact your adviser.</p>
      </div>
    );
  }

  const person = await serverApiGet<Person>(`people/${session.personId}`).catch(() => null);
  if (!person) redirect('/client');

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Profile" title={`${person.firstName} ${person.lastName}`} />

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-ink-300">Personal details</p>
          <Badge tone={KYC_TONE[person.kycStatus] ?? 'info'}>KYC: {person.kycStatus}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <Field label="First name" value={person.firstName} />
          <Field label="Last name" value={person.lastName} />
          <Field label="Date of birth" value={person.dateOfBirth ? formatDate(person.dateOfBirth) : '—'} />
          <Field label="Tax residency" value={person.taxResidency ?? '—'} />
          <Field label="Domicile" value={person.domicile ?? '—'} />
          <Field label="Phone" value={person.phone ?? '—'} />
          <Field label="Email" value={person.email ?? '—'} />
          <Field label="Address" value={[person.addressLine1, person.addressLine2, person.city, person.postalCode, person.country].filter(Boolean).join(', ') || '—'} />
        </div>
      </Card>

      <Card>
        <p className="mb-4 text-xs uppercase tracking-wide text-ink-300">Risk &amp; compliance</p>
        <div className="grid grid-cols-2 gap-6">
          <Field label="Risk tolerance" value={person.riskTolerance ?? 'Not set'} />
          <Field label="KYC verified" value={person.kycVerifiedAt ? formatDate(person.kycVerifiedAt) : 'Not yet verified'} />
          <Field label="Source of wealth" value={person.sourceOfWealth ?? '—'} />
        </div>
      </Card>

      <p className="text-xs text-ink-500">
        Need to update any of this? Get in touch with your adviser — they keep your record up to date.
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-ink-300">{label}</p>
      <p className="mt-1 text-sm text-ink-100">{value}</p>
    </div>
  );
}
