jest.mock('@packages/db', () => ({ prisma: {} }));

import {
  ArgumentsHost,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthError } from '@packages/auth';
import type { ApiErrorEnvelope } from '@packages/validators';

import { AllExceptionsFilter, toApiErrorEnvelope } from './all-exceptions.filter';

function envelopeOf(exception: unknown): ApiErrorEnvelope {
  return toApiErrorEnvelope(exception);
}

describe('toApiErrorEnvelope', () => {
  it('menerjemahkan AuthError EMAIL_TAKEN ke 409', () => {
    const envelope = envelopeOf(new AuthError('EMAIL_TAKEN', 'Email is already registered'));

    expect(envelope.error).toEqual({
      status: 409,
      code: 'EMAIL_TAKEN',
      message: 'Email is already registered',
    });
  });

  it('menerjemahkan AuthError INVALID_CREDENTIALS ke 401', () => {
    const envelope = envelopeOf(new AuthError('INVALID_CREDENTIALS', 'Invalid email or password'));

    expect(envelope.error.status).toBe(401);
    expect(envelope.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('menerjemahkan AuthError UNAUTHORIZED ke 401', () => {
    const envelope = envelopeOf(new AuthError('UNAUTHORIZED', 'Invalid or expired session token'));

    expect(envelope.error.status).toBe(401);
    expect(envelope.error.code).toBe('UNAUTHORIZED');
  });

  it('menerjemahkan HttpException Nest ke kode fallback per status', () => {
    expect(envelopeOf(new NotFoundException()).error).toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
    expect(envelopeOf(new BadRequestException('nope')).error).toMatchObject({
      status: 400,
      code: 'BAD_REQUEST',
      message: 'nope',
    });
  });

  it('menghormati code custom pada body HttpException', () => {
    const exception = new UnauthorizedException({
      code: 'UNAUTHORIZED',
      message: 'Missing bearer token',
    });

    expect(envelopeOf(exception).error).toEqual({
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Missing bearer token',
    });
  });

  it('merapikan error validasi ValidationPipe (message array) ke VALIDATION', () => {
    const exception = new BadRequestException({
      statusCode: 400,
      message: ['name must be longer than or equal to 2 characters'],
      error: 'Bad Request',
    });

    expect(envelopeOf(exception).error).toEqual({
      status: 400,
      code: 'VALIDATION',
      message: 'Validation failed',
      details: { messages: ['name must be longer than or equal to 2 characters'] },
    });
  });

  it('error tak terduga → 500 INTERNAL tanpa membocorkan pesan internal', () => {
    const envelope = envelopeOf(new Error('rahasia internal kaboom'));

    expect(envelope.error).toEqual({
      status: 500,
      code: 'INTERNAL',
      message: 'Internal server error',
    });
    expect(JSON.stringify(envelope)).not.toContain('kaboom');
  });
});

describe('AllExceptionsFilter', () => {
  it('menulis envelope ke response dengan status yang benar', () => {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({ getResponse: () => ({ status }) }),
    } as unknown as ArgumentsHost;

    new AllExceptionsFilter().catch(
      new AuthError('EMAIL_TAKEN', 'Email is already registered'),
      host,
    );

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'EMAIL_TAKEN' }) }),
    );
  });
});
