import type { LoggerService } from '@nestjs/common';

import type { Logger } from './logger';
import type { LogFields } from './types';

function stringify(message: unknown): string {
  if (typeof message === 'string') {
    return message;
  }
  if (message instanceof Error) {
    return message.message;
  }
  return String(message);
}

function baseFields(message: unknown, optionalParams: unknown[]): LogFields {
  const fields: LogFields = {};
  if (message instanceof Error) {
    fields['error'] = message;
  }
  const strings = optionalParams.filter(
    (param): param is string => typeof param === 'string' && !param.includes('\n'),
  );
  const context = strings.at(-1);
  if (context) {
    fields['context'] = context;
  }
  return fields;
}

export class NestLoggerService implements LoggerService {
  constructor(private readonly logger: Logger) {}

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.info(stringify(message), baseFields(message, optionalParams));
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    const fields = baseFields(message, optionalParams);
    const trace = optionalParams.find(
      (param): param is string => typeof param === 'string' && param.includes('\n'),
    );
    if (trace) {
      fields['trace'] = trace;
    }
    this.logger.error(stringify(message), fields);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.warn(stringify(message), baseFields(message, optionalParams));
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.debug(stringify(message), baseFields(message, optionalParams));
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.debug(stringify(message), baseFields(message, optionalParams));
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.error(stringify(message), baseFields(message, optionalParams));
  }
}
