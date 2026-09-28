import { beginGoogleOAuth } from '@packages/auth/next/oauth';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * GET /api/auth/google — mulai alur OAuth Google (redirect ke consent screen).
 *
 * Route handler di sini adalah pengecualian yang terdokumentasi terhadap
 * aturan "tanpa route `/api/auth/*`": OAuth2 butuh `redirect_uri` GET yang
 * didaftarkan di Google Console — server action tidak menyediakannya.
 * Logika ada di `@packages/auth/next/oauth` (SSOT).
 */
export async function GET(request: NextRequest) {
  const result = await beginGoogleOAuth(request.url, request.nextUrl.searchParams.get('next'));

  if (!result.ok) {
    if (result.log) console.error(`[auth] begin Google OAuth gagal: ${result.log}`);
    return NextResponse.redirect(new URL(`/auth/login?error=${result.error}`, request.url));
  }
  return NextResponse.redirect(result.url);
}
