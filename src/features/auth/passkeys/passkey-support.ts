/**
 * Kemampuan passkey (WebAuthn) pada browser dan perangkat saat ini.
 * Fungsi ini hanya berarti di browser; saat tidak ada `window` hasilnya "tidak
 * tersedia" supaya UI tidak pernah mencoba memanggil WebAuthn di server.
 */
export type PasskeySupport = {
  /**
   * API WebAuthn benar-benar tersedia di konteks ini. Bila `false`, panggilan
   * `signInWithPasskey` / `registerPasskey` pasti gagal lebih sebelum dialog
   * muncul, jadi aksi sebaiknya ditutup (lihat `browserSupportsWebAuthn()` di
   * `@supabase/auth-js` yang memakai syarat yang sama).
   */
  hasWebAuthnApi: boolean;
  /** Seremoni passkey layak dicoba di perangkat ini. */
  canUse: boolean;
  /** Autentikator platform (sidik jari, wajah, atau PIN perangkat) terdeteksi. */
  hasPlatformAuthenticator: boolean;
  /** Conditional UI (autofill passkey) tersedia; opsi, bukan syarat. */
  supportsConditionalUi: boolean;
  /** Penjelasan singkat dengan istilah pengguna bila `canUse` false. */
  message?: string;
};

/** Static method `PublicKeyCredential` yang dipakai untuk probe kemampuan. */
type PublicKeyCredentialStatics = {
  isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>;
  isConditionalMediationAvailable?: () => Promise<boolean>;
};

/**
 * Cek syarat API WebAuthn, disamakan dengan `browserSupportsWebAuthn()` di
 * `@supabase/auth-js`. Sengaja tidak memakai `window.isSecureContext` di sini:
 * perpindahan itu sudah diperiksa lebih dulu agar pesannya spesifik.
 *
 * @returns `true` bila `PublicKeyCredential` dan `navigator.credentials` lengkap.
 */
function hasWebAuthnApi(): boolean {
  if (typeof window === "undefined" || !("PublicKeyCredential" in window)) {
    return false;
  }

  const credentials = typeof navigator === "undefined" ? undefined : navigator.credentials;

  return Boolean(
    window.PublicKeyCredential &&
      credentials &&
      typeof credentials.create === "function" &&
      typeof credentials.get === "function",
  );
}

/**
 * Menjalankan probe WebAuthn tanpa pernah melempar ke pemanggil.
 * Beberapa browser menolak static method-nya (NotSupportedError), dan itu berarti
 * "tidak didukung", bukan galat yang harus menghentikan UI.
 *
 * @param probe Promise hasil probe, atau `undefined` bila metodenya tidak ada.
 * @returns Hasil probe, `false` bila gagal atau tidak tersedia.
 */
async function probeBoolean(probe: Promise<boolean> | undefined): Promise<boolean> {
  if (!probe) {
    return false;
  }

  try {
    return await probe;
  } catch {
    return false;
  }
}

/**
 * Mendeteksi apakah passkey dapat dipakai di perangkat ini.
 *
 * Tiga hal diperiksa: konteks aman (WebAuthn menolak HTTP selain `localhost`),
 * ketersediaan `navigator.credentials` + `PublicKeyCredential`, dan autentikator
 * platform. Dukungan discoverable credential tidak bisa dipastikan dari JS, jadi
 * tetap bisa gagal di sisi server meskipun hasil deteksi `canUse` true.
 *
 * @returns Status kemampuan beserta pesan bila tidak tersedia.
 */
export async function detectPasskeySupport(): Promise<PasskeySupport> {
  const unavailable: PasskeySupport = {
    hasWebAuthnApi: false,
    canUse: false,
    hasPlatformAuthenticator: false,
    supportsConditionalUi: false,
  };

  if (typeof window === "undefined") {
    return {
      ...unavailable,
      message: "Deteksi passkey hanya berjalan di browser.",
    };
  }

  if (!window.isSecureContext) {
    return {
      ...unavailable,
      message:
        "WebAuthn menolak koneksi tidak aman. Buka lewat http://localhost:3000 (bukan alamat IP LAN seperti 192.168.x.x) atau lewat HTTPS.",
    };
  }

  if (!hasWebAuthnApi()) {
    return {
      ...unavailable,
      message:
        "Peramban atau mode jendela ini tidak menyediakan API passkey. Perbarui peramban, hindari mode privat lama atau webview aplikasi lain, lalu coba lagi.",
    };
  }

  const statics = window.PublicKeyCredential as unknown as PublicKeyCredentialStatics;
  const hasPlatformAuthenticator = await probeBoolean(
    statics.isUserVerifyingPlatformAuthenticatorAvailable?.(),
  );
  const supportsConditionalUi = await probeBoolean(
    statics.isConditionalMediationAvailable?.(),
  );

  if (!hasPlatformAuthenticator) {
    return {
      hasWebAuthnApi: true,
      canUse: false,
      hasPlatformAuthenticator: false,
      supportsConditionalUi,
      message:
        "Perangkat ini tidak punya autentikator bawaan (sidik jari, wajah, atau PIN). Passkey bisa dibuat memakai security key external, atau tetap masuk dengan email/password.",
    };
  }

  return {
    hasWebAuthnApi: true,
    canUse: true,
    hasPlatformAuthenticator: true,
    supportsConditionalUi,
  };
}
