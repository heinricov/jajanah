import { Wallet } from 'lucide-react';

import { Button } from '@packages/ui/components/button';
import { cn } from '@packages/ui/lib/utils';

export type NavbarItem = {
  href: string;
  label: string;
};

export type NavbarUser = {
  name?: string | null;
};

export type NavbarProps = {
  user?: NavbarUser | null;
  items?: NavbarItem[];
  showAuth?: boolean;
  className?: string;
};

const DEFAULT_ITEMS: NavbarItem[] = [{ href: '/', label: 'Beranda' }];

function initialsOf(name?: string | null): string {
  return (
    name
      ?.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase() || '?'
  );
}

export function Navbar({ user, items = DEFAULT_ITEMS, showAuth = true, className }: NavbarProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur',
        className,
      )}
    >
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-4">
          <a href="/" className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Wallet className="size-4" />
            </span>
            <span className="text-sm font-semibold">jajanah</span>
          </a>

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
            <span className="flex max-w-48 items-center gap-2 rounded-full border border-border py-1 pr-3 pl-1">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                {initialsOf(user.name)}
              </span>
              <span className="truncate text-sm">{user.name ?? 'Akun'}</span>
            </span>
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
