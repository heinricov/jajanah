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

describe('ApiClient auth endpoints', () => {
  const authUser = {
    id: '3f1d3f2e-1c5a-4b7e-9d2a-8f6b5c4e3a21',
    name: 'Budi',
    email: 'budi@example.com',
    role: 'USER',
    lastLoginAt: null,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const loginData = {
    token: 'header.payload.signature',
    expiresAt: '2026-09-03T00:00:00.000Z',
    user: authUser,
  };

  it('register — POST body dan unwrap envelope AuthUser', async () => {
    const fetchMock = jest.fn(async () => jsonResponse({ data: authUser }));
    const client = makeClient(fetchMock);

    const user = await client.register({
      name: 'Budi',
      email: 'budi@example.com',
      password: 'password123',
    });

    expect(user.email).toBe('budi@example.com');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/auth/register',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: 'Budi',
          email: 'budi@example.com',
          password: 'password123',
        }),
      }),
    );
  });

  it('login — mengembalikan token + user tervalidasi schema', async () => {
    const fetchMock = jest.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ data: loginData }),
    );
    const client = makeClient(fetchMock);

    const result = await client.login({ email: 'budi@example.com', password: 'password123' });

    expect(result.token).toBe(loginData.token);
    expect(result.user.id).toBe(authUser.id);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://api.test/auth/login');
  });

  it('login — error 401 INVALID_CREDENTIALS menjadi ApiHttpError terketik', async () => {
    const errorBody = {
      error: { status: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
    };
    const fetchMock = jest.fn(async () => jsonResponse(errorBody, 401));
    const client = makeClient(fetchMock);

    const error = await client
      .login({ email: 'budi@example.com', password: 'salah123' })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiHttpError);
    expect((error as ApiHttpError).code).toBe('INVALID_CREDENTIALS');
    expect((error as ApiHttpError).status).toBe(401);
  });

  it('me — membawa header Authorization Bearer', async () => {
    const fetchMock = jest.fn(async () => jsonResponse({ data: authUser }));
    const client = makeClient(fetchMock);

    await client.me('token-aktif');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/auth/me',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ authorization: 'Bearer token-aktif' }),
      }),
    );
  });

  it('logout — POST dengan Bearer token dan mengembalikan null', async () => {
    const fetchMock = jest.fn(async () => jsonResponse({ data: null }));
    const client = makeClient(fetchMock);

    const result = await client.logout('token-aktif');

    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/auth/logout',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ authorization: 'Bearer token-aktif' }),
      }),
    );
  });
});
