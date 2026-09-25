import { z } from 'zod';

import { createApiClient } from './client';
import { ApiHttpError, ApiTransportError, ApiValidationError } from './errors';

const healthData = {
  service: 'api',
  status: 'ok',
  mode: 'test',
  appName: 'jajanah',
  baseUrl: null,
};

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const makeClient = (fetchMock: unknown): ReturnType<typeof createApiClient> =>
  createApiClient({ baseUrl: 'http://api.test', fetch: fetchMock as typeof globalThis.fetch });

describe('ApiClient', () => {
  it('unwraps the { data } envelope and validates GET / health', async () => {
    const fetchMock = jest.fn(async () => jsonResponse({ data: healthData }));
    const client = makeClient(fetchMock);

    const health = await client.getHealth();

    expect(health).toEqual(healthData);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('throws ApiValidationError when response data fails the schema', async () => {
    const fetchMock = jest.fn(async () =>
      jsonResponse({ data: { service: 'api', status: 'down' } }),
    );
    const client = makeClient(fetchMock);

    await expect(client.getHealth()).rejects.toBeInstanceOf(ApiValidationError);
  });

  it('throws ApiValidationError when the envelope is missing', async () => {
    const fetchMock = jest.fn(async () => jsonResponse({ service: 'api' }));
    const client = makeClient(fetchMock);

    await expect(client.getHealth()).rejects.toBeInstanceOf(ApiValidationError);
  });

  it('throws typed ApiHttpError from an API error envelope', async () => {
    const errorBody = {
      error: {
        status: 400,
        code: 'VALIDATION',
        message: 'Validation failed',
        details: [{ field: 'page' }],
      },
    };
    const fetchMock = jest.fn(async () => jsonResponse(errorBody, 400));
    const client = makeClient(fetchMock);

    const error = await client.getHealth().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiHttpError);
    const httpError = error as ApiHttpError;
    expect(httpError.status).toBe(400);
    expect(httpError.code).toBe('VALIDATION');
    expect(httpError.message).toBe('Validation failed');
    expect(httpError.details).toEqual([{ field: 'page' }]);
  });

  it('maps unexpected non-2xx bodies to a generic ApiHttpError', async () => {
    const fetchMock = jest.fn(async () => jsonResponse({ oops: true }, 500));
    const client = makeClient(fetchMock);

    const error = await client.getHealth().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiHttpError);
    expect((error as ApiHttpError).status).toBe(500);
    expect((error as ApiHttpError).code).toBe('INTERNAL');
  });

  it('throws ApiTransportError when the network fails', async () => {
    const fetchMock = jest.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const client = makeClient(fetchMock);

    await expect(client.getHealth()).rejects.toBeInstanceOf(ApiTransportError);
  });

  it('builds validated query params onto the URL', async () => {
    const fetchMock = jest.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ data: [] }),
    );
    const client = makeClient(fetchMock);

    await client.request('/items', z.array(z.unknown()), { query: { page: 2, limit: 10 } });

    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://api.test/items?page=2&limit=10');
  });

  it('rejects invalid query params before fetching', async () => {
    const fetchMock = jest.fn(async () => jsonResponse({ data: [] }));
    const client = makeClient(fetchMock);

    await expect(
      client.request('/items', z.array(z.unknown()), { query: { page: 0 } }),
    ).rejects.toBeInstanceOf(ApiValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
