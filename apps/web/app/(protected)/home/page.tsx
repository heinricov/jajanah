import { requireAuth } from '@packages/auth/next/server';

export default async function HomePage() {
  const user = await requireAuth();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center gap-3 p-6">
      <h1 className="text-2xl font-semibold">Halo, {user.name}</h1>
      <p className="text-sm text-muted-foreground">
        Kamu masuk sebagai <span className="font-medium text-foreground">{user.role}</span> (
        {user.email}).
      </p>
      <p className="text-sm text-muted-foreground">ini halaman untuk user dan admin</p>
    </main>
  );
}
