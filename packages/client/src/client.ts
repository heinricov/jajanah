import {
  apiErrorEnvelopeSchema,
  healthResponseSchema,
  paginationParamsSchema,
  type HealthResponse,
  type PaginationParams,
} from '@packages/validators';
import { z } from 'zod';

import { ApiHttpError, ApiTransportError, ApiValidationError } from './errors';

const DEFAULT_BASE_URL = 'http://localhost:3002';

export interface ApiClientOptions {
  /** Override base URL; default: `NEXT_PUBLIC_API_URL` lalu fallback `http://localhost:3002`. */
  baseUrl?: string;
  /** Override implementasi fetch (untuk tes/proxy). */
  fetch?: typeof globalThis.fetch;
}

export interface RequestOptions {
  query?: PaginationParams;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
}

function resolveBaseUrl(explicit?: string): string {
  const raw = explicit ?? process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_BASE_URL;
  return raw.replace(/\/+$/, '');
}

function buildUrl(baseUrl: string, path: string, query?: PaginationParams): string {
  const url = new URL(path.replace(/^\//, ''), `${baseUrl}/`);

  if (query !== undefined) {
    let validated: PaginationParams;
    try {
      validated = paginationParamsSchema.parse(query);
    } catch (cause) {
      throw new ApiValidationError('Query parameters failed validation', query, { cause });
    }

    if (validated.page !== undefined) url.searchParams.set('page', String(validated.page));
    if (validated.limit !== undefined) url.searchParams.set('limit', String(validated.limit));
  }

  return url.toString();
}

function hasDataEnvelope(body: unknown): body is { data: unknown } {
  return typeof body === 'object' && body !== null && 'data' in body;
}

export class ApiClient {
  readonly baseUrl: string;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = resolveBaseUrl(options.baseUrl);
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  /** GET / — status layanan (terkontrak `healthResponseSchema`). */
  getHealth(): Promise<HealthResponse> {
    return this.request('/', healthResponseSchema);
  }

  /**
   * Inti request: kirim, unwrap envelope `{ data }`, validasi respons dengan `schema`,
   * dan lempar error terketik bila tidak valid / non-2xx / gagal jaringan.
   */
  async request<T>(path: string, schema: z.ZodType<T>, options: RequestOptions = {}): Promise<T> {
    const url = buildUrl(this.baseUrl, path, options.query);

    const init: RequestInit = {
      method: options.method ?? 'GET',
      headers: {
        accept: 'application/json',
        ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...options.headers,
      },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      ...(options.signal !== undefined ? { signal: options.signal } : {}),
    };

    let response: Response;
    try {
      response = await this.fetchImpl(url, init);
    } catch (cause) {
      throw new ApiTransportError(`Request to ${url} failed`, { cause });
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch (cause) {
      if (response.ok) {
        throw new ApiValidationError('Response body is not valid JSON', undefined, { cause });
      }
      throw new ApiTransportError(`API responded ${response.status} with a non-JSON body`, {
        cause,
      });
    }

    if (!response.ok) {
      const parsedError = apiErrorEnvelopeSchema.safeParse(body);
      if (parsedError.success) {
        throw new ApiHttpError(parsedError.data.error);
      }
      throw new ApiHttpError({
        status: response.status,
        code: 'INTERNAL',
        message: `API responded ${response.status} with an unexpected error body`,
        details: body,
      });
    }

    if (!hasDataEnvelope(body)) {
      throw new ApiValidationError('Response does not match the { data } envelope', body);
    }

    const parsed = schema.safeParse(body.data);
    if (!parsed.success) {
      throw new ApiValidationError('Response data failed schema validation', body.data, {
        cause: parsed.error,
      });
    }

    return parsed.data;
  }
}

export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  return new ApiClient(options);
}

export const apiClient: ApiClient = new ApiClient();
