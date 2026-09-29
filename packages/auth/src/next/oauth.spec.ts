import { resolveGooglePicture, type PictureFetchLike } from './oauth';

jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('../domain/auth.service', () => ({ authService: { oauthLogin: jest.fn() } }));

const PICTURE = 'https://lh3.googleusercontent.com/a/photo';
const ACCESS_TOKEN = 'ya29.test-token';

function jsonFetch(body: unknown, ok = true): jest.MockedFunction<PictureFetchLike> {
  return jest.fn().mockResolvedValue({ ok, status: ok ? 200 : 500, json: async () => body });
}

describe('resolveGooglePicture', () => {
  it('pakai picture dari ID token — tanpa panggil userinfo', async () => {
    const fetchImpl = jsonFetch({});

    await expect(resolveGooglePicture(ACCESS_TOKEN, PICTURE, { fetchImpl })).resolves.toBe(PICTURE);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('picture kosong → GET userinfo dengan access_token sebagai Bearer', async () => {
    const fetchImpl = jsonFetch({ sub: 'google-sub-123', picture: PICTURE });

    await expect(resolveGooglePicture(ACCESS_TOKEN, undefined, { fetchImpl })).resolves.toBe(
      PICTURE,
    );
    expect(fetchImpl).toHaveBeenCalledWith('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    });
  });

  it('userinfo tanpa picture → null (foto memang tidak ada)', async () => {
    const fetchImpl = jsonFetch({ sub: 'google-sub-123' });

    await expect(resolveGooglePicture(ACCESS_TOKEN, null, { fetchImpl })).resolves.toBeNull();
  });

  it('userinfo bukan JSON objek → null', async () => {
    const fetchImpl = jsonFetch('oops');

    await expect(resolveGooglePicture(ACCESS_TOKEN, undefined, { fetchImpl })).resolves.toBeNull();
  });

  it('http non-2xx → undefined (nilai lama di DB dibiarkan)', async () => {
    const fetchImpl = jsonFetch({ error: 'invalid_grant' }, false);

    await expect(
      resolveGooglePicture(ACCESS_TOKEN, undefined, { fetchImpl }),
    ).resolves.toBeUndefined();
  });

  it('fetch gagal (jaringan) → undefined, tidak melempar', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('ECONNRESET'));

    await expect(
      resolveGooglePicture(ACCESS_TOKEN, undefined, { fetchImpl }),
    ).resolves.toBeUndefined();
  });

  it('tanpa picture maupun access_token → undefined tanpa fetch', async () => {
    const fetchImpl = jsonFetch({});

    await expect(resolveGooglePicture(null, undefined, { fetchImpl })).resolves.toBeUndefined();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('menggunakan fetch global bila deps tidak di-inject', async () => {
    const original = globalThis.fetch;
    const stub = jsonFetch({ picture: PICTURE });
    globalThis.fetch = stub as unknown as typeof fetch;

    try {
      await expect(resolveGooglePicture(ACCESS_TOKEN, undefined)).resolves.toBe(PICTURE);
      expect(stub).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = original;
    }
  });
});
