import { requireAuth } from '@packages/auth/next/server';

import { ProfileClient } from '@/components/profile-client';

/**
 * Halaman terproteksi utama: pengganti `/home`.
 * Verifikasi sesi dilakukan dua lapis — `proxy.ts` (cookie) + layout `(protected)`.
 */
export default async function ProfilePage() {
  const user = await requireAuth();

  return <ProfileClient user={user} />;
}
