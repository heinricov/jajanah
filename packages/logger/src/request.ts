import { randomUUID } from 'node:crypto';

import { runWithContext } from './als';
import type { Logger } from './logger';
import type { LogContext } from './types';

export const REQUEST_ID_HEADER = 'x-request-id';

export interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  method?: string;
  originalUrl?: string;
  url?: string;
}

export interface ResponseLike {
  setHeader(name: string, value: string): unknown;
  readonly statusCode?: number;
  on(event: 'finish' | 'error', listener: (error?: Error) => void): unknown;
}

export type NextFunction = (error?: unknown) => void;

export interface RequestLoggerOptions {
  logger: Logger;
  header?: string;
}

export type RequestLogger = (req: RequestLike, res: ResponseLike, next: NextFunction) => void;

export function createRequestLogger(options: RequestLoggerOptions): RequestLogger {
  const { logger, header = REQUEST_ID_HEADER } = options;

  return function requestLogger(req, res, next) {
    const raw = req.headers[header];
    const incoming = Array.isArray(raw) ? raw[0] : raw;
    const requestId = incoming?.trim() || randomUUID();
    res.setHeader(header, requestId);

    const start = Date.now();
    const context: LogContext = {
      requestId,
      method: req.method ?? 'UNKNOWN',
      path: req.originalUrl ?? req.url ?? '/',
    };

    const logLevel = (statusCode: number): 'error' | 'warn' | 'info' =>
      statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    res.on('finish', () => {
      const statusCode = res.statusCode ?? 200;
      logger[logLevel(statusCode)]('request completed', {
        ...context,
        statusCode,
        durationMs: Date.now() - start,
      });
    });
    res.on('error', (error) => {
      logger.error('request failed', { ...context, error });
    });

    runWithContext(context, () => {
      next();
    });
  };
}
