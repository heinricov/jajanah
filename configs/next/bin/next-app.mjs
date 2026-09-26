#!/usr/bin/env node
import { spawn } from 'node:child_process';

import { getEnv } from '@packages/environment';

const [key, command = 'dev', defaultPort] = process.argv.slice(2);

const DEFAULT_PORTS = { WEB_PORT: '3000', ADMIN_PORT: '3001', API_PORT: '3002' };

if (!key) {
  console.error('Usage: next-app <ENV_KEY> [dev|start] [defaultPort]');
  process.exit(1);
}

if (command !== 'dev' && command !== 'start') {
  console.error(`next-app: unsupported command "${command}" (expected dev or start)`);
  process.exit(1);
}

process.env.PORT = getEnv(key) || defaultPort || DEFAULT_PORTS[key] || '3000';

const child = spawn(`next ${command}`, { shell: true, stdio: 'inherit' });

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

child.on('exit', (code, signal) => {
  process.exit(signal ? 1 : (code ?? 0));
});
