'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// Professional, understated — matches the adviser platform's dark ledger
// aesthetic. No firm reference field by default: the backend
// auto-resolves the firm when there's exactly one in the system, and a
// returning browser sends whichever firm it last logged into via the
// wm_firm_hint cookie (see /api/auth/login's own comment — a UX
// convenience, not a security boundary). The field only appears if a
// login actually fails because more than one firm exists and this
// browser has no hint yet — e.g. a colleague signing in for the first
// time on a new device (see the "Firm reference" card on My Profile for
// where that value comes from).
export default function AdvisorLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firmId, setFirmId] = useState('');
  const [needsFirmId, setNeedsFirmId] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const hint = readCookie('wm_firm_hint');
    if (hint) setFirmId(hint);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, firmId: firmId || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message: string = body.message ?? 'Invalid credentials';
        if (message.includes('Multiple firms exist')) setNeedsFirmId(true);
        throw new Error(message);
      }
      const { user } = await res.json();
      // No router.refresh() here — calling it right after push() to a brand
      // new route is what was breaking the browser back button (Next.js's
      // router history bookkeeping gets confused and silently drops the
      // pending history entry). The destination page fetches its own data
      // on mount anyway, so refresh() was redundant here.
      if (user.role === 'client') {
        router.push('/client');
      } else {
        router.push('/advisor/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-950 px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-10 block text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-brass-400">WealthMatrix</p>
          <h1 className="mt-2 font-display text-3xl text-ink-100">Adviser Sign In</h1>
          <p className="mt-1 text-sm text-ink-300">Enterprise Ledger — for advisers &amp; firm admins</p>
        </Link>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-sm border border-hairline bg-ink-900 p-8">
          <Field label="Email" value={email} onChange={setEmail} type="email" placeholder="you@firm.com" />
          <Field label="Password" value={password} onChange={setPassword} type="password" placeholder="••••••••" />
          {needsFirmId && (
            <Field
              label="Firm reference"
              value={firmId}
              onChange={setFirmId}
              placeholder="Ask your firm admin for this — see their My Profile page"
            />
          )}

          {error && <p className="text-sm text-rust-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-sm bg-brass-500 py-2.5 text-sm font-medium text-ink-950 transition hover:bg-brass-400 disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <div className="flex items-center justify-between pt-1 text-xs">
            <Link href="/login/advisor/forgot-password" className="text-ink-400 hover:text-brass-400">
              Forgot password?
            </Link>
            <Link href="/login/client" className="text-ink-400 hover:text-brass-400">
              Client? Sign in here →
            </Link>
          </div>
          <p className="pt-3 text-center text-xs text-ink-400">
            New firm?{' '}
            <Link href="/login/advisor/signup" className="text-brass-400 hover:text-brass-300">Set up your account</Link>
          </p>
        </form>
      </div>
    </main>
  );
}

function Field({
  label, value, onChange, type = 'text', placeholder,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wide text-ink-300">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        required
        className="w-full rounded-sm border border-hairline bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brass-500"
      />
    </label>
  );
}
