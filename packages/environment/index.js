import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'dotenv';
import { expand } from 'dotenv-expand';

export function findRepoRoot(startDir = process.cwd()) {
  let dir = path.resolve(startDir);

  for (;;) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return path.resolve(startDir);
    }
    dir = parent;
  }
}

function envFiles(mode, root) {
  const files = [path.join(root, '.env'), path.join(root, `.env.${mode}`)];

  if (mode !== 'test') {
    files.push(path.join(root, '.env.local'));
  }
  files.push(path.join(root, `.env.${mode}.local`));

  return files;
}

export function loadEnvironment({
  mode = process.env.NODE_ENV || 'development',
  root = findRepoRoot(),
} = {}) {
  const values = {};

  for (const file of envFiles(mode, root)) {
    if (fs.existsSync(file)) {
      Object.assign(values, parse(fs.readFileSync(file)));
    }
  }

  const { parsed = values } = expand({ parsed: values }) ?? {};

  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  return Object.freeze({ ...parsed });
}

export function getEnv(name, fallback) {
  const value = process.env[name];
  return value === undefined ? fallback : value;
}

export function requireEnv(name) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(
      `[environment] Missing required environment variable "${name}". Define it in a root .env file (see .env.example).`,
    );
  }
  return value;
}

export const environment = new Proxy(Object.create(null), {
  get: (_target, key) => (typeof key === 'string' ? process.env[key] : undefined),
  has: (_target, key) => typeof key === 'string' && key in process.env,
  ownKeys: () => Reflect.ownKeys(process.env),
  getOwnPropertyDescriptor: (_target, key) => {
    if (typeof key === 'string' && key in process.env) {
      return { value: process.env[key], writable: false, enumerable: true, configurable: true };
    }
    return undefined;
  },
});

loadEnvironment();
