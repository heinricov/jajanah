import { cn } from '@packages/ui/lib/utils';
import { AppLogo } from '../apps/app-logo';

export type FooterItem = {
  href: string;
  label: string;
};

export type FooterProps = {
  items?: FooterItem[];
  copyright?: React.ReactNode;
  className?: string;
};

const DEFAULT_ITEMS: FooterItem[] = [
  { href: '/', label: 'Beranda' },
  { href: '/auth/login', label: 'Masuk' },
];

export function Footer({ items = DEFAULT_ITEMS, copyright, className }: FooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className={cn('border-t border-border bg-background', className)}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
        <AppLogo href="/" orientation="horizontal" />

        <nav className="flex items-center gap-4">
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="mx-auto w-full max-w-6xl border-t border-border px-4 py-4">
        <p className="text-xs text-muted-foreground">
          {copyright ?? `© ${year} jajanah. Semua hak dilindungi.`}
        </p>
      </div>
    </footer>
  );
}
