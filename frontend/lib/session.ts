import { cookies } from 'next/headers';
import { jwtDecode } from 'jwt-decode';
import type { SessionUser } from './types';

const TOKEN_COOKIE = 'wm_token';

/**
 * Server-side only: reads the httpOnly JWT cookie and decodes its payload
 * for display/routing purposes. This does NOT verify the signature — the
 * backend re-verifies on every API call via JwtStrategy, so a tampered
 * cookie simply fails there. Decoding here is purely so Server Components
 * can render "logged in as X" / gate route groups without an extra round
 * trip.
 */
export async function getSession(): Promise<SessionUser | null> {
  const token = cookies().get(TOKEN_COOKIE)?.value;
  if (!token) return null;
  try {
    const payload = jwtDecode<{ sub: string; firmId: string; role: string; email: string; personId: string | null }>(token);
    return { userId: payload.sub, firmId: payload.firmId, role: payload.role as SessionUser['role'], email: payload.email, personId: payload.personId };
  } catch {
    return null;
  }
}

export function getTokenCookieName() {
  return TOKEN_COOKIE;
}
