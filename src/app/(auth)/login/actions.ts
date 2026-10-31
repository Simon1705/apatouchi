"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { loginSchema } from "@/features/auth/login-schema";
import { getPublicEnvironment } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type LoginActionState = {
  error?: string;
};

/**
 * Mengotentikasi satu akun penghuni yang dibuat manual oleh pengelola.
 *
 * Galat dipetakan ke pesan yang menyebut langkah berikutnya, bukan teks mentah
 * dari server. Pesan `email_not_confirmed` secara tidak langsung mengonfirmasi
 * bahwa email itu terdaftar — risiko yang diterima karena sign-up publik dimatikan
 * dan hanya tiga akun yang ada, sementara penghuni yang akunnya belum aktif tidak
 * bisa menebak penyebab gagalnya masuk.
 */
export async function login(formData: FormData): Promise<LoginActionState> {
  const environment = getPublicEnvironment();

  if (!environment.isSupabaseConfigured) {
    return {
      error:
        environment.validationMessage ??
        "Supabase belum dikonfigurasi. Lengkapi environment variable terlebih dahulu.",
    };
  }

  const result = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!result.success) {
    return { error: "Periksa kembali email dan password Anda." };
  }

  const supabase = await createClient();

  if (!supabase) {
    return { error: "Koneksi autentikasi belum tersedia." };
  }

  const { error } = await supabase.auth.signInWithPassword(result.data);

  if (error) {
    // `error.code` memuat `error_code` dari GoTrue (lihat lib/fetch.js pada
    // @supabase/auth-js), jadi penyebab yang butuh tindakan berbeda bisa dipisah.
    if (error.code === "email_not_confirmed") {
      return {
        error:
          "Akun ini belum diaktifkan. Sampaikan email Anda ke pengelola rumah untuk mengaktifkannya.",
      };
    }

    if (error.status === 429) {
      return {
        error: "Terlalu sering mencoba masuk. Tunggu beberapa menit lalu coba lagi.",
      };
    }

    return {
      error:
        error.status === 400
          ? "Email atau password tidak sesuai."
          : "Tidak dapat masuk saat ini. Coba beberapa saat lagi.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/hari-ini");
}
