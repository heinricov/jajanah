import { SESSION_COOKIE } from '@packages/auth/next/cookie';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Lapisan pertama: cookie sesi harus ada untuk dashboard admin.
 * Verifikasi otoritatif (token valid + role ADMIN) dilakukan `requireAdmin()`
 * di `(protected)/layout.tsx`.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
