import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { MyProfileClient } from '@/components/settings/MyProfileClient';
import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';
import type { AppUser } from '@/lib/types';
import { redirect } from 'next/navigation';

export default async function MyProfilePage() {
  const session = await getSession();
  if (!session) redirect('/login/advisor');
  const user = await serverApiGet<AppUser>(`users/${session.userId}`);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Settings" title="My Profile" />
      <MyProfileClient initialUser={user} />
      <Card>
        <p className="mb-1 text-xs uppercase tracking-wide text-ink-300">Firm reference</p>
        <p className="mb-3 text-xs text-ink-500">
          Share this with a colleague signing in to the same firm from a browser that hasn&apos;t
          logged in here before — the sign-in form only asks for it once more than one firm exists
          on this platform.
        </p>
        <p className="select-all rounded-sm border border-hairline bg-ink-800 px-3 py-2 font-mono text-sm text-ink-100">
          {session.firmId}
        </p>
      </Card>
    </div>
  );
}
