import { PageHeader } from '@/components/ui/PageHeader';
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
    </div>
  );
}
