import { AsyncLocalStorage } from 'node:async_hooks';

import type { LogContext } from './types';

const storage = new AsyncLocalStorage<LogContext>();

export function runWithContext<T>(context: LogContext, fn: () => T): T {
  const parent = storage.getStore();
  return storage.run({ ...parent, ...context }, fn);
}

export function getContext(): LogContext {
  return storage.getStore() ?? {};
}

export function updateContext(patch: LogContext): void {
  const store = storage.getStore();
  if (store) {
    Object.assign(store, patch);
  }
}
