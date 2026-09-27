import { cn } from '@packages/ui/lib/utils';

export type FormBannerProps = {
  /** Pesan gagal (API/transport) — tone merah. */
  error?: React.ReactNode;
  /** Pesan informasi netral (mis. fitur belum tersedia). */
  notice?: React.ReactNode;
  className?: string;
};

export function FormBanner({ error, notice, className }: FormBannerProps) {
  if (!error && !notice) return null;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
