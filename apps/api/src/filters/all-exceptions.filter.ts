import { Catch, type ArgumentsHost, type ExceptionFilter, HttpException } from '@nestjs/common';
import type { Response } from 'express';
import { AuthError } from '@packages/auth';
import {
  API_ERROR_CODES,
  apiError,
  type ApiErrorCode,
  type ApiErrorEnvelope,
  type HttpStatusCode,
} from '@packages/validators';

import { logger } from '../logger';

function fallbackCode(status: number): ApiErrorCode {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    default:
      return status >= 400 && status < 500 ? 'BAD_REQUEST' : 'INTERNAL';
  }
}

function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === 'string' && (API_ERROR_CODES as readonly string[]).includes(value);
}

/**
 * Terjemahkan exception apa pun ke envelope `{ error }` SSOT —
 * AuthError domain, HttpException Nest (termasuk ValidationError dari
 * ValidationPipe), dan error tak terduga (tidak bocorkan detail internal).
 */
export function toApiErrorEnvelope(exception: unknown): ApiErrorEnvelope {
  if (exception instanceof AuthError) {
    return apiError(exception.status as HttpStatusCode, exception.code, exception.message);
  }

  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const response: unknown = exception.getResponse();

    if (Array.isArray(response)) {
      return apiError(status as HttpStatusCode, 'VALIDATION', 'Validation failed', {
        messages: response,
      });
    }

    if (typeof response === 'object' && response !== null) {
      const body = response as { code?: unknown; message?: unknown; details?: unknown };
      const code = isApiErrorCode(body.code) ? body.code : fallbackCode(status);

      if (Array.isArray(body.message)) {
        return apiError(status as HttpStatusCode, 'VALIDATION', 'Validation failed', {
          messages: body.message,
        });
      }

      const message =
        typeof body.message === 'string' && body.message.length > 0
          ? body.message
          : exception.message;

      return body.details !== undefined
        ? apiError(status as HttpStatusCode, code, message, body.details)
        : apiError(status as HttpStatusCode, code, message);
    }

    const message = typeof response === 'string' ? response : exception.message;
    return apiError(status as HttpStatusCode, fallbackCode(status), message);
  }

  return apiError(500, 'INTERNAL', 'Internal server error');
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const envelope = toApiErrorEnvelope(exception);
    const { status, code, message } = envelope.error;

    if (status >= 500) {
      logger.error(`request failed: ${message}`, {
        status,
        code,
        exception:
          exception instanceof Error ? (exception.stack ?? exception.message) : String(exception),
      });
    } else {
      logger.warn(`request rejected: ${message}`, { status, code });
    }

    const response = host.switchToHttp().getResponse<Response>();
    response.status(status).json(envelope);
  }
}
