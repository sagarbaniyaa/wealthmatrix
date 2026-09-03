import * as jwt from 'jsonwebtoken';

/**
 * Signs a token with the same JWT_SECRET the running backend uses,
 * mirroring exactly what AuthService.login() issues — the same
 * technique used for manual curl-based verification throughout this
 * project's build, just formalised here so integration tests don't
 * need a live login round-trip (and don't depend on any one
 * demo user's password staying what it is today).
 */
export function signTestJwt(payload: { sub: string; firmId: string; role: string; email: string; personId?: string | null }): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set — did jest-env-setup.ts load .env correctly?');
  return jwt.sign({ ...payload, personId: payload.personId ?? null }, secret, { expiresIn: '10m' });
}
