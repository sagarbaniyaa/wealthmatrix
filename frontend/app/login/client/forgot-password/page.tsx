import Link from 'next/link';

export default function ClientForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-6">
      <div className="w-full max-w-sm text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-verdigris-600">WealthMatrix</p>
        <h1 className="mt-2 font-display text-2xl text-ink-900">Need a new password?</h1>
        <div className="mt-6 rounded-2xl border border-ink-100 bg-white p-8 shadow-sm">
          <p className="text-sm leading-relaxed text-ink-600">
            We don&apos;t have self-service password resets set up just yet.
            Reach out to your adviser and they&apos;ll get you sorted.
          </p>
        </div>
        <Link href="/login/client" className="mt-6 inline-block text-sm text-verdigris-600 hover:text-verdigris-500">
          ← Back to sign in
        </Link>
      </div>
    </main>
  );
}
