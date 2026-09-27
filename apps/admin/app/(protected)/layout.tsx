import React from 'react';
import { DashboardLayout } from '@packages/ui/dashboard/app-layout';

export default function layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DashboardLayout>{children}</DashboardLayout>
    </>
  );
}
