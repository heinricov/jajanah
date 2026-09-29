/** Error dari server action auth (`loginAction`/`registerAction`/…) yang dieksekusi di browser. */
export class AuthActionError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(message: string, options: { status: number; code?: string }) {
    super(message);
    this.name = new.target.name;
    this.status = options.status;
    this.code = options.code;
  }
}

const FRIENDLY_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'Email atau password salah.',
  EMAIL_TAKEN: 'Email sudah terdaftar. Silakan masuk atau gunakan email lain.',
  EMAIL_NOT_VERIFIED: 'Email Anda belum diverifikasi. Buka tautan konfirmasi di kotak masuk Anda.',
  INVALID_VERIFY_TOKEN:
    'Tautan konfirmasi tidak valid atau sudah kedaluwarsa. Kirim ulang email konfirmasi.',
  INVALID_RESET_TOKEN:
    'Tautan reset password tidak valid atau sudah kedaluwarsa. Minta tautan baru.',
  UNAUTHORIZED: 'Sesi Anda berakhir. Silakan masuk kembali.',
  FORBIDDEN: 'Anda tidak punya akses ke halaman ini.',
  VALIDATION: 'Periksa kembali isian Anda.',
  BAD_REQUEST: 'Permintaan tidak valid.',
  TRANSPORT: 'Tidak dapat terhubung ke server. Coba lagi nanti.',
  INTERNAL: 'Terjadi kesalahan di server. Coba lagi nanti.',
};

/** Terjemahkan error server action ke pesan ramah untuk UI. */
export function authErrorMessage(
  error: unknown,
  fallback = 'Terjadi kesalahan. Coba lagi.',
): string {
  if (error instanceof AuthActionError) {
    const { code, message } = error;
    const friendly = code !== undefined ? FRIENDLY_MESSAGES[code] : undefined;
    if (friendly !== undefined) {
      return friendly;
    }
    return message || fallback;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}
