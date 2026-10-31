/**
 * Pemetaan galat WebAuthn/Supabase Auth menjadi pesan yang menjelaskan langkah
 * berikutnya, bukan hanya menayangkan pesan mentah dari browser atau server.
 */

/** Bentuk error minimal yang dibaca pemetaan ini (duck typing). */
type ErrorLike = {
  code?: unknown;
  name?: unknown;
  message?: unknown;
};

const GENERIC_MESSAGE =
  "Passkey tidak dapat dipakai saat ini. Masuk dengan email/password seperti biasa.";

/**
 * Pesan per kode error. Kode `ERROR_*` berasal dari WebAuthnError di
 * `@supabase/auth-js`, sisanya kode error server GoTrue.
 */
const messagesByCode: Record<string, string> = {
  // Klien: dialog dibatalkan atau tidak pernah dikonfirmasi pengguna.
  ERROR_CEREMONY_ABORTED:
    "Verifikasi passkey dibatalkan. Jalankan ulang, lalu konfirmasi permintaan sidik jari atau PIN sampai selesai.",
  ERROR_NOT_ALLOWED:
    "Permintaan passkey tidak dikonfirmasi tepat waktu. Coba lagi dan segera konfirmasi di dialog browser.",
  NotAllowedError:
    "Permintaan passkey tidak dikonfirmasi tepat waktu. Coba lagi dan segera konfirmasi di dialog browser.",
  // Klien: autentikator tidak cocok untuk passkey rumah tangga.
  ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT:
    "Autentikator ini tidak mendukung passkey yang bisa dipakai tanpa mengetik email. Pakai perangkat dengan sidik jari atau wajah.",
  ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT:
    "Autentikator ini tidak bisa memverifikasi identitas (sidik jari, wajah, atau PIN). Coba autentikator lain.",
  ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED:
    "Passkey untuk perangkat ini sudah tersimpan. Buka Profil untuk melihat atau mencabut passkey yang lama.",
  ERROR_AUTHENTICATOR_NO_SUPPORTED_PUBKEYCREDPARAMS_ALG:
    "Autentikator ini tidak mendukung algoritma yang diminta server. Coba passkey dari perangkat lain.",
  ERROR_AUTHENTICATOR_GENERAL_ERROR:
    "Autentikator perangkat menolak permintaan. Coba lagi, atau masuk dengan email/password.",
  // Klien: origin/Relying Party ID tidak cocok dengan konfigurasi server.
  ERROR_INVALID_DOMAIN:
    "Domain ini belum terdaftar sebagai Relying Party di Supabase. Daftarkan di Dashboard > Authentication > Passkeys.",
  ERROR_INVALID_RP_ID:
    "Relying Party ID tidak cocok dengan domain yang sedang dibuka. Konfigurasi RP ID dan daftar origin harus sama.",
  ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY: GENERIC_MESSAGE,
  ERROR_INVALID_USER_ID_LENGTH: GENERIC_MESSAGE,
  ERROR_MALFORMED_PUBKEYCREDPARAMS: GENERIC_MESSAGE,
  // Server.
  webauthn_challenge_expired:
    "Tantangan verifikasi kedaluwarsa (batas 5 menit). Jalankan ulang masuk dengan passkey.",
  mfa_webauthn_enroll_not_enabled:
    "Passkey belum diaktifkan di proyek Supabase. Aktifkan pada Dashboard > Authentication > Passkeys.",
  provider_disabled:
    "Passkey belum diaktifkan di proyek Supabase. Aktifkan pada Dashboard > Authentication > Passkeys.",
  feature_not_enabled:
    "Passkey belum diaktifkan di proyek Supabase. Aktifkan pada Dashboard > Authentication > Passkeys.",
  email_not_confirmed:
    "Akun ini belum diverifikasi lewat email. Masuk dengan email/password dan selesaikan verifikasi email lebih dulu.",
  session_not_found:
    "Sesi berakhir. Masuk dengan email/password, lalu coba lagi.",
  no_authorization:
    "Sesi berakhir. Masuk dengan email/password, lalu coba lagi.",
  user_not_found:
    "Akun ini belum punya passkey terdaftar. Masuk dengan email/password lalu tambahkan passkey di halaman Profil.",
};

/**
 * Mengubah error WebAuthn/Auth menjadi satu kalimat yang dapat ditindaklanjuti.
 *
 * Pesan mentah server kadang berguna saat operasional, jadi kode error yang tidak
 * dikenal tetap ikut ditampilkan agar mudah dilaporkan.
 *
 * @param error Objek error dari `signInWithPasskey`, `registerPasskey`, atau
 * `passkey.*` (boleh `null`/bukan objek).
 * @param actionLabel Label aksi untuk fallback, misalnya "Masuk dengan passkey".
 * @returns Pesan untuk Alert atau teks bantuan.
 */
export function describePasskeyError(
  error: unknown,
  actionLabel = "Passkey",
): string {
  if (!error || typeof error !== "object") {
    return `${actionLabel} gagal. ${GENERIC_MESSAGE}`;
  }

  const { code, name, message } = error as ErrorLike;

  for (const key of [code, name]) {
    if (typeof key === "string" && messagesByCode[key]) {
      return messagesByCode[key];
    }
  }

  const text = typeof message === "string" ? message.trim() : "";

  // `registerPasskey` / `signInWithPasskey` mengembalikan AuthUnknownError tanpa
  // kode ketika browserSupportsWebAuthn() false (konteks non-secure, webview,
  // atau peramban tanpa PublicKeyCredential), jadi hanya teks yang bisa dipakai.
  if (/does not support webauthn|webauthn is not available/i.test(text)) {
    return "Peramban atau halaman ini tidak menyediakan WebAuthn. Buka lewat http://localhost:3000 atau HTTPS (bukan alamat IP LAN seperti 192.168.x.x), pakai peramban terbaru, dan jangan dari dalam webview aplikasi lain.";
  }

  // Server WebAuthn Supabase masih beta: beberapa galat konfigurasi hanya muncul
  // sebagai teks, jadi periksa frasa kuncinya sebelum menyerah ke pesan generik.
  if (/passkey|webauthn/i.test(text) && /not.*(enabled|configured|allowed)|disabled/i.test(text)) {
    return "Passkey belum diaktifkan atau domain ini belum diizinkan di proyek Supabase. Periksa Dashboard > Authentication > Passkeys.";
  }

  if (text && /cancel|abort/i.test(text)) {
    return messagesByCode.ERROR_CEREMONY_ABORTED;
  }

  return text ? `${GENERIC_MESSAGE} (${text})` : `${actionLabel} gagal. ${GENERIC_MESSAGE}`;
}
