import { Badge } from '@packages/ui/components/badge';
import { Button } from '@packages/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@packages/ui/components/card';
import { Input } from '@packages/ui/components/input';

export default function AdminDashboardPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center gap-6 p-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">Panel Admin</h1>
        <Badge>admin</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ringkasan</CardTitle>
          <CardDescription>
            Halaman contoh dari apps/admin dengan komponen @packages/ui.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Input placeholder="Cari data…" />
          <div className="flex gap-2">
            <Button>Simpan</Button>
            <Button variant="destructive">Hapus</Button>
            <Button variant="ghost">Batal</Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        NEXT_PUBLIC_APP_NAME = {process.env.NEXT_PUBLIC_APP_NAME ?? '(belum di-set)'}
      </p>
    </main>
  );
}
