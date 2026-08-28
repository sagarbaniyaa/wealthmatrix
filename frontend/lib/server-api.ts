import { cookies } from 'next/headers';
import { getTokenCookieName } from './session';

/**
 * Server Component / route-handler fetch helper — calls the backend
 * directly (not through the proxy, since we're already on the server)
 * using the httpOnly cookie token. Use this in Server Components; use
 * `api` (lib/api.ts) in Client Components.
 */
export async function serverApiGet<T>(path: string): Promise<T> {
  const token = cookies().get(getTokenCookieName())?.value;
  const res = await fetch(`${process.env.BACKEND_API_URL}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Backend request failed: ${res.status} ${path}`);
  }
  return res.json();
}

/** Same as serverApiGet but POSTs — for the AI endpoints (risk-metrics, scenario-explain) used when building a print/report page server-side. */
export async function serverApiPost<T>(path: string, body?: unknown): Promise<T> {
  const token = cookies().get(getTokenCookieName())?.value;
  const res = await fetch(`${process.env.BACKEND_API_URL}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Backend request failed: ${res.status} ${path}`);
  }
  return res.json();
}
