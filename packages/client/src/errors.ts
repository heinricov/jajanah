import type { ApiError } from '@packages/validators';

export class ApiClientError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class ApiTransportError extends ApiClientError {}

export class ApiHttpError extends ApiClientError {
  readonly status: number;
  readonly code: ApiError['code'];
  readonly details?: unknown;

  constructor(error: ApiError) {
    super(error.message);
    this.status = error.status;
    this.code = error.code;
    this.details = error.details;
  }
}

export class ApiValidationError extends ApiClientError {
  readonly data: unknown;

  constructor(message: string, data: unknown, options?: ErrorOptions) {
    super(message, options);
    this.data = data;
  }
}
