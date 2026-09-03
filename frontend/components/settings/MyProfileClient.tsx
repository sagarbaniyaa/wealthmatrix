'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import type { AppUser } from '@/lib/types';

export function MyProfileClient({ initialUser }: { initialUser: AppUser }) {
  const [phone, setPhone] = useState(initialUser.phone ?? '');
  const [displayName, setDisplayName] = useState(initialUser.displayName ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await api.patch('users/me', { phone: phone || undefined, displayName: displayName || undefined });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <p className="mb-3 text-xs uppercase tracking-wide text-ink-300">My details</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-wide text-ink-300">Display name</span>
          <input
            value={displayName} onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-sm border border-hairline bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none focus:border-brass-500"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-wide text-ink-300">Phone number</span>
          <input
            value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+44 7700 900000"
            className="w-full rounded-sm border border-hairline bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brass-500"
          />
        </label>
      </div>
      <p className="mt-2 text-xs text-ink-500">
        Your phone number is used by Telephony (&quot;Call Client&quot;) — the platform rings you here first, then
        bridges the client in. It&apos;s also used to fill in your details on generated LOA documents.
      </p>
      <Button onClick={save} disabled={saving} className="mt-3 px-4 py-2 text-xs">
        {saving ? 'Saving…' : 'Save'}
      </Button>
      {saved && <p className="mt-2 text-xs text-verdigris-400">Saved.</p>}
      {error && <p className="mt-2 text-xs text-rust-400">{error}</p>}
    </Card>
  );
}
