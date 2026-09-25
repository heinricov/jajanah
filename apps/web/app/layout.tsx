import type { Metadata } from 'next';

import '@packages/ui/globals.css';

export const metadata: Metadata = {
  title: 'jajanah — Web',
  description: 'Aplikasi web jajanah',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
