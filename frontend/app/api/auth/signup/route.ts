import { NextRequest, NextResponse } from 'next/server';

// Same shape as /api/auth/login/route.ts: exchanges signup details for a
// JWT from the NestJS backend (which creates the firm + first admin
// user), then stores it the same httpOnly way — a successful signup logs
// the new admin straight in, no separate login step needed.
export async function POST(req: NextRequest) {
  const body = await req.json();

  const backendRes = await fetch(`${process.env.BACKEND_API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!backendRes.ok) {
    const err = await backendRes.json().catch(() => ({ message: 'Signup failed' }));
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
  // See login/route.ts's own comment — same non-security-boundary hint,
  // so THIS browser also skips the firm-reference field on future logins.
  res.cookies.set('wm_firm_hint', user.firmId, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });

  return res;
}
