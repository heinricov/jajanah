import { getEnv } from '@packages/environment';
import {
  createLogger,
  NestLoggerService,
  normalizeLogFormat,
  normalizeLogLevel,
} from '@packages/logger';

const isProduction = process.env.NODE_ENV === 'production';

export const logger = createLogger({
  level: normalizeLogLevel(getEnv('LOG_LEVEL'), isProduction ? 'info' : 'debug'),
  format: normalizeLogFormat(getEnv('LOG_FORMAT'), isProduction ? 'json' : 'pretty'),
});

export const nestLogger = new NestLoggerService(logger);
