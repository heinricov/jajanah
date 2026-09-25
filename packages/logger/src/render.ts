import type { LogFields, LogFormat, LogLevel } from './types';

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\u001b[90m',
  info: '\u001b[36m',
  warn: '\u001b[33m',
  error: '\u001b[31m',
};

const RESET = '\u001b[0m';
const DIM = '\u001b[2m';

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

function clock(time: Date): string {
  return `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}.${pad(
    time.getMilliseconds(),
    3,
  )}`;
}

function encode(value: unknown): string {
  if (value instanceof Error) {
    return JSON.stringify({ name: value.name, message: value.message, stack: value.stack });
  }
  if (typeof value === 'string' && !/[\s"=]/.test(value)) {
    return value;
  }
  return JSON.stringify(value) ?? String(value);
}

function toJson(time: Date, level: LogLevel, message: string, fields: LogFields): string {
  return JSON.stringify(
    { time: time.toISOString(), level, msg: message, ...fields },
    (_key, value: unknown) =>
      value instanceof Error
        ? { name: value.name, message: value.message, stack: value.stack }
        : value,
  );
}

function toPretty(
  time: Date,
  level: LogLevel,
  message: string,
  fields: LogFields,
  color: boolean,
): string {
  const stamp = color ? `${DIM}${clock(time)}${RESET}` : clock(time);
  const label = level.toUpperCase().padEnd(5);
  const badge = color ? `${LEVEL_COLORS[level]}${label}${RESET}` : label;
  const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
  const pairs = entries.map(([key, value]) => `${key}=${encode(value)}`);
  const tail = pairs.length > 0 ? ` ${pairs.join(' ')}` : '';
  return `${stamp} ${badge} ${message}${tail}`;
}

export function render(
  time: Date,
  level: LogLevel,
  message: string,
  fields: LogFields,
  format: LogFormat,
  color: boolean,
): string {
  return format === 'json'
    ? toJson(time, level, message, fields)
    : toPretty(time, level, message, fields, color);
}
