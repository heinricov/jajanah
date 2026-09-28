'use client';

import { useAuth } from '@packages/auth/next';
import { Navbar } from '@packages/ui/navigations/';
import { useRouter } from 'next/navigation';

/**
 * Navbar interaktif untuk layout server: sesi dibaca dari `AuthProvider`
 * (user reaktif — langsung flip ke Masuk/Daftar setelah logout) dan
 * `onLogout` dipasok dari `useAuth().logout` (fungsi tak boleh datang
 * dari server component).
 */
export function SiteNavbar() {
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <Navbar
      user={user}
      onLogout={async () => {
        await logout();
        router.replace('/');
      }}
    />
  );
}
