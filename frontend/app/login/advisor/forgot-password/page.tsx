'use client';

import { useState } from 'react';
import Link from 'next/link';

// Real self-service reset now (see backend AuthService.forgotPassword) —
// this used to be a dead-end telling advisers to contact an admin.
// Deliberately shows the SAME message whether or not the email actually
// has an account (the backend enforces this too) — a form that says
// "no such user" is a free account-enumeration tool.
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      // Even a non-2xx here (e.g. rate-limited) shouldn't reveal anything
      // about the account — show the same generic confirmation regardless.
      void res;
      setSubmitted(true);
    } catch {
      setError('Something went wrong — please try again in a moment.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-950 px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-10 block text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-brass-400">WealthMatrix</p>
          <h1 className="mt-2 font-display text-2xl text-ink-100">Reset your password</h1>
        </Link>

        {submitted ? (
          <div className="rounded-sm border border-hairline bg-ink-900 p-8 text-center">
            <p className="text-sm leading-relaxed text-ink-300">
              If an account exists for <span className="text-ink-100">{email}</span>, a password
              reset link has been sent. It expires in 1 hour.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 rounded-sm border border-hairline bg-ink-900 p-8">
            <label className="block">
              <span className="mb-1.5 block text-xs uppercase tracking-wide text-ink-300">Email</span>
              <input
                type="email"
                value={email}
                placeholder="you@firm.com"
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-sm border border-hairline bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brass-500"
              />
            </label>
            {error && <p className="text-sm text-rust-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-sm bg-brass-500 py-2.5 text-sm font-medium text-ink-950 transition hover:bg-brass-400 disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        <Link href="/login/advisor" className="mt-6 block text-center text-sm text-brass-400 hover:text-brass-300">
          ← Back to sign in
        </Link>
      </div>
    </main>
  );
}
