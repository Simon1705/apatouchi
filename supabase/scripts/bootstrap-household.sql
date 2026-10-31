-- =============================================================================
-- Bootstrap rumah tangga pertama (skrip sekali jalan, BUKAN migration)
-- =============================================================================
-- Tujuan: membuat satu household dan mendaftarkan tiga penghuni sebagai anggota.
--
-- Mengapa di luar folder migrations/
--   Skrip ini memasukkan DATA (bukan schema) yang bergantung pada UUID akun
--   nyata, sehingga tidak boleh ikut ter-push otomatis oleh `supabase db push`.
--   Jalankan manual sekali saja melalui Supabase Dashboard -> SQL Editor.
--
-- Prasyarat
--   1. Migration awal sudah di-push (`npx supabase db push`).
--   2. Tiga akun Auth sudah dibuat di Dashboard (Authentication -> Users).
--      Trigger `handle_new_user` otomatis membuat baris `public.profiles` untuk
--      setiap akun, sehingga `profiles.id = auth.users.id`.
--
-- Cara pakai
--   1. Ganti HOUSE_NAME dan ketiga email di bawah.
--      Email pertama menjadi OWNER (pembuat rumah); dua lainnya menjadi MEMBER.
--   2. Jalankan skrip ini di SQL Editor. Editor berjalan sebagai role `postgres`
--      sehingga Row Level Security ter-bypass dan owner dapat menambahkan
--      anggota tanpa perlu mengetahui UUID profil mereka.
--   3. Periksa hasil SELECT di akhir: harus muncul tiga baris anggota.
--
-- Catatan idempotensi
--   Penambahan anggota memakai ON CONFLICT DO NOTHING (aman bila diulang).
--   Pembuatan household TIDAK idempoten — jalankan sekali, atau sesuaikan bila
--   memang sengaja membuat rumah tambahan.
-- =============================================================================

do $$
declare
  -- ==== ISI BAGIAN INI =======================================================
  house_name     text := 'Mariteto 5';           -- nama rumah
  owner_email    text := 'simon@mariteto5.com'; -- owner / pembuat rumah
  member_email_1 text := 'hanif@mariteto5.com'; -- anggota kedua
  member_email_2 text := 'rasyid@mariteto5.com'; -- anggota ketiga
  -- ===========================================================================

  owner_id         uuid;
  member_id_1      uuid;
  member_id_2      uuid;
  new_household_id uuid;
begin
  select id into owner_id    from auth.users where email = owner_email;
  select id into member_id_1 from auth.users where email = member_email_1;
  select id into member_id_2 from auth.users where email = member_email_2;

  if owner_id is null then
    raise exception 'Akun owner tidak ditemukan untuk email: %', owner_email;
  end if;
  if member_id_1 is null then
    raise exception 'Akun anggota tidak ditemukan untuk email: %', member_email_1;
  end if;
  if member_id_2 is null then
    raise exception 'Akun anggota tidak ditemukan untuk email: %', member_email_2;
  end if;

  -- Trigger `on_household_created` otomatis menambahkan owner sebagai member
  -- dengan role 'owner'.
  insert into public.households (name, created_by)
  values (house_name, owner_id)
  returning id into new_household_id;

  insert into public.household_members (household_id, user_id, role)
  values
    (new_household_id, member_id_1, 'member'),
    (new_household_id, member_id_2, 'member')
  on conflict (household_id, user_id) do nothing;
end $$;

-- Verifikasi: tampilkan anggota rumah beserta role-nya.
select
  h.name         as household,
  p.display_name as anggota,
  u.email        as email,
  m.role         as peran
from public.household_members as m
join public.households as h on h.id = m.household_id
join public.profiles   as p on p.id = m.user_id
join auth.users        as u on u.id = m.user_id
order by h.created_at desc, m.role, p.display_name;
