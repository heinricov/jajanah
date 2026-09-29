'use client';

import {
  BadgeCheckIcon,
  CalendarDaysIcon,
  CircleCheckIcon,
  ClockIcon,
  HistoryIcon,
  KeyRoundIcon,
  LogOutIcon,
  MailIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
  UserIcon,
  XCircleIcon,
} from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@packages/ui/components/avatar';
import { Badge } from '@packages/ui/components/badge';
import { Button } from '@packages/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@packages/ui/components/card';
import { cn } from '@packages/ui/lib/utils';

export type ProfileViewUser = {
  name: string;
  email: string;
  /** Foto profil (OAuth) — null/kosong → tampilkan inisial. */
  image?: string | null;
  role: 'USER' | 'ADMIN';
  isActive: boolean;
  emailVerified: boolean;
  /** ISO string; `null` = belum pernah masuk. */
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProfileViewProps = {
  user: ProfileViewUser;
  /** Path halaman ganti password — default `/auth/forgot-password`. */
  passwordChangeHref?: string;
  /** Slot untuk tombol kirim ulang email konfirmasi (bawa dari aplikasi). */
  resendVerification?: React.ReactNode;
  /** Bila diisi, tombol "Keluar" tampil dan melakukan logout sungguhan. */
  onLogout?: () => void;
  className?: string;
};

/**
 * `timeZone` dikunci supaya hasil format identik di server dan browser —
 * beda zona akan memicu hydration mismatch karena komponen ini di-SSR.
 */
const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Jakarta',
});

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return dateFormatter.format(date);
}

function initialsOf(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
  return initials.length > 0 ? initials : '?';
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-xs/relaxed text-muted-foreground">{label}</span>
        <span className="text-sm font-medium break-words">{value}</span>
      </div>
    </div>
  );
}

/**
 * Halaman profil **read-only**: hero identitas + dua kartu (informasi akun,
 * keamanan). Hanya membaca `ProfileViewUser` — tidak ada aksi tulis di
 * komponen ini; aksi interaktif (logout, kirim ulang verifikasi) dipasok
 * lewat prop, sehingga `@packages/ui` tetap tanpa dependensi workspace.
 */
export function ProfileView({
  user,
  passwordChangeHref = '/auth/forgot-password',
  resendVerification,
  onLogout,
  className,
}: ProfileViewProps) {
  const roleLabel = user.role === 'ADMIN' ? 'Admin' : 'User';
  const statusLabel = user.isActive ? 'Aktif' : 'Nonaktif';

  return (
    <div className={cn('flex w-full flex-col gap-6', className)}>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium tracking-[0.18em] text-muted-foreground uppercase">
          Profil
        </p>
        <p className="text-sm text-muted-foreground">
          Informasi akun, keamanan, dan status verifikasi Anda.
        </p>
      </div>

      <section className="flex flex-col items-center gap-5 rounded-lg bg-card p-6 ring-1 ring-foreground/10 sm:flex-row sm:items-start sm:p-7">
        <Avatar className="size-16 shrink-0 sm:size-20">
          {user.image ? <AvatarImage src={user.image} alt={user.name} /> : null}
          <AvatarFallback className="text-xl sm:text-2xl">{initialsOf(user.name)}</AvatarFallback>
        </Avatar>

        <div className="flex min-w-0 flex-1 flex-col gap-3 text-center sm:text-left">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-balance break-words">{user.name}</h1>
            <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground sm:justify-start">
              <MailIcon className="size-4 shrink-0" />
              <span className="truncate">{user.email}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
            <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>
              <ShieldCheckIcon />
              {roleLabel}
            </Badge>
            <Badge variant={user.isActive ? 'outline' : 'destructive'}>
              {user.isActive ? <CircleCheckIcon /> : <XCircleIcon />}
              {statusLabel}
            </Badge>
          </div>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="size-4 text-muted-foreground" />
              Informasi akun
            </CardTitle>
            <CardDescription>Data akun yang tersimpan untuk Anda.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              <InfoRow icon={<MailIcon className="size-4" />} label="Email" value={user.email} />
              <InfoRow
                icon={<ShieldCheckIcon className="size-4" />}
                label="Role"
                value={roleLabel}
              />
              <InfoRow
                icon={
                  user.isActive ? (
                    <CircleCheckIcon className="size-4" />
                  ) : (
                    <XCircleIcon className="size-4" />
                  )
                }
                label="Status akun"
                value={statusLabel}
              />
              <InfoRow
                icon={<CalendarDaysIcon className="size-4" />}
                label="Bergabung"
                value={formatDate(user.createdAt)}
              />
              <InfoRow
                icon={<HistoryIcon className="size-4" />}
                label="Login terakhir"
                value={user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Belum pernah masuk'}
              />
              <InfoRow
                icon={<ClockIcon className="size-4" />}
                label="Diperbarui"
                value={formatDate(user.updatedAt)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRoundIcon className="size-4 text-muted-foreground" />
              Keamanan
            </CardTitle>
            <CardDescription>Verifikasi email dan perlindungan akun.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 rounded-md border border-border p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-muted-foreground">
                  {user.emailVerified ? (
                    <BadgeCheckIcon className="size-4" />
                  ) : (
                    <TriangleAlertIcon className="size-4" />
                  )}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium">
                    {user.emailVerified ? 'Email terverifikasi' : 'Email belum terverifikasi'}
                  </span>
                  <span className="text-xs/relaxed text-muted-foreground">
                    {user.emailVerified
                      ? 'Tautan konfirmasi sudah dikonfirmasi untuk akun ini.'
                      : 'Kami akan mengirimkan pesan berisi tautan konfirmasi ke email Anda.'}
                  </span>
                </div>
              </div>
              {resendVerification}
            </div>

            <div className="flex flex-col gap-2">
              <Button variant="outline" className="w-full justify-start" asChild>
                <a href={passwordChangeHref}>Ganti password</a>
              </Button>
              {onLogout ? (
                <Button variant="destructive" className="w-full justify-start" onClick={onLogout}>
                  <LogOutIcon />
                  Keluar dari akun
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
