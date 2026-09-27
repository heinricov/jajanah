import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

type ScryptOptions = { N: number; r: number; p: number };

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
) => Promise<Buffer>;

const ALGORITHM = 'scrypt';
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

/** Batas panjang password — harus selaras dengan Zod schema & DTO di `@packages/validators`. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** Guard agar parameter dari stored hash tidak bisa memaksa scrypt memboroskan resource. */
const MIN_N = 1024;
const MAX_N = 1 << 20;
const MAX_R = 32;
const MAX_P = 16;
const MAX_HASH_BYTES = 256;

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scrypt(plain, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });

  return [
    ALGORITHM,
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('base64url'),
    derived.toString('base64url'),
  ].join('$');
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6) return false;

  const [algorithm, nRaw, rRaw, pRaw, saltRaw, hashRaw] = parts;
  if (
    algorithm !== ALGORITHM ||
    nRaw === undefined ||
    rRaw === undefined ||
    pRaw === undefined ||
    saltRaw === undefined ||
    hashRaw === undefined
  ) {
    return false;
  }

  const N = Number(nRaw);
  const R = Number(rRaw);
  const P = Number(pRaw);
  if (!Number.isInteger(N) || !Number.isInteger(R) || !Number.isInteger(P)) return false;
  if (N < MIN_N || N > MAX_N || (N & (N - 1)) !== 0) return false;
  if (R < 1 || R > MAX_R || P < 1 || P > MAX_P) return false;

  const salt = Buffer.from(saltRaw, 'base64url');
  const expected = Buffer.from(hashRaw, 'base64url');
  if (salt.length === 0 || expected.length === 0 || expected.length > MAX_HASH_BYTES) {
    return false;
  }

  let derived: Buffer;
  try {
    derived = await scrypt(plain, salt, expected.length, { N, r: R, p: P });
  } catch {
    return false;
  }

  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
