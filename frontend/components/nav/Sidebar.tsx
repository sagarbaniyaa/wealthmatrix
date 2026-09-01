'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const ADVISER_LINKS = [
  { href: '/advisor/dashboard', label: 'Overview' },
  { href: '/advisor/households', label: 'Households' },
  { href: '/advisor/compliance', label: 'Compliance' },
  { href: '/advisor/reports', label: 'Reports' },
  { href: '/advisor/providers', label: 'Providers' },
  { href: '/advisor/report-templates', label: 'Report Templates' },
];

const RESEARCH_LINKS = [
  { href: '/advisor/research/funds', label: 'Funds' },
  { href: '/advisor/research/screener', label: 'Screener' },
  { href: '/advisor/research/compare', label: 'Compare' },
  { href: '/advisor/research/impact', label: 'Switch impact' },
  { href: '/advisor/research/model-portfolios', label: 'Model portfolios' },
];

const CLIENT_LINKS = [
  { href: '/client', label: 'Dashboard' },
  { href: '/client/profile', label: 'Profile' },
  { href: '/client/income', label: 'Income' },
  { href: '/client/assets', label: 'Assets & liabilities' },
  { href: '/client/structure', label: 'Structure' },
  { href: '/client/notes', label: 'Notes & activity' },
  { href: '/client/reports', label: 'Reports' },
];

export function Sidebar({ mode, email }: { mode: 'adviser' | 'client'; email: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const links = mode === 'adviser' ? ADVISER_LINKS : CLIENT_LINKS;
  const loginPath = mode === 'adviser' ? '/login/advisor' : '/login/client';

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    // replace, not push+refresh: the authenticated page you're leaving
    // shouldn't sit in history — landing back on it after "back" just
    // bounces you straight to the login page again via middleware, which
    // reads as "back doesn't work". replace() also sidesteps the
    // push()-then-refresh() combo that was corrupting the history entry
    // outright (see the login pages for the full explanation).
    router.replace(loginPath);
  }

  return (
    <aside className="flex h-screen w-56 flex-col overflow-y-auto border-r border-hairline bg-ink-900">
      <div className="border-b border-hairline px-5 py-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brass-400">WealthMatrix</p>
        <p className="mt-1 font-display text-lg text-ink-100">Enterprise</p>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {links.map((link) => <NavLink key={link.href} href={link.href} label={link.label} pathname={pathname} />)}

        {mode === 'adviser' && (
          <>
            <p className="px-3 pb-1 pt-4 text-[10px] font-medium uppercase tracking-[0.15em] text-ink-500">Research</p>
            {RESEARCH_LINKS.map((link) => <NavLink key={link.href} href={link.href} label={link.label} pathname={pathname} />)}
          </>
        )}
      </nav>

      <div className="border-t border-hairline px-5 py-4">
        <p className="truncate text-xs text-ink-300">{email}</p>
        <button onClick={logout} className="mt-2 text-xs text-brass-400 hover:text-brass-300">
          Sign out
        </button>
      </div>
    </aside>
  );
}

function NavLink({ href, label, pathname }: { href: string; label: string; pathname: string }) {
  // Exact match for a root nav item (e.g. /client, /advisor/dashboard) so it
  // doesn't stay highlighted while on every sub-page too.
  const active = pathname === href || (href.split('/').length > 2 && pathname.startsWith(href + '/'));
  return (
    <Link
      href={href}
      className={`block rounded-sm px-3 py-2 text-sm transition ${
        active ? 'bg-brass-500/15 text-brass-400' : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100'
      }`}
    >
      {label}
    </Link>
  );
}
