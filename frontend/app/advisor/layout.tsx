import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { Sidebar } from '@/components/nav/Sidebar';

// Server-side belt-and-braces role gate (middleware already redirects, but
// Server Components should never assume the client-side layer alone).
export default async function AdvisorLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login/advisor');
  if (session.role === 'client') redirect('/client');

  return (
    <div className="flex">
      <Sidebar mode="adviser" email={session.email} />
      <main className="flex-1 px-10 py-8">{children}</main>
    </div>
  );
}
