import { Command } from 'lucide-react';

import { cn } from '@packages/ui/lib/utils';

export type AppLogoProps = {
  href?: string;
  /** `vertical` (default) = ikon di atas teks (form auth); `horizontal` = ikon di samping teks (navbar/footer). */
  orientation?: 'vertical' | 'horizontal';
  className?: string;
};

export function AppLogo({ href = '#', orientation = 'vertical', className }: AppLogoProps) {
  return (
    <a
      href={href}
      className={cn(
        'flex',
        orientation === 'vertical'
          ? 'flex-col items-center gap-2 text-center'
          : 'items-center gap-2 text-left',
        className,
      )}
    >
      <span className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
        <Command className="size-5" />
      </span>
      <span className="grid leading-tight">
        <span className="text-sm font-medium">JAJAN AH</span>
        <span className="text-xs text-muted-foreground">Makan BERAT & Makan RINGAN</span>
      </span>
    </a>
  );
}
