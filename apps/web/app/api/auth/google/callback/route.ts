import { completeGoogleOAuth } from '@packages/auth/next/oauth';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * GET /api/auth/google/callback — `redirect_uri` OAuth Google: validasi state,
 * tukar kode, verifikasi ID token, find-or-create + link akun, set cookie sesi,
 * lalu redirect ke tujuan (`next` dari cookie state).
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const result = await completeGoogleOAuth(request.url, params.get('code'), params.get('state'));

  if (!result.ok) {
    if (result.log) console.error(`[auth] callback Google OAuth gagal: ${result.log}`);
    return NextResponse.redirect(new URL(`/auth/login?error=${result.error}`, request.url));
  }
  return NextResponse.redirect(new URL(result.next, request.url));
}
