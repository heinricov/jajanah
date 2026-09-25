import { getContext } from './als';
import { DEFAULT_REDACT_KEYS, redact } from './redact';
import { render } from './render';
import type { LogFields, LogFormat, LogLevel, LoggerOptions } from './types';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface Logger {
  readonly level: LogLevel;
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  child(bindings: LogFields): Logger;
}

export function normalizeLogLevel(value: string | undefined, fallback: LogLevel): LogLevel {
  return value === 'debug' || value === 'info' || value === 'warn' || value === 'error'
    ? value
    : fallback;
}

export function normalizeLogFormat(value: string | undefined, fallback: LogFormat): LogFormat {
  return value === 'json' || value === 'pretty' ? value : fallback;
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const level = options.level ?? 'info';
  const format = options.format ?? 'json';
  const redactKeys = options.redactKeys ?? [...DEFAULT_REDACT_KEYS];
  const color = options.color ?? process.stdout.isTTY === true;
  const write = options.write ?? ((line: string) => process.stdout.write(`${line}\n`));
  const threshold = LEVEL_ORDER[level];

  function make(bindings: LogFields): Logger {
    const emit = (entryLevel: LogLevel) => (message: string, fields?: LogFields) => {
      if (LEVEL_ORDER[entryLevel] < threshold) {
        return;
      }
      const merged = { ...bindings, ...getContext(), ...fields };
      const safe = redact(merged, redactKeys) as LogFields;
      write(render(new Date(), entryLevel, message, safe, format, color));
    };

    return {
      level,
      debug: emit('debug'),
      info: emit('info'),
      warn: emit('warn'),
      error: emit('error'),
      child: (extra) => make({ ...bindings, ...extra }),
    };
  }

  return make({});
}
