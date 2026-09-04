import { NextRequest, NextResponse } from 'next/server';

// Calls the backend directly, NOT through /api/proxy — that route
// requires an existing wm_token cookie, which a locked-out user by
// definition doesn't have. No cookie is set here either; this only ever
// triggers an email.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const backendRes = await fetch(`${process.env.BACKEND_API_URL}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await backendRes.json().catch(() => ({}));
  return NextResponse.json(payload, { status: backendRes.status });
}
