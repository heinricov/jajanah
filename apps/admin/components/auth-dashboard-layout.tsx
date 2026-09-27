'use client';

import { useRouter } from 'next/navigation';

import { DashboardLayout } from '@packages/ui/dashboard/app-layout';
import { useAuth } from '@packages/auth/next';

/** Bungkus dashboard admin: user dari sesi + logout yang benar-benar me-revoke. */
export function AuthDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <DashboardLayout
      {...(user !== null ? { user: { name: user.name, email: user.email } } : {})}
      onLogout={async () => {
        await logout();
        router.replace('/auth/login');
      }}
    >
      {children}
    </DashboardLayout>
  );
}
