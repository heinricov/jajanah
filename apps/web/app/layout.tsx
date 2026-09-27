import type { Metadata } from 'next';

import '@packages/ui/globals.css';
import { AuthProvider } from '@packages/auth/next';
import { getSessionUser } from '@packages/auth/next/server';

export const metadata: Metadata = {
  title: 'jajanah — Web',
  description: 'Aplikasi web jajanah',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getSessionUser();

  return (
    <html lang="id">
      <body>
        <AuthProvider initialUser={user}>{children}</AuthProvider>
      </body>
    </html>
  );
}
