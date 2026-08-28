import { NextRequest, NextResponse } from 'next/server';

// Route gating by role. This is a UX convenience only — the real
// authorization boundary is the backend's RolesGuard + RLS; a client role
// spoofing this cookie still hits 403s on every actual data call.
//
// / is the public marketing site (no auth). /login/advisor and
// /login/client are the two entry points. /advisor/* and /client/* are
// the two authenticated platforms.
export function middleware(req: NextRequest) {
  const token = req.cookies.get('wm_token')?.value;
  const role = req.cookies.get('wm_role')?.value;
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/login')) {
    return NextResponse.next();
  }

  const wantsAdvisor = pathname.startsWith('/advisor');
  const wantsClient = pathname.startsWith('/client');

  if (!token) {
    return NextResponse.redirect(new URL(wantsClient ? '/login/client' : '/login/advisor', req.url));
  }

  if (wantsAdvisor && role === 'client') {
    return NextResponse.redirect(new URL('/client', req.url));
  }

  if (wantsClient && role !== 'client') {
    return NextResponse.redirect(new URL('/advisor/dashboard', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/advisor/:path*', '/client/:path*'],
};
