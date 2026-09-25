import { getContext } from './als';
import { createLogger } from './logger';
import { createRequestLogger, type RequestLike } from './request';

function capture() {
  const lines: string[] = [];
  const logger = createLogger({ format: 'json', write: (line) => lines.push(line) });
  return { lines, logger };
}

function fakeResponse(statusCode = 200) {
  const headers: Record<string, string> = {};
  const listeners = new Map<string, Array<(error?: Error) => void>>();
  const res = {
    statusCode,
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
    on(event: string, listener: (error?: Error) => void) {
      listeners.set(event, [...(listeners.get(event) ?? []), listener]);
    },
    emit(event: string, error?: Error) {
      for (const listener of listeners.get(event) ?? []) listener(error);
    },
  };
  return { res, headers, emit: res.emit };
}

function fakeRequest(overrides: Partial<RequestLike> = {}): RequestLike {
  return { headers: {}, method: 'GET', originalUrl: '/status?page=2', ...overrides };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('createRequestLogger', () => {
  it('generate requestId baru bila tidak ada header, kirim di response', () => {
    const { logger } = capture();
    const { res, headers } = fakeResponse();
    createRequestLogger({ logger })(fakeRequest(), res, () => undefined);

    expect(headers['x-request-id']).toMatch(UUID_PATTERN);
  });

  it('menghormati x-request-id yang masuk dari client', () => {
    const { logger } = capture();
    const { res, headers } = fakeResponse();
    const req = fakeRequest({ headers: { 'x-request-id': 'abc-123' } });
    createRequestLogger({ logger })(req, res, () => undefined);

    expect(headers['x-request-id']).toBe('abc-123');
  });

  it('membungkus next() dalam context (requestId, method, path terbaca di handler)', () => {
    const { logger } = capture();
    const { res } = fakeResponse();
    let seen: unknown;
    createRequestLogger({ logger })(fakeRequest(), res, () => {
      seen = getContext();
    });

    expect(seen).toEqual({
      requestId: expect.stringMatching(UUID_PATTERN),
      method: 'GET',
      path: '/status?page=2',
    });
  });

  it('log "request completed" saat finish dengan level sesuai status', () => {
    const { lines, logger } = capture();
    const middleware = createRequestLogger({ logger });
    const req = fakeRequest({ headers: { 'x-request-id': 'req-7' } });

    const ok = fakeResponse(200);
    middleware(req, ok.res, () => undefined);
    ok.emit('finish');

    const entry = JSON.parse(lines[0] as string);
    expect(entry).toMatchObject({
      level: 'info',
      msg: 'request completed',
      requestId: 'req-7',
      method: 'GET',
      path: '/status?page=2',
      statusCode: 200,
    });
    expect(entry.durationMs).toEqual(expect.any(Number));
  });

  it('status 4xx → warn, 5xx → error', () => {
    const { lines, logger } = capture();
    const middleware = createRequestLogger({ logger });

    const notFound = fakeResponse(404);
    middleware(fakeRequest(), notFound.res, () => undefined);
    notFound.emit('finish');

    const serverError = fakeResponse(500);
    middleware(fakeRequest(), serverError.res, () => undefined);
    serverError.emit('finish');

    expect(JSON.parse(lines[0] as string).level).toBe('warn');
    expect(JSON.parse(lines[1] as string).level).toBe('error');
  });

  it('log "request failed" saat response error', () => {
    const { lines, logger } = capture();
    const { res, emit } = fakeResponse();
    createRequestLogger({ logger })(fakeRequest(), res, () => undefined);
    emit('error', new Error('socket hang up'));

    const entry = JSON.parse(lines[0] as string);
    expect(entry).toMatchObject({ level: 'error', msg: 'request failed' });
    expect(entry.error).toMatchObject({ message: 'socket hang up' });
  });

  it('membaca url fallback ketika originalUrl tidak ada', () => {
    const { logger } = capture();
    const { res } = fakeResponse();
    let seen: unknown;
    createRequestLogger({ logger })({ headers: {}, method: 'POST', url: '/x' }, res, () => {
      seen = getContext();
    });

    expect(seen).toMatchObject({ method: 'POST', path: '/x' });
  });
});
