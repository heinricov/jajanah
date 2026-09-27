import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../components/breadcrumb';
import { Separator } from '../components/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '../components/sidebar';
import { TooltipProvider } from '../components/tooltip';
import { AppSidebar, type AppSidebarProps } from './app-sidebar';

export type DashboardUser = AppSidebarProps['user'];

export type DashboardLayoutProps = {
  children: React.ReactNode;
  /** User sesi nyata; tanpa prop ini dashboard jadi mode demo (data contoh). */
  user?: DashboardUser;
  /** Handler logout — memunculkan menu Logout fungsional di sidebar. */
  onLogout?: () => void;
};

export function DashboardLayout({ children, user, onLogout }: DashboardLayoutProps) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar
          {...(user !== undefined ? { user } : {})}
          {...(onLogout !== undefined ? { onLogout } : {})}
        />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="#">Build Your Application</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Data Fetching</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
