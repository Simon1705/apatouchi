"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  ArrowBigUp,
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent as ReactFormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useForm } from "react-hook-form";

import { login, type LoginActionState } from "@/app/(auth)/login/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginSchema, type LoginValues } from "@/features/auth/login-schema";

export type LoginFormProps = {
  isConfigured: boolean;
  setupMessage?: string;
};

/**
 * Akhiran email yang dianggap sudah menyelesaikan domain, sehingga fokus boleh
 * pindah seketika. `.co` sengaja tidak ada: ia TLD yang sah sekaligus awal dari
 * `.co.id` dan `.co.jp` — justru kasus yang membuat lompatan terasa terlalu cepat.
 * `.id` sudah menutup `.co.id`/`.my.id`/`.web.id`, `.jp` menutup `.co.jp`/`.ne.jp`.
 */
const FINAL_EMAIL_SUFFIXES = [".com", ".net", ".org", ".id", ".jp"] as const;

/**
 * Jeda tunggu untuk akhiran di luar daftar di atas. 600 ms lebih panjang dari
 * jeda antar-tombol saat mengetik, tapi cukup pendek untuk masih terasa otomatis.
 */
const EMAIL_ADVANCE_DELAY_MS = 600;

/**
 * Form login email/password dengan validasi Zod.
 *
 * Jarak vertikal sengaja rapat: halaman login harus muat satu layar ponsel
 * portrait tanpa scroll. Input tetap 44px (token sentuh minimum) dan `text-base`,
 * karena font di bawah 16px membuat iOS menambah zoom otomatis saat field difokus
 * — hasilnya justru scroll horizontal yang tidak diminta.
 *
 * Dua kemudahan mengetik ditambahkan tanpa menambah tinggi halaman: tombol
 * lihat/sembunyikan password berada di dalam field, dan fokus pindah ke password
 * begitu alamat email lengkap.
 */
