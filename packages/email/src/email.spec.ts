import { emailService, sendConfirmationEmail, type FetchLike } from './index';

const INPUT = {
  to: 'budi@example.com',
  name: 'Budi <script>alert(1)</script>',
  link: 'http://localhost:3000/auth/verify-email?token=abc-123',
};

function makeResponse(overrides: Partial<Awaited<ReturnType<FetchLike>>> = {}) {
  return {
    ok: true,
    status: 200,
    text: jest.fn().mockResolvedValue(''),
    ...overrides,
  };
}

describe('sendConfirmationEmail', () => {
  const originalKey = process.env.RESEND_API_KEY;
  const originalFrom = process.env.MAIL_FROM;

  beforeEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.MAIL_FROM;
  });

  afterAll(() => {
    process.env.RESEND_API_KEY = originalKey;
    process.env.MAIL_FROM = originalFrom;
  });

  it('tanpa RESEND_API_KEY: fallback console (delivered:false) & fetch tidak dipanggil', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const fetchImpl = jest.fn<ReturnType<FetchLike>, Parameters<FetchLike>>();

    const result = await sendConfirmationEmail(INPUT, { fetchImpl });

    expect(result).toEqual({ delivered: false, reason: 'no_api_key' });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining(INPUT.link));
    log.mockRestore();
  });

  it('dengan RESEND_API_KEY: POST ke Resend dengan payload lengkap', async () => {
    process.env.RESEND_API_KEY = 're_test_123';
    process.env.MAIL_FROM = 'Jajanah <no-reply@jajanah.test>';
    const response = makeResponse();
    const fetchImpl = jest.fn().mockResolvedValue(response);

    const result = await sendConfirmationEmail(INPUT, { fetchImpl });

    expect(result).toEqual({ delivered: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer re_test_123',
      'Content-Type': 'application/json',
    });

    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.from).toBe('Jajanah <no-reply@jajanah.test>');
    expect(body.to).toEqual([INPUT.to]);
    expect(body.subject).toContain('Konfirmasi email');
    expect(body.html).toContain(INPUT.link);
    expect(body.text).toContain(INPUT.link);
    expect(body.html).not.toContain('<script>');
  });

  it('tanpa MAIL_FROM: memakai alamat default Resend', async () => {
    process.env.RESEND_API_KEY = 're_test';
    const fetchImpl = jest.fn().mockResolvedValue(makeResponse());

    await sendConfirmationEmail(INPUT, { fetchImpl });

    const body = JSON.parse(fetchImpl.mock.calls[0][1].body) as Record<string, unknown>;
    expect(body.from).toBe('Jajanah <onboarding@resend.dev>');
  });

  it('Resend merespons error → throw dengan status HTTP', async () => {
    process.env.RESEND_API_KEY = 're_test';
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        makeResponse({ ok: false, status: 422, text: jest.fn().mockResolvedValue('invalid from') }),
      );

    await expect(sendConfirmationEmail(INPUT, { fetchImpl })).rejects.toThrow('HTTP 422');
  });

  it('emailService.sendConfirmation adalah alias fungsi yang sama', () => {
    expect(emailService.sendConfirmation).toBe(sendConfirmationEmail);
  });
});
