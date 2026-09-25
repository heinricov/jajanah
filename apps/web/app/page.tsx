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

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center gap-6 p-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">jajanah</h1>
        <Badge variant="secondary">web</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Selamat datang</CardTitle>
          <CardDescription>
            Halaman contoh dari apps/web dengan komponen @packages/ui.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Input placeholder="Cari sesuatu…" />
          <div className="flex gap-2">
            <Button>Mulai</Button>
            <Button variant="outline">Pelajari lebih lanjut</Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        NEXT_PUBLIC_APP_NAME = {process.env.NEXT_PUBLIC_APP_NAME ?? '(belum di-set)'}
      </p>
    </main>
  );
}