export function LoginForm({ isConfigured, setupMessage }: LoginFormProps) {
  const [actionState, setActionState] = useState<LoginActionState>({});
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const passwordInput = useRef<HTMLInputElement | null>(null);
  // Antrean perpindahan fokus ke password; dibatalkan setiap kali email berubah
  // supaya tidak ada dua antrean yang bertarung.
  const emailAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Antrean dibersihkan saat komponen dilepas (mis. navigasi setelah login sukses),
  // agar fokus tidak pernah dipindahkan oleh halaman yang sudah tidak aktif.
  useEffect(() => {
    return () => {
      if (emailAdvanceTimer.current !== null) {
        clearTimeout(emailAdvanceTimer.current);
      }
    };
  }, []);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  // Dipanggil di luar JSX karena ref-nya harus digabung dengan ref milik kita.
  const passwordField = register("password");

  const onSubmit = handleSubmit((values) => {
    setActionState({});
    const formData = new FormData();
    formData.set("email", values.email);
    formData.set("password", values.password);

    startTransition(async () => {
      const state = await login(formData);
      setActionState(state);
    });
  });

  /**
   * Pindah fokus ke password begitu alamat email selesai diketik.
   *
   * Ukuran "selesai" memakai `loginSchema.shape.email.safeParse()` — sumber
   * kebenaran yang sama dengan validasi saat submit, jadi tidak ada dua definisi
   * email yang valid.
   *
   * Ada dua jalur karena Zod sudah menganggap `nama@mail.co` valid padahal
   * pengguna biasanya melanjutkan ke `.co.id` / `.co.jp`:
   * - akhiran yang menutup domain (`FINAL_EMAIL_SUFFIXES`) pindah seketika;
   * - sisanya ditunda `EMAIL_ADVANCE_DELAY_MS`, lebih panjang dari jeda
   *   antar-tombol normal, jadi perpindahan terasa "setelah selesai".
   *
   * Dipicu oleh `onInput`, BUKAN `onKeyUp`: `selectionStart` tidak tersedia pada
   * `type="email"` (nilainya `null`, sehingga deteksi posisi kursor selalu gagal),
   * dan keyboard lunak tidak tepercaya soal isi `event.key` — Android melapor
   * `"Unidentified"`, teks prediktif iOS kadang tidak memicu `keyup`.
   */
  function handleEmailInput(event: ReactFormEvent<HTMLInputElement>) {
    // `currentTarget` disalin lebih dulu: React mengembalikan properti itu ke
    // `null` setelah handler selesai, sementara callback di bawah masih butuh
    // elemennya untuk memeriksa fokus.
    const element = event.currentTarget;

    if (emailAdvanceTimer.current !== null) {
      clearTimeout(emailAdvanceTimer.current);
      emailAdvanceTimer.current = null;
    }

    const value = element.value.trim();

    if (!loginSchema.shape.email.safeParse(value).success) {
      return;
    }

    const lowerCased = value.toLowerCase();
    const isFinalSuffix = FINAL_EMAIL_SUFFIXES.some((suffix) =>
      lowerCased.endsWith(suffix),
    );

    emailAdvanceTimer.current = setTimeout(() => {
      emailAdvanceTimer.current = null;

      // Jangan merebut fokus kalau pengguna sudah pindah sendiri (mis. menekan
      // tombol passkey atau berpindah field sebelum antrean sempat jalan).
      if (document.activeElement !== element) {
        return;
      }

      passwordInput.current?.focus();
    }, isFinalSuffix ? 0 : EMAIL_ADVANCE_DELAY_MS);
  }

  /**
   * Enter pada email berarti "lanjut", bukan "kirim". Mengirim form setengah
   * jadi hanya memunculkan pesan galat yang belum berguna.
   */
  function handleEmailKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    passwordInput.current?.focus();
  }

  return (
    // Form berisi email + password adalah target utama pengisi-otomatis/kredensial
    // Chrome, yang menyisipkan atribut sendiri sebelum hidrasi selesai. Atribut
    // itu bukan data aplikasi, jadi peringatan hidrasi untuk elemen ini diredam.
    // Spacing rapat: lihat catatan pada JSDoc komponen.
    <form
      className="space-y-4"
      onSubmit={onSubmit}
      noValidate
      suppressHydrationWarning
    >
      {!isConfigured ? (
        <Alert className="border-warning/35 bg-warning-soft text-foreground">
          <LockKeyhole aria-hidden="true" />
          <AlertTitle>Setup Supabase diperlukan</AlertTitle>
          <AlertDescription>
            {setupMessage ??
              "Isi environment variable dari project Supabase sebelum masuk."}
          </AlertDescription>
        </Alert>
      ) : null}

      {actionState.error ? (
        <Alert variant="destructive" role="alert">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Belum dapat masuk</AlertTitle>
          <AlertDescription>{actionState.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="next"
          placeholder="nama@contoh.com"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "email-error" : undefined}
          disabled={isPending || !isConfigured}
          className="h-11 bg-card px-4"
          {...register("email")}
          onKeyDown={handleEmailKeyDown}
          onInput={handleEmailInput}
        />
        {errors.email ? (
          <p id="email-error" className="text-sm font-medium text-destructive">
            {errors.email.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="password">Password</Label>
          {/* Satu slot teks untuk dua petunjuk: tinggi form tidak bertambah dan
              status Caps Lock muncul tepat di dekat field yang bersangkutan. */}
          <span
            id="password-hint"
            role="status"
            className={
              isCapsLockOn
                ? "flex items-center gap-1 text-xs font-bold text-warning"
                : "flex items-center gap-1 text-xs text-muted-foreground"
            }
          >
            {isCapsLockOn ? (
              <>
                <ArrowBigUp className="size-3.5" aria-hidden="true" />
                Caps Lock aktif
              </>
            ) : (
              "Minimal 8 karakter"
            )}
          </span>
        </div>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="go"
            placeholder="Masukkan password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={
              errors.password
                ? "password-error"
                : isCapsLockOn
                  ? "password-hint"
                  : undefined
            }
            disabled={isPending || !isConfigured}
            className="h-11 bg-card pl-4 pr-12"
            {...passwordField}
            ref={(element) => {
              // Ref gabungan: RHF butuh elemennya untuk membaca nilai, form ini
              // butuh elemennya untuk memindahkan fokus.
              passwordInput.current = element;
              passwordField.ref(element);
            }}
            onKeyUp={(event) =>
              setIsCapsLockOn(event.getModifierState("CapsLock"))
            }
          />
          {/* Tombol berada di dalam field (bukan baris baru) supaya hemat tinggi.
              `aria-pressed` menyampaikan keadaan, label menyampaikan aksi. */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-0 right-0 text-muted-foreground"
            aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
            aria-pressed={showPassword}
            title={showPassword ? "Sembunyikan password" : "Tampilkan password"}
            onClick={() => setShowPassword((visible) => !visible)}
          >
            {showPassword ? (
              <EyeOff aria-hidden="true" />
            ) : (
              <Eye aria-hidden="true" />
            )}
          </Button>
        </div>
        {errors.password ? (
          <p id="password-error" className="text-sm font-medium text-destructive">
            {errors.password.message}
          </p>
        ) : null}
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={isPending || !isConfigured}
        className="h-11 w-full justify-between px-4 text-base font-bold shadow-sm"
      >
        <span>{isPending ? "Memeriksa akun…" : "Masuk ke rumah"}</span>
        {isPending ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <ArrowRight aria-hidden="true" />
        )}
      </Button>
    </form>
  );
}
