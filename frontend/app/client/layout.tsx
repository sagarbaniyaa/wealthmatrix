import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { Sidebar } from '@/components/nav/Sidebar';

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login/client');
  if (session.role !== 'client') redirect('/advisor/dashboard');

  return (
    <div className="flex">
      <Sidebar mode="client" email={session.email} />
      <main className="flex-1 px-10 py-8">{children}</main>
    </div>
  );
}
