import { cookies } from 'next/headers';
import { getSession, getTokenCookieName } from './session';

jest.mock('next/headers', () => ({ cookies: jest.fn() }));

const mockCookies = cookies as jest.Mock;

/**
 * jwt-decode only reads the payload — it never verifies the signature
 * (the backend does that, on every real request, via JwtStrategy). So a
 * fake signature segment is fine here; only the payload needs to be a
 * real base64url-encoded JSON object.
 */
function fakeJwt(payload: object): string {
  const base64url = (obj: object) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url(payload)}.fake-signature`;
}

describe('getSession', () => {
  it('returns null when there is no token cookie', async () => {
    mockCookies.mockReturnValue({ get: () => undefined });
    expect(await getSession()).toBeNull();
  });

  it('decodes a well-formed token into a SessionUser', async () => {
    const token = fakeJwt({ sub: 'user-1', firmId: 'firm-1', role: 'adviser', email: 'a@b.com', personId: null });
    mockCookies.mockReturnValue({ get: () => ({ value: token }) });

    expect(await getSession()).toEqual({
      userId: 'user-1', firmId: 'firm-1', role: 'adviser', email: 'a@b.com', personId: null,
    });
  });

  it('carries a non-null personId through (the client role case)', async () => {
    const token = fakeJwt({ sub: 'user-2', firmId: 'firm-1', role: 'client', email: 'c@b.com', personId: 'person-9' });
    mockCookies.mockReturnValue({ get: () => ({ value: token }) });

    const session = await getSession();
    expect(session?.personId).toBe('person-9');
    expect(session?.role).toBe('client');
  });

  it('returns null (not a thrown error) for a malformed/garbage token, rather than crashing the page', async () => {
    mockCookies.mockReturnValue({ get: () => ({ value: 'not-a-real-jwt' }) });
    expect(await getSession()).toBeNull();
  });
});

describe('getTokenCookieName', () => {
  it('is stable — the proxy route and login flow both hardcode this same name', () => {
    expect(getTokenCookieName()).toBe('wm_token');
  });
});
