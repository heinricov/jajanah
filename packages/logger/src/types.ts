export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogFormat = 'json' | 'pretty';

export interface LogContext {
  requestId?: string;
  userId?: string;
  method?: string;
  path?: string;
  attemptNumber?: number;
}

export type LogFields = Record<string, unknown>;

export interface LoggerOptions {
  level?: LogLevel;
  format?: LogFormat;
  redactKeys?: string[];
  color?: boolean;
  write?: (line: string) => void;
}
