import '@packages/environment';

export const nextConfig = {
  reactStrictMode: true,
  // '@packages/auth' sengaja di-compile sebagai source (entry ./next): kode
  // server yang me-`require('next/headers'|'next/navigation'|'next/server')`
  // dari dist CJS kehilangan binding-nya saat dibundel Turbopack (ReferenceError
  // runtime) — jalur source ESM terbukti aman, sama seperti web-auth sebelumnya.
  transpilePackages: ['@packages/ui', '@packages/auth'],
};
