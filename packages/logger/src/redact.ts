export const DEFAULT_REDACT_KEYS: readonly string[] = [
  'authorization',
  'password',
  'token',
  'cookie',
  'x-api-key',
];

const REDACTED = '[REDACTED]';

const MAX_DEPTH = 6;

export function redact(value: unknown, keys: readonly string[], depth = 0): unknown {
  if (depth > MAX_DEPTH) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redact(item, keys, depth + 1));
  }
  if (value instanceof Error) {
    return value;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const isSecret = keys.some((secret) => secret.toLowerCase() === key.toLowerCase());
      out[key] = isSecret ? REDACTED : redact(entry, keys, depth + 1);
    }
    return out;
  }
  return value;
}
