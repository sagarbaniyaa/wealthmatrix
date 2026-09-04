'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

// Reached from the link in the reset email — token + firmId travel as
// query params (see AuthService.forgotPassword's own comment on why:
// this request has no other way to establish which firm's user table to
// check before it's looked anything up).
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const firmId = searchParams.get('firmId');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, firmId, newPassword }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message ?? 'Could not reset your password.');
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset your password.');
    } finally {
      setLoading(false);
    }
  }

  if (!token || !firmId) {
    return (
      <Centered>
        <p className="text-sm leading-relaxed text-ink-300">
          This reset link is missing its token — copy the full link from the email again, or
          request a new one.
        </p>
        <Link href="/login/advisor/forgot-password" className="mt-6 block text-sm text-brass-400 hover:text-brass-300">
          Request a new link →
        </Link>
      </Centered>
    );
  }

  if (done) {
    return (
      <Centered>
        <p className="text-sm leading-relaxed text-ink-300">Your password has been reset.</p>
        <button
          onClick={() => router.push('/login/advisor')}
          className="mt-6 w-full rounded-sm bg-brass-500 py-2.5 text-sm font-medium text-ink-950 transition hover:bg-brass-400"
        >
          Sign in
        </button>
      </Centered>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-950 px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-10 block text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-brass-400">WealthMatrix</p>
          <h1 className="mt-2 font-display text-2xl text-ink-100">Choose a new password</h1>
        </Link>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-sm border border-hairline bg-ink-900 p-8">
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-wide text-ink-300">New password</span>
            <input
              type="password"
              value={newPassword}
              placeholder="••••••••"
              minLength={8}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="w-full rounded-sm border border-hairline bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brass-500"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-wide text-ink-300">Confirm password</span>
            <input
              type="password"
              value={confirmPassword}
              placeholder="••••••••"
              minLength={8}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
            {loading ? 'Resetting…' : 'Reset password'}
          </button>
        </form>
      </div>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-950 px-6">
      <div className="w-full max-w-sm text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-brass-400">WealthMatrix</p>
        <h1 className="mt-2 font-display text-2xl text-ink-100">Reset your password</h1>
        <div className="mt-6 rounded-sm border border-hairline bg-ink-900 p-8">{children}</div>
      </div>
    </main>
  );
}
