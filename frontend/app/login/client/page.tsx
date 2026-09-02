'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Deliberately different tone from the adviser login: light "paper"
// surface, rounded-lg corners, verdigris accent instead of brass, warmer
// copy. Same underlying auth call — the difference is presentation, not
// security (that's enforced server-side by role + RLS regardless).
export default function ClientLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? 'That email or password doesn’t match.');
      }
      const { user } = await res.json();
      // No router.refresh() here — see the advisor login page for why.
      if (user.role === 'client') {
        router.push('/client');
      } else {
        router.push('/advisor/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong — please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 block text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-verdigris-600">WealthMatrix</p>
          <h1 className="mt-2 font-display text-3xl text-ink-900">Welcome back</h1>
          <p className="mt-1 text-sm text-ink-500">Sign in to view your portfolio</p>
        </Link>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-ink-100 bg-white p-8 shadow-sm">
          <Field label="Email" value={email} onChange={setEmail} type="email" placeholder="you@example.com" />
          <Field label="Password" value={password} onChange={setPassword} type="password" placeholder="••••••••" />

          {error && <p className="text-sm text-rust-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-verdigris-500 py-3 text-sm font-semibold text-white transition hover:bg-verdigris-600 disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <div className="flex items-center justify-between pt-1 text-xs">
            <Link href="/login/client/forgot-password" className="text-ink-500 hover:text-verdigris-600">
              Forgot password?
            </Link>
            <Link href="/login/advisor" className="text-ink-500 hover:text-verdigris-600">
              Adviser? Sign in here →
            </Link>
          </div>
        </form>

        <p className="mt-6 text-center text-xs text-ink-500">
          New here? Your adviser will set up your account and share your login details.
        </p>
      </div>
    </main>
  );
}

function Field({
  label, value, onChange, type = 'text', placeholder,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-700">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        required
        className="w-full rounded-xl border border-ink-100 bg-paper px-4 py-2.5 text-sm text-ink-900 outline-none placeholder:text-ink-400 focus:border-verdigris-400 focus:ring-2 focus:ring-verdigris-100"
      />
    </label>
  );
}
