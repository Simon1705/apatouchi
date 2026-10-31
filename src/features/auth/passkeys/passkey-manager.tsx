"use client";

import {
  AlertCircle,
  Fingerprint,
  LoaderCircle,
  Pencil,
  RefreshCw,
  Save,
  ShieldOff,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { describePasskeyError } from "@/features/auth/passkeys/passkey-errors";
import {
  detectPasskeySupport,
  type PasskeySupport,
} from "@/features/auth/passkeys/passkey-support";
import {
  formatDateLabel,
  formatRelativeDayLabel,
  todayInTokyo,
  tokyoDateFromIso,
} from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";

/** Baris passkey seperti dilaporkan Supabase Auth (`auth.passkey.list`). */
type ManagedPasskey = {
  id: string;
  friendly_name?: string;
  created_at: string;
  last_used_at?: string;
};

/** Kunci status sibuk: id passkey, `${id}:rename`, `"new"`, atau `"reload"`. */
type BusyKey = string | null;

/**
 * Panjang maksimum label yang kita izinkan. Server menerima sampai 120 karakter,
 * tapi label pendek lebih mudah discan di daftar (`HP Bima`, `Laptop Saya`).
 */
const FRIENDLY_NAME_MAX_LENGTH = 40;
const FRIENDLY_NAME_MIN_LENGTH = 2;

/**
 * Label passkey untuk daftar dan konfirmasi pencabutan.
 * `friendly_name` opsional, jadi tanggal pembuatan menjadi penanda cadangan.
 */
function passkeyLabel(passkey: ManagedPasskey): string {
  const name = passkey.friendly_name?.trim();

  if (name) {
    return name;
  }

  return `Passkey ${formatDateLabel(tokyoDateFromIso(passkey.created_at))}`;
}

/** Hasil pembacaan daftar passkey tanpa menyentuh state komponen. */
type PasskeyListResult = {
  passkeys?: ManagedPasskey[];
  error?: string;
};

/**
 * Membaca daftar passkey milik akun melalui klien browser.
 *
 * Dipisahkan dari komponen agar effect awal cukup menulis hasil lewat callback
 * promise, bukan memanggil setState secara sinkron.
 *
 * @param supabase Klien Supabase browser, atau `null` bila belum dikonfigurasi.
 */
async function loadPasskeyList(
  supabase: ReturnType<typeof createClient>,
): Promise<PasskeyListResult> {
  if (!supabase) {
    return { error: "Supabase belum dikonfigurasi." };
  }

  const { data, error } = await supabase.auth.passkey.list();

  if (error) {
    return { error: describePasskeyError(error, "Daftar passkey") };
  }

  return { passkeys: (data ?? []) as ManagedPasskey[] };
}

/**
 * Manajemen passkey milik akun yang sedang masuk: daftar, tambah dari perangkat
 * ini, dan cabut.
 *
 * Semua panggilan WebAuthn harus terjadi di browser atas aksi pengguna, jadi
 * komponen ini memakai klien Supabase browser. Pencabutan memakai konfirmasi yang
 * menyebut objek karena dampak dan pemulihannya berbeda-beda per passkey.
 *
 * Tombol tambah ditutup selama API WebAuthn tidak tersedia (mis. halaman dibuka
 * lewat alamat IP LAN), karena kegagalan jenis ini pasti terjadi dan alasannya
 * sudah disampaikan lewat baris peringatan di atas tombol.
 *
 * Setiap baris punya Ganti nama karena pendaftaran passkey tidak menerima label,
 * sehingga daftar tanpa nama perangkat cepat sulit dibedakan.
 */
export function PasskeyManager() {
  const supabase = useMemo(() => createClient(), []);
  const [passkeys, setPasskeys] = useState<ManagedPasskey[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ error?: string; message?: string }>({});
  const [busy, setBusy] = useState<BusyKey>(null);
  const [support, setSupport] = useState<PasskeySupport | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const today = todayInTokyo();

  const applyListResult = useCallback((result: PasskeyListResult) => {
    if (result.error) {
      setPasskeys(null);
      setListError(result.error);
      return;
    }

    setListError(null);
    setPasskeys(result.passkeys ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;

    // State awal diisi dari callback async; memanggil setState secara sinkron di
    // body effect memicu render berantai.
    void loadPasskeyList(supabase).then((result) => {
      if (!cancelled) {
        applyListResult(result);
      }
    });

    detectPasskeySupport().then((result) => {
      if (!cancelled) {
        setSupport(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [applyListResult, supabase]);

  async function handleReload() {
    setBusy("reload");
    applyListResult(await loadPasskeyList(supabase));
    setBusy(null);
  }

  async function handleAdd() {
    if (!supabase) {
      return;
    }

    setFeedback({});
    setBusy("new");

    const { error } = await supabase.auth.registerPasskey();
    setBusy(null);

    if (error) {
      setFeedback({ error: describePasskeyError(error, "Menyimpan passkey") });
      return;
    }

    setFeedback({
      message:
        "Passkey tersimpan di perangkat ini. Beri label lewat Ganti nama supaya daftar perangkat mudah dibedakan.",
    });
    applyListResult(await loadPasskeyList(supabase));
  }

  /**
   * Mengganti `friendly_name` sebuah passkey. Tidak ada seremoni WebAuthn di sini:
   * hanya metadata yang diperbarui lewat sesi yang sudah aktif.
   *
   * @param passkey Baris passkey yang sedang diedit.
   * @param friendlyName Label baru, sudah ditrim oleh form.
   */
  async function handleRename(passkey: ManagedPasskey, friendlyName: string) {
    if (!supabase) {
      return;
    }

    setFeedback({});
    setBusy(`${passkey.id}:rename`);

    const { error } = await supabase.auth.passkey.update({
      passkeyId: passkey.id,
      friendlyName,
    });
    setBusy(null);

    if (error) {
      // Mode edit dibiarkan terbuka agar pengguna bisa mencoba lagi tanpa mengetik ulang.
      setFeedback({ error: describePasskeyError(error, "Mengganti nama passkey") });
      return;
    }

    setEditingId(null);
    setFeedback({ message: `Passkey sekarang bernama ${friendlyName}.` });
    applyListResult(await loadPasskeyList(supabase));
  }

  async function handleRevoke(passkey: ManagedPasskey) {
    if (!supabase) {
      return;
    }

    // Aksi destruktif: konfirmasi menyebut objek dan dampak pemulihannya.
    const confirmed = window.confirm(
      `Cabut ${passkeyLabel(passkey)}? Perangkat tersebut harus masuk dengan email/password lagi.`,
    );

    if (!confirmed) {
      return;
    }

    setFeedback({});
    setBusy(passkey.id);

    const { error } = await supabase.auth.passkey.delete({
      passkeyId: passkey.id,
    });
    setBusy(null);

    if (error) {
      setFeedback({ error: describePasskeyError(error, "Mencabut passkey") });
      return;
    }

    setFeedback({ message: "Passkey dicabut." });
    applyListResult(await loadPasskeyList(supabase));
  }

  return (
    <div className="space-y-3">
      {feedback.error ? (
        <Alert variant="destructive" role="alert">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Passkey tidak tersimpan</AlertTitle>
          <AlertDescription>{feedback.error}</AlertDescription>
        </Alert>
      ) : null}

      {feedback.message ? (
        <p className="text-sm font-medium text-success" role="status">
          {feedback.message}
        </p>
      ) : null}

      {listError ? (
        <div className="space-y-3 rounded-xl border border-warning/35 bg-card p-4">
          <p className="text-sm leading-6 text-muted-foreground">{listError}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy === "reload"}
            onClick={() => void handleReload()}
          >
            {busy === "reload" ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw aria-hidden="true" />
            )}
            Muat ulang daftar
          </Button>
        </div>
      ) : passkeys === null ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="animate-spin" aria-hidden="true" />
          Memuat daftar passkey…
        </p>
      ) : passkeys.length === 0 ? (
        <p className="flex items-start gap-3 rounded-xl border border-dashed border-border bg-card px-4 py-5 text-sm leading-6 text-muted-foreground">
          <Fingerprint className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          Belum ada passkey tersimpan. Tambahkan dari perangkat ini supaya masuk
          cukup dengan sidik jari atau wajah; email/password tetap cadangannya.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {passkeys.map((passkey) => {
            const isEditing = editingId === passkey.id;

            return (
              <li key={passkey.id} className="p-4">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{passkeyLabel(passkey)}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {passkey.last_used_at
                        ? `Terakhir dipakai ${formatRelativeDayLabel(
                            tokyoDateFromIso(passkey.last_used_at),
                            today,
                          )}`
                        : "Belum pernah dipakai masuk"}{" "}
                      · dibuat {formatDateLabel(tokyoDateFromIso(passkey.created_at))}
                    </p>
                  </div>
                  {/* Mode edit menyembunyikan aksi lain: dua perubahan sekaligus
                      pada satu baris hanya membalapkan hasil daftar. */}
                  {isEditing ? null : (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Ganti nama"
                        aria-label={`Ganti nama ${passkeyLabel(passkey)}`}
                        disabled={busy !== null}
                        onClick={() => {
                          setFeedback({});
                          setEditingId(passkey.id);
                        }}
                      >
                        <Pencil aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-destructive"
                        disabled={busy !== null}
                        onClick={() => void handleRevoke(passkey)}
                      >
                        {busy === passkey.id ? (
                          <LoaderCircle className="animate-spin" aria-hidden="true" />
                        ) : (
                          <ShieldOff aria-hidden="true" />
                        )}
                        Cabut
                      </Button>
                    </>
                  )}
                </div>

                {isEditing ? (
                  <PasskeyRenameForm
                    passkey={passkey}
                    isPending={busy === `${passkey.id}:rename`}
                    isBusy={busy !== null}
                    onCancel={() => setEditingId(null)}
                    onSubmit={(friendlyName) => void handleRename(passkey, friendlyName)}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {support && !support.canUse ? (
        <p className="text-xs leading-5 text-warning" role="status">
          {support.message}
        </p>
      ) : null}

      <Button
        type="button"
        className="w-full"
        disabled={busy !== null || !supabase || !support?.hasWebAuthnApi}
        onClick={() => void handleAdd()}
      >
        {busy === "new" ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <Fingerprint aria-hidden="true" />
        )}
        {busy === "new" ? "Menunggu konfirmasi…" : "Tambah passkey di perangkat ini"}
      </Button>

      <p className="text-xs leading-5 text-muted-foreground">
        Aplikasi tidak menyimpan data biometrik. Perangkat yang menyimpan kuncinya,
        server hanya menerima bukti kriptografis. Jangan cabut passkey terakhir kalau
        perangkat ini satu-satunya yang Anda pegang.
      </p>
    </div>
  );
}

type PasskeyRenameFormProps = {
  passkey: ManagedPasskey;
  /** Permintaan `passkey.update` untuk baris ini sedang berjalan. */
  isPending: boolean;
  /** Ada aksi lain yang sedang berjalan di daftar ini. */
  isBusy: boolean;
  onCancel: () => void;
  onSubmit: (friendlyName: string) => void;
};

/**
 * Form inline untuk memberi label pada sebuah passkey.
 *
 * Penamaan selalu terjadi setelah passkey dibuat: `registerPasskey()` hanya
 * menerima `options.signal`, jadi tidak ada tempat untuk `friendly_name` saat
 * pendaftaran. Label ini pula yang dipakai tombol Cabut dan teks konfirmasi.
 */
function PasskeyRenameForm({
  passkey,
  isPending,
  isBusy,
  onCancel,
  onSubmit,
}: PasskeyRenameFormProps) {
  const currentName = passkey.friendly_name?.trim() ?? "";
  const [value, setValue] = useState(currentName);

  const trimmed = value.trim();
  const isTooShort = trimmed.length < FRIENDLY_NAME_MIN_LENGTH;
  const isUnchanged = trimmed === currentName;
  const inputId = `passkey-name-${passkey.id}`;

  function handleCancel() {
    // Label yang sudah diketik belum tersimpan, jadi dikonfirmasi lebih dulu.
    if (
      !isUnchanged &&
      !window.confirm("Nama yang sudah diketik tidak disimpan. Tutup form?")
    ) {
      return;
    }

    onCancel();
  }

  return (
    <form
      className="mt-3 space-y-3"
      onSubmit={(event) => {
        event.preventDefault();

        if (isTooShort || isUnchanged) {
          return;
        }

        onSubmit(trimmed);
      }}
    >
      <div className="space-y-2">
        <Label htmlFor={inputId}>Nama passkey</Label>
        <Input
          id={inputId}
          value={value}
          autoComplete="off"
          spellCheck={false}
          maxLength={FRIENDLY_NAME_MAX_LENGTH}
          disabled={isPending}
          placeholder="mis. HP Bima"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              handleCancel();
            }
          }}
        />
        {isTooShort ? (
          <p className="text-xs text-destructive">
            Minimal {FRIENDLY_NAME_MIN_LENGTH} huruf, misalnya “HP Bima”.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Label pengingat perangkat, hanya terlihat oleh akun ini.
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          className="flex-1"
          disabled={isBusy || isTooShort || isUnchanged}
        >
          {isPending ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : (
            <Save aria-hidden="true" />
          )}
          {isPending ? "Menyimpan..." : "Simpan nama"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={handleCancel}
        >
          <X aria-hidden="true" />
          Batal
        </Button>
      </div>
    </form>
  );
}
