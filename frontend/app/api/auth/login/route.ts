import { NextRequest, NextResponse } from 'next/server';

// Exchanges email/password/firmId for a JWT from the NestJS backend, then
// stores it as an httpOnly cookie so browser JS never touches the token
// directly. A parallel non-httpOnly `wm_role` cookie exists purely so
// middleware.ts can route-gate without decoding the JWT on every request.
export async function POST(req: NextRequest) {
  const body = await req.json();

  const backendRes = await fetch(`${process.env.BACKEND_API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!backendRes.ok) {
    const err = await backendRes.json().catch(() => ({ message: 'Login failed' }));
    return NextResponse.json(err, { status: backendRes.status });
  }

  const { accessToken, user } = await backendRes.json();
  const res = NextResponse.json({ user });

  res.cookies.set('wm_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  });
  res.cookies.set('wm_role', user.role, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  });

  return res;
}
