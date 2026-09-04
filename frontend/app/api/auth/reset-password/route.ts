import { NextRequest, NextResponse } from 'next/server';

// Same reasoning as forgot-password/route.ts — calls the backend
// directly, no wm_token cookie involved (the requester isn't logged in;
// the token+firmId in the request body ARE the credential here).
export async function POST(req: NextRequest) {
  const body = await req.json();
  const backendRes = await fetch(`${process.env.BACKEND_API_URL}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await backendRes.json().catch(() => ({}));
  return NextResponse.json(payload, { status: backendRes.status });
}
