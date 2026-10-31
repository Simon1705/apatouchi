# Uchi — Aplikasi Manajemen Rumah

Fondasi aplikasi mobile-first untuk tiga penghuni yang tinggal bersama di Jepang. Project menggunakan Next.js 16 App Router, TypeScript, Tailwind CSS, shadcn/ui, dan Supabase.

## Menjalankan tanpa project Supabase

Aplikasi dapat di-install, diperiksa, dan di-build tanpa credential. Halaman login akan menampilkan status setup dan menonaktifkan tombol masuk.

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`. Jangan memasukkan nilai palsu ke environment variable; biarkan kosong sampai project Supabase tersedia.

Pemeriksaan yang tersedia:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Membuat project Supabase nanti

1. Buat project baru melalui Supabase Dashboard.
2. Pilih region yang dekat dengan pengguna di Jepang.
3. Buka **Project Settings → API**.
4. Salin Project URL dan publishable key. Jangan gunakan `service_role` key di browser.
5. Salin `.env.example` menjadi `.env.local`.

PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Isi konfigurasi berikut:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=publishable-key-project
NEXT_PUBLIC_ENABLE_PASSKEYS=false
```

Restart proses development setelah mengubah `.env.local`.

## Menjalankan migration

Supabase CLI sudah terpasang sebagai dev dependency dan folder lokal sudah dibuat dengan `supabase init`. Setelah project cloud tersedia, autentikasi dan hubungkan CLI, lalu kirim migration:

```bash
npx supabase login
npx supabase link --project-ref PROJECT_REF
npx supabase db push
```

Migration awal berada di `supabase/migrations/202610240001_initial_schema.sql`. Migration membuat schema rumah, trigger profil, index, helper akses anti-recursion, dan Row Level Security untuk seluruh tabel aplikasi. Tidak ada seed user.

> `db push` hanya mengirim **migration**. Konfigurasi pada `supabase/config.toml` (auth, API, dsb.) berlaku untuk **Supabase lokal** dan **tidak** ikut ter-push ke project cloud. Setelah project cloud dibuat, samakan pengaturan auth berikut melalui Dashboard.

## Mengamankan auth di cloud

Default project cloud mengizinkan sign-up publik. Aplikasi ini hanya untuk tiga penghuni, jadi wajib dikunci manual di Dashboard:

1. **Authentication → Sign In / Providers → Email**
   - Matikan **Allow new users to sign up** (setara `enable_signup = false` pada `config.toml`).
   - Biarkan login email/password aktif.
   - Matikan konfirmasi email bila akun dibuat manual dan langsung dipakai (setara `enable_confirmations = false`).
2. **Authentication → URL Configuration**
   - Isi **Site URL** dengan domain produksi (Vercel) setelah final.
   - Tambahkan **Redirect URLs**: `http://localhost:3000/**` untuk development dan domain produksi.
   - Pengaturan ini dibutuhkan alur email (reset password, magic link); login password biasa tidak melewatinya.

## Membuat tiga akun penghuni

Public sign-up sengaja tidak tersedia. Buat ketiga akun secara manual:

1. Buka **Authentication → Users** di Supabase Dashboard.
2. Pilih **Add user → Create new user**.
3. Masukkan email dan password sementara untuk penghuni pertama.
4. Tandai email sebagai terkonfirmasi bila akun harus langsung dapat digunakan.
5. Ulangi untuk dua penghuni lainnya.
6. Minta setiap penghuni menyimpan password secara aman.

Trigger `handle_new_user` otomatis membuat satu baris `profiles` untuk setiap akun Auth baru. UUID tidak perlu disalin ke migration dan tidak boleh dibuat sebagai seed.

## Menyiapkan rumah pertama

Semua data aplikasi terikat pada satu `household`, dan setiap baris bisnis membutuhkan `household_id`. Karena kebijakan RLS hanya mengizinkan owner menambahkan anggota (dan owner tidak dapat melihat profil calon anggota sebelum serumah), bootstrap dilakukan sekali lewat skrip SQL yang dijalankan sebagai `postgres` (RLS ter-bypass).

1. Buka `supabase/scripts/bootstrap-household.sql`.
2. Ganti nama rumah dan ketiga email penghuni. Email pertama menjadi **owner**; dua lainnya menjadi **member**.
3. Jalankan skrip di **Supabase Dashboard → SQL Editor**.
4. Periksa hasil `select` di akhir: harus muncul tiga baris anggota dengan peran yang benar.

Skrip ini berada di luar `supabase/migrations/` sehingga tidak ikut ter-push oleh `db push`. Penambahan anggota bersifat idempoten (`on conflict do nothing`), tetapi pembuatan rumah tidak — jalankan sekali saja.

## Struktur utama

- `src/app/(auth)/login` — login email/password dan setup state.
- `src/app/(protected)` — route Hari Ini, Tugas, Belanja, dan Rumah.
- `src/components/layout` — mobile shell dan bottom navigation.
- `src/lib/supabase` — browser dan server client Supabase SSR.
- `src/lib/household.ts` — resolve rumah tangga aktif pengguna (server-only).
- `src/features/tasks` — fitur Tugas: skema Zod, server action, dan komponen jadwal/kelola tugas.
- `src/proxy.ts` — refresh session dan proteksi route.
- `src/features/auth/passkeys` — module passkey yang terisolasi.
- `supabase/migrations` — schema PostgreSQL dan policy RLS.

## Passkey (WebAuthn)

`NEXT_PUBLIC_ENABLE_PASSKEYS=false` adalah default. Saat `false`, `/login` tidak
menampilkan tombol passkey dan `/profil` hanya menampilkan penjelasannya;
email/password selalu menjadi jalur utama.

Saat `true`, `/login` menampilkan **Masuk dengan passkey**
(`auth.signInWithPasskey`) dan `/profil` menampilkan daftar passkey akun:
tambah (`auth.registerPasskey`), ganti nama (`auth.passkey.update`), cabut
(`auth.passkey.delete`). Seluruh panggilan berjalan di browser tanpa server
action, sehingga tidak ada rahasia server yang dipakai untuk fitur ini.

Tiga syarat agar seremoni berhasil:

1. `passkey_enabled` aktif di **Authentication → Passkeys**, dengan
   `webauthn_rp_id` = bare domain yang sedang diakses (contoh `uchi.example.com`,
   bukan URL) dan `webauthn_rp_origins` = origin persis aplikasi tanpa trailing
   slash, maksimum 5 entri.
2. Halaman berada di secure context: `https://...` atau `http://localhost`.
   Alamat IP LAN (`http://192.168.x.x:3000`) ditolak browser, jadi passkey tidak
   bisa diuji dari ponsel lewat LAN.
3. Akun Auth sudah terkonfirmasi dan bukan anonim.

Variabel ini di-inline saat **build**, jadi mengubahnya di dashboard Vercel
tanpa redeploy tidak berpengaruh ke bundle browser.

> **Perubahan `webauthn_rp_id` membatalkan seluruh passkey yang sudah
> terdaftar.** Karena itu flag hanya boleh `true` di environment yang RP ID dan
> origin-nya sudah final. Uji lokal memakai RP ID `localhost`; passkey hasil uji
> tersebut harus didaftarkan ulang di domain produksi (akun dan password tidak
> terpengaruh, jadi tidak ada penghuni yang terkunci).
