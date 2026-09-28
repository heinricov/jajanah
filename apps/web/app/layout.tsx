import type { Metadata } from 'next';

import '@packages/ui/globals.css';
import { AuthProvider } from '@packages/auth/next';
import { getSessionUser } from '@packages/auth/next/server';
import { Oxanium } from 'next/font/google';
import { cn } from '@packages/ui/lib/utils';

const oxanium = Oxanium({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'jajanah — Web',
  description: 'Aplikasi web jajanah',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getSessionUser();

  return (
    <html lang="id" className={cn('font-sans', oxanium.variable)}>
      <body>
        <AuthProvider initialUser={user}>{children}</AuthProvider>
      </body>
    </html>
  );
}
