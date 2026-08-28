import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Generic authenticated proxy: every client-component fetch to
// /api/proxy/<backend-path> lands here, gets the httpOnly token attached
// server-side, and is forwarded to the NestJS API. Client JS never sees
// the JWT, and every backend route (all under JwtAuthGuard) is reachable
// through this one handler without bespoke Next.js routes per resource.
//
// Two directions this has to get right, added for the Provider Hub's
// file upload/download endpoints (LOA templates, KYC/ID/bank-statement
// documents, generated provider_pack.zip): a multipart/form-data request
// body must be forwarded as raw bytes with its original boundary header,
// not JSON.stringify'd — and a binary response (zip/pdf) must come back
// as raw bytes with its real content-type, not coerced through
// text()+JSON like every other (JSON) response here.
async function proxy(req: NextRequest, path: string[]) {
  const token = cookies().get('wm_token')?.value;
  if (!token) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });

  const search = req.nextUrl.search;
  const targetUrl = `${process.env.BACKEND_API_URL}/${path.join('/')}${search}`;

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const init: RequestInit = { method: req.method, headers };

  if (req.method !== 'GET' && req.method !== 'DELETE') {
    const incomingContentType = req.headers.get('content-type') ?? '';
    if (incomingContentType.startsWith('multipart/form-data')) {
      headers['Content-Type'] = incomingContentType; // includes the boundary — must be forwarded verbatim
      init.body = await req.arrayBuffer();
    } else {
      headers['Content-Type'] = 'application/json';
      init.body = await req.text();
    }
  }

  const backendRes = await fetch(targetUrl, init);
  const contentType = backendRes.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const payload = await backendRes.json();
    return NextResponse.json(payload, { status: backendRes.status });
  }

  // An empty body (typical of a 200/204 DELETE with no JSON payload) has
  // no content-type at all — treat that the same as text, not binary, or
  // res.json() on the caller's side throws on the empty/octet-stream
  // response and every void-returning DELETE silently fails client-side.
  if (contentType.startsWith('text/') || contentType === '') {
    const payload = await backendRes.text();
    return NextResponse.json(payload, { status: backendRes.status });
  }

  // Binary passthrough — zip/pdf downloads.
  const buffer = await backendRes.arrayBuffer();
  const outHeaders: Record<string, string> = { 'Content-Type': contentType || 'application/octet-stream' };
  const disposition = backendRes.headers.get('content-disposition');
  if (disposition) outHeaders['Content-Disposition'] = disposition;
  return new NextResponse(buffer, { status: backendRes.status, headers: outHeaders });
}

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) { return proxy(req, params.path); }
export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) { return proxy(req, params.path); }
export async function PATCH(req: NextRequest, { params }: { params: { path: string[] } }) { return proxy(req, params.path); }
export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) { return proxy(req, params.path); }
