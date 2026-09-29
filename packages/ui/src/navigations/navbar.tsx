import { Button } from '@packages/ui/components/button';
import { cn } from '@packages/ui/lib/utils';
import { AppLogo } from '../apps/app-logo';
import { UserAuth } from '../auth/user-auth';

export type NavbarItem = {
  href: string;
  label: string;
};

export type NavbarUser = {
  name?: string | null;
  /** Foto profil (OAuth) — null/kosong → `UserAuth` menampilkan inisial. */
  image?: string | null;
};

export type NavbarProps = {
  user?: NavbarUser | null;
  items?: NavbarItem[];
  showAuth?: boolean;
  /** Buka menu avatar → Logout (dipasok dari client, mis. `useAuth().logout`). */
  onLogout?: () => void;
  className?: string;
};

const DEFAULT_ITEMS: NavbarItem[] = [{ href: '/', label: 'Beranda' }];

export function Navbar({
  user,
  items = DEFAULT_ITEMS,
  showAuth = true,
  onLogout,
  className,
}: NavbarProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur',
        className,
      )}
    >
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-4">
          <AppLogo href="/" orientation="horizontal" />

          <nav className="flex items-center gap-1">
            {items.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>

        {showAuth ? (
          user ? (
            <UserAuth
              user={{ name: user.name ?? undefined, image: user.image ?? undefined }}
              menuLabel={user.name ?? 'Akun'}
              onLogout={onLogout}
            />
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <a href="/auth/login">Masuk</a>
              </Button>
              <Button size="sm" asChild>
                <a href="/auth/register">Daftar</a>
              </Button>
            </div>
          )
        ) : null}
      </div>
    </header>
  );
}
