import * as Sentry from '@sentry/node';

/**
 * Free-tier error monitoring. Before this, the ONLY way an unexpected
 * production error surfaced was a user hitting it and reporting it back
 * — which is exactly what happened with the missing-migration-010 bug
 * that broke Document Intake on the live site. Sentry's free tier would
 * have reported that the moment it first happened, not whenever someone
 * next tried the feature.
 *
 * Same graceful-degradation discipline as every other optional
 * integration here: with no SENTRY_DSN set, `init()` is a no-op and
 * `captureException` silently does nothing — the app runs exactly as it
 * did before this was added, it just doesn't get the safety net.
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({ dsn, tracesSampleRate: 0.1, environment: process.env.NODE_ENV ?? 'development' });
}

/** Only for GENUINE bugs — an unhandled exception, or a database error this backend doesn't recognise. Never for ordinary 400/401/403/404s, which are expected application flow, not incidents. */
export function reportUnexpectedError(exception: unknown): void {
  if (!process.env.SENTRY_DSN) return;
  Sentry.captureException(exception);
}
