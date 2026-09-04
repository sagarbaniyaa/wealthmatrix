'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Self-service onboarding for a brand-new firm (see backend
// AuthService.signup) — before this existed, getting a firm onto this
// platform meant a manual DB insert. The person who signs up becomes
// that firm's first admin.
export default function SignupPage() {
  const router = useRouter();
  const [firmName, setFirmName] = useState('');
  const [adviserName, setAdviserName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firmName, adviserName, email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? 'Could not create your firm.');
      }
      router.push('/advisor/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your firm.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-950 px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-10 block text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-brass-400">WealthMatrix</p>
          <h1 className="mt-2 font-display text-3xl text-ink-100">Set up your firm</h1>
          <p className="mt-1 text-sm text-ink-300">Get your book onto WealthMatrix in a minute</p>
        </Link>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-sm border border-hairline bg-ink-900 p-8">
          <Field label="Firm name" value={firmName} onChange={setFirmName} placeholder="Smith Wealth Management" />
          <Field label="Your name" value={adviserName} onChange={setAdviserName} placeholder="Jane Smith" />
          <Field label="Email" value={email} onChange={setEmail} type="email" placeholder="you@firm.com" />
          <Field label="Password" value={password} onChange={setPassword} type="password" placeholder="At least 8 characters" minLength={8} />

          {error && <p className="text-sm text-rust-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-sm bg-brass-500 py-2.5 text-sm font-medium text-ink-950 transition hover:bg-brass-400 disabled:opacity-50"
          >
            {loading ? 'Creating your firm…' : 'Create firm & continue'}
          </button>

          <p className="pt-1 text-center text-xs text-ink-400">
            Already have an account?{' '}
            <Link href="/login/advisor" className="text-brass-400 hover:text-brass-300">Sign in</Link>
          </p>
        </form>
      </div>
    </main>
  );
}

function Field({
  label, value, onChange, type = 'text', placeholder, minLength,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; minLength?: number }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wide text-ink-300">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        minLength={minLength}
        onChange={(e) => onChange(e.target.value)}
        required
        className="w-full rounded-sm border border-hairline bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brass-500"
      />
    </label>
  );
}
