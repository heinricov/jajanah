import { requireAdmin } from '@packages/auth/next/server';

import { AuthDashboardLayout } from '@/components/auth-dashboard-layout';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <AuthDashboardLayout>{children}</AuthDashboardLayout>;
}
