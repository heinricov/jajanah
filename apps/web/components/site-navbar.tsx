'use client';

import { useRouter } from 'next/navigation';

import { useAuth } from '@packages/auth/next';
import { Navbar, type NavbarItem } from '@packages/ui/navigations/';

const BASE_ITEMS: NavbarItem[] = [{ href: '/', label: 'Beranda' }];

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
      items={user ? [...BASE_ITEMS, { href: '/profile', label: 'Profil' }] : BASE_ITEMS}
      onProfile={() => router.push('/profile')}
      onLogout={async () => {
        await logout();
        router.replace('/');
      }}
    />
  );
}
