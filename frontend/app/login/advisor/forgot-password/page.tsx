import Link from 'next/link';

// Placeholder — there's no self-service password reset flow wired up yet
// (would need a token-based reset endpoint on the backend). For now this
// tells the adviser who to contact instead of dead-ending on a form that
// silently does nothing.
export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-950 px-6">
      <div className="w-full max-w-sm text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-brass-400">WealthMatrix</p>
        <h1 className="mt-2 font-display text-2xl text-ink-100">Reset your password</h1>
        <div className="mt-6 rounded-sm border border-hairline bg-ink-900 p-8">
          <p className="text-sm leading-relaxed text-ink-300">
            Self-service password reset isn&apos;t available yet. Contact your firm&apos;s
            administrator and they can update your password directly.
          </p>
        </div>
        <Link href="/login/advisor" className="mt-6 inline-block text-sm text-brass-400 hover:text-brass-300">
          ← Back to sign in
        </Link>
      </div>
    </main>
  );
}
