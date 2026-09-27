import { requireAuth } from '@packages/auth/next/server';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return children;
}
