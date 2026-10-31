import { AlertCircle, Home, Info } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Menampilkan pesan persis satu kali ketika beberapa sumber data gagal dimuat,
 * agar pengguna tidak mengira rumah memang kosong.
 *
 * @param messages Kumpulan pesan error dari setiap query; duplikat dihapus.
 */
export function LoadErrorNotice({ messages }: { messages: string[] }) {
  const uniqueMessages = Array.from(new Set(messages.filter(Boolean)));

  if (uniqueMessages.length === 0) {
    return null;
  }

  return (
    <Alert variant="destructive" role="alert">
      <AlertCircle aria-hidden="true" />
      <AlertTitle>Data tidak dapat dimuat</AlertTitle>
      <AlertDescription>
        <ul className="list-disc space-y-1 pl-4">
          {uniqueMessages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
        <p className="mt-2">
          Muat ulang halaman ini. Bila terus terjadi, periksa koneksi dan
          keanggotaan rumah Anda.
        </p>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Status awal ketika kredensial Supabase belum lengkap, sehingga data rumah
 * tidak mungkin ditampilkan.
 *
 * @param message Pesan validasi dari environment, bila ada.
 */
export function SupabaseSetupNotice({ message }: { message?: string }) {
  return (
    <Alert className="border-warning/35 bg-warning-soft text-foreground">
      <Info aria-hidden="true" />
      <AlertTitle>Setup Supabase diperlukan</AlertTitle>
      <AlertDescription>
        {message ??
          "Lengkapi environment variable Supabase untuk mulai memakai aplikasi."}
      </AlertDescription>
    </Alert>
  );
}

/** Status ketika akun sudah login tetapi belum terdaftar pada sebuah rumah. */
export function HouseholdNotReadyNotice() {
  return (
    <section className="rounded-[20px] border border-border bg-card p-6 text-center shadow-sm">
      <span className="mx-auto grid size-12 place-items-center rounded-xl bg-charcoal text-white">
        <Home className="size-6" strokeWidth={1.8} aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-lg font-extrabold">Rumah belum disiapkan</h2>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
        Akun Anda belum terdaftar dalam sebuah rumah. Minta pengelola menjalankan
        skrip{" "}
        <code className="rounded bg-secondary px-1 py-0.5 text-xs">
          supabase/scripts/bootstrap-household.sql
        </code>{" "}
        di SQL Editor Supabase, lalu muat ulang halaman ini.
      </p>
    </section>
  );
}
