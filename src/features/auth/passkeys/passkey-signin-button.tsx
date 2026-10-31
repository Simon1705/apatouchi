"use client";

import { Fingerprint, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { describePasskeyError } from "@/features/auth/passkeys/passkey-errors";
import {
  detectPasskeySupport,
  type PasskeySupport,
} from "@/features/auth/passkeys/passkey-support";
import { createClient } from "@/lib/supabase/client";

type PasskeySignInButtonProps = {
  /** Tujuan setelah passkey berhasil diverifikasi. */
  redirectTo?: string;
};

/**
 * Tahapan tombol.
 *
 * `navigating` sengaja dipisahkan dari `ceremony`: saat sesi diterima browser,
 * halaman lama masih tampil beberapa ratus milidetik sampai `location.assign`
 * menukarnya. Kalau state langsung dilepas di antaranya, tombol kembali aktif
 * dan pengguna bisa memicu seremoni WebAuthn kedua untuk aksi yang sudah sukses.
 */
type SignInPhase = "idle" | "ceremony" | "navigating";

/**
 * Tombol masuk dengan passkey (WebAuthn discoverable credential).
 *
 * Seremoni WebAuthn wajib dipanggil dari browser atas aksi pengguna, jadi
 * komponen ini memakai klien Supabase browser, bukan Server Action.
 * Email/password tetap jalan utama: bila passkey gagal, form di atasnya
 * tidak ikut berubah.
 *
 * Tombol hanya ditutup kalau API WebAuthn pasti tidak ada (konteks non-secure,
 * peramban tanpa `PublicKeyCredential`) — keadaan yang deterministik dan sudah
 * pasti menghasilkan galat. Hasil probe autentikator platform TIDAK dipakai untuk
 * menutup tombol karena `isUserVerifyingPlatformAuthenticatorAvailable()` memberi
 * false negative di sebagian perangkat; pengguna tetap boleh mencoba dan galat
 * aslinya dipetakan ke pesan yang jelas.
 */
export function PasskeySignInButton({ redirectTo = "/hari-ini" }: PasskeySignInButtonProps) {
  // `null` berarti deteksi kemampuan masih berjalan.
  const [support, setSupport] = useState<PasskeySupport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<SignInPhase>("idle");

  useEffect(() => {
    let cancelled = false;

    detectPasskeySupport().then((result) => {
      if (!cancelled) {
        setSupport(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const isBusy = phase !== "idle";

  async function handleSignIn() {
    setError(null);
    const supabase = createClient();

    if (!supabase) {
      setError("Supabase belum dikonfigurasi. Lengkapi environment variable.");
      return;
    }

    setPhase("ceremony");

    try {
      const { error: signInError } = await supabase.auth.signInWithPasskey();

      if (signInError) {
        setError(describePasskeyError(signInError, "Masuk dengan passkey"));
        setPhase("idle");
        return;
      }
    } catch (cause) {
      // `signInWithPasskey` melaporkan galat lewat `error`, jadi cabang ini khusus
      // kegagalan yang melempar (mis. jaringan terputus). Tanpa reset phase, tombol
      // akan terkunci selamanya tanpa penjelasan.
      setError(describePasskeyError(cause, "Masuk dengan passkey"));
      setPhase("idle");
      return;
    }

    // Sesi hasil passkey ditulis sebagai cookie oleh klien browser. Navigasi
    // penuh menjamin Server Component ikut membaca cookie baru tersebut.
    setPhase("navigating");
    window.location.assign(redirectTo);
  }

  // Semua cabang "tidak bisa" selalu membawa pesan, jadi fallback ini hanya untuk
  // keadaan siap pakai. Rangkanya sengaja pendek: di bawahnya ada field form, dan
  // halaman login harus tetap muat satu layar ponsel portrait tanpa scroll.
  const statusMessage = support
    ? (support.message ?? "Konfirmasi dengan sidik jari, wajah, atau PIN.")
    : "Memeriksa kemampuan perangkat…";

  const buttonLabel =
    phase === "ceremony"
      ? "Menunggu konfirmasi…"
      : phase === "navigating"
        ? "Masuk…"
        : "Masuk dengan passkey";

  return (
    <div className="space-y-2.5 pt-4">
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
          Atau
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Masuk dengan passkey gagal</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Button
        type="button"
        size="lg"
        variant="outline"
        className="h-11 w-full text-base font-bold"
        disabled={isBusy || !support?.hasWebAuthnApi}
        aria-busy={isBusy || undefined}
        onClick={handleSignIn}
      >
        {isBusy ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <Fingerprint aria-hidden="true" />
        )}
        {buttonLabel}
      </Button>

      <p className="text-xs leading-5 text-muted-foreground" role="status">
        {statusMessage}
      </p>
    </div>
  );
}
