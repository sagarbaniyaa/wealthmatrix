'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Professional, understated — matches the adviser platform's dark ledger
// aesthetic. Firm ID is still required (the backend scopes login by
// firm), but framed as a firm reference rather than a raw field label.
export default function AdvisorLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firmId, setFirmId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, firmId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? 'Invalid credentials');
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
          <Field label="Firm reference" value={firmId} onChange={setFirmId} placeholder="firm UUID" />
          <Field label="Email" value={email} onChange={setEmail} type="email" placeholder="you@firm.com" />
          <Field label="Password" value={password} onChange={setPassword} type="password" placeholder="••••••••" />

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
