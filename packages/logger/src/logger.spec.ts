import { runWithContext } from './als';
import { createLogger, normalizeLogFormat, normalizeLogLevel } from './logger';

function capture(options: Parameters<typeof createLogger>[0] = {}) {
  const lines: string[] = [];
  const logger = createLogger({ write: (line) => lines.push(line), ...options });
  return { lines, logger };
}

describe('createLogger', () => {
  it('menyaring level di bawah threshold', () => {
    const { lines, logger } = capture({ level: 'info' });
    logger.debug('hidden');
    logger.info('shown');
    logger.warn('also');
    expect(lines).toHaveLength(2);
  });

  it('menghasilkan JSON satu baris dengan time/level/msg', () => {
    const { lines, logger } = capture({ format: 'json' });
    logger.info('hello');
    const entry = JSON.parse(lines[0] as string);
    expect(entry).toMatchObject({ level: 'info', msg: 'hello' });
    expect(new Date(entry.time).getTime()).not.toBeNaN();
  });

  it('otomatis membawa context ALS (requestId, method, path)', () => {
    const { lines, logger } = capture({ format: 'json' });
    runWithContext({ requestId: 'req-1', method: 'GET', path: '/status' }, () => {
      logger.info('in request');
    });
    expect(JSON.parse(lines[0] as string)).toMatchObject({
      msg: 'in request',
      requestId: 'req-1',
      method: 'GET',
      path: '/status',
    });
  });

  it('di luar konteks tidak ada field context', () => {
    const { lines, logger } = capture({ format: 'json' });
    logger.info('standalone');
    const entry = JSON.parse(lines[0] as string);
    expect(entry.requestId).toBeUndefined();
    expect(entry.method).toBeUndefined();
  });

  it('fields eksplisit menimpa context', () => {
    const { lines, logger } = capture({ format: 'json' });
    runWithContext({ method: 'GET' }, () => {
      logger.info('overridden', { method: 'POST' });
    });
    expect(JSON.parse(lines[0] as string).method).toBe('POST');
  });

  it('redaksi key sensitif (case-insensitive, bersarang)', () => {
    const { lines, logger } = capture({ format: 'json' });
    logger.info('secrets', {
      password: 'a',
      Authorization: 'b',
      nested: { token: 'c', list: [{ cookie: 'd' }] },
      keep: 'ok',
    });
    expect(JSON.parse(lines[0] as string)).toMatchObject({
      password: '[REDACTED]',
      Authorization: '[REDACTED]',
      nested: { token: '[REDACTED]', list: [{ cookie: '[REDACTED]' }] },
      keep: 'ok',
    });
  });

  it('Error di-serialize jadi { name, message, stack }', () => {
    const { lines, logger } = capture({ format: 'json' });
    logger.error('boom', { error: new Error('gagal') });
    const entry = JSON.parse(lines[0] as string);
    expect(entry.error).toMatchObject({ name: 'Error', message: 'gagal' });
    expect(entry.error.stack).toContain('Error: gagal');
  });

  it('format pretty tanpa warna mudah dibaca', () => {
    const { lines, logger } = capture({ format: 'pretty', color: false });
    runWithContext({ requestId: 'req-1' }, () => {
      logger.warn('hati-hati', { statusCode: 404 });
    });
    expect(lines[0]).toMatch(
      /^\d{2}:\d{2}:\d{2}\.\d{3}\s+WARN\s+hati-hati requestId=req-1 statusCode=404$/,
    );
  });

  it('child bindings ikut setiap log dan menimpa konteks lebih rendah', () => {
    const { lines, logger } = capture({ format: 'json' });
    const child = logger.child({ component: 'worker' });
    child.info('run');
    expect(JSON.parse(lines[0] as string)).toMatchObject({ component: 'worker' });
  });
});

describe('normalize helpers', () => {
  it('normalizeLogLevel valid diterima, selain itu fallback', () => {
    expect(normalizeLogLevel('debug', 'info')).toBe('debug');
    expect(normalizeLogLevel('trace', 'info')).toBe('info');
    expect(normalizeLogLevel(undefined, 'warn')).toBe('warn');
  });

  it('normalizeLogFormat valid diterima, selain itu fallback', () => {
    expect(normalizeLogFormat('pretty', 'json')).toBe('pretty');
    expect(normalizeLogFormat('xml', 'json')).toBe('json');
    expect(normalizeLogFormat(undefined, 'pretty')).toBe('pretty');
  });
});
