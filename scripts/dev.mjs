import { spawn } from 'node:child_process';

const env = process.env;
const program = (env.TERM_PROGRAM ?? '').toLowerCase();
const inEditorTerminal =
  program.includes('vscode') ||
  program.includes('cursor') ||
  Boolean(env.VSCODE_PID ?? env.VSCODE_INJECTION);

if (inEditorTerminal) {
  process.stdout.write(
    [
      'VS Code/Cursor terdeteksi — log ketiga app TERCAMPUR di stream ini.',
      '',
      'Untuk tab terpisah (bisa diklik pindah):',
      '  - Buka project ini -> task "dev: all apps (3 tab)" jalan otomatis',
      '    (izinkan sekali saat ditanya "Allow automatic tasks in folder?").',
      '  - Atau jalankan manual: Cmd+Shift+B / Terminal > Run Task...',
      '  - Per app: pnpm dev:web | pnpm dev:admin | pnpm dev:api',
      '',
      'Catatan: jika tab task sudah berjalan, jangan jalankan pnpm dev lagi',
      'di sini (port 3000/3001/3002 akan bentrok).',
      '------------------------------------------------------------',
      '',
    ].join('\n'),
  );
}

const child = spawn('pnpm exec turbo run dev', { stdio: 'inherit', shell: true });

child.on('error', (error) => {
  console.error(`Gagal menjalankan turbo: ${error.message}`);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
