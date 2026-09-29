'use client';

import { useRouter } from 'next/navigation';

import { useAuth } from '@packages/auth/next';
import { ProfileView, type ProfileViewUser } from '@packages/ui/profile/';
import { ResendVerification } from './resend-verification';

/**
 * Halaman profil (lapisan client): datanya datang dari `requireAuth()` di
 * server, komponen ini hanya menyambung aksi interaktif — logout yang
 * benar-benar direvoke dan kirim ulang email konfirmasi.
 */
export function ProfileClient({ user }: { user: ProfileViewUser }) {
  const router = useRouter();
  const { logout } = useAuth();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8 sm:px-6">
      <ProfileView
        user={user}
        resendVerification={
          user.emailVerified ? undefined : <ResendVerification email={user.email} />
        }
        onLogout={async () => {
          await logout();
          router.replace('/auth/login');
        }}
      />
    </main>
  );
}
