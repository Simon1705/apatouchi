-- =============================================================================
-- Seed kategori pengeluaran bersama (skrip sekali jalan, BUKAN migration)
-- =============================================================================
-- Tujuan: mengisi kategori awal agar form "Catat pengeluaran" langsung berguna.
--
-- Mengapa di luar folder migrations/
--   Skrip ini memasukkan DATA yang bergantung pada UUID household nyata.
--   `supabase db push` akan mengulang migration di project lain (mis. staging),
--   sehingga seed tidak boleh ikut di sana.
--
-- Cara pakai
--   1. Migration 202610250001_money_management.sql sudah di-push.
--   2. Ganti HOUSE_NAME agar sama persis dengan nama rumah di `public.households`
--      (bootstrap awal memakai 'Mariteto 5').
--   3. Jalankan di Supabase Dashboard -> SQL Editor (role `postgres`, RLS ter-bypass).
--   4. Lihat SELECT di akhir untuk memastikan kategori masuk.
--
-- Catatan idempotensi
--   Aman diulang: konflik pada unique (household_id, lower(name)) dilewati.
--   Kategori yang sudah ada tidak diganti namanya; hapus lewat aplikasi bila perlu.
-- =============================================================================

do $$
declare
  -- ==== ISI BAGIAN INI =======================================================
  house_name text := 'Mariteto 5';
  -- ===========================================================================

  target_household_id uuid;
  owner_id            uuid;
begin
  select id into target_household_id from public.households where name = house_name;

  if target_household_id is null then
    raise exception 'Household tidak ditemukan dengan nama: %', house_name;
  end if;

  -- created_by wajib diisi (NOT NULL) dan harus penghuni rumah yang sama.
  select user_id into owner_id
  from public.household_members
  where household_id = target_household_id and role = 'owner'
  limit 1;

  if owner_id is null then
    raise exception 'Tidak ada owner pada household: %', house_name;
  end if;

  insert into public.money_categories (household_id, name, created_by)
  values
    (target_household_id, 'Listrik', owner_id),
    (target_household_id, 'Gas', owner_id),
    (target_household_id, 'Air', owner_id),
    (target_household_id, 'Internet', owner_id),
    (target_household_id, 'Kantong sampah', owner_id),
    (target_household_id, 'Sabun & pembersih', owner_id),
    (target_household_id, 'Makan bersama', owner_id),
    (target_household_id, 'Lain-lain', owner_id)
  on conflict (household_id, lower(name)) do nothing;
end $$;

-- Verifikasi: daftar kategori aktif per rumah (tanpa hardcode nama di sini).
select
  h.name   as rumah,
  c.name   as kategori,
  c.is_active as aktif
from public.money_categories as c
join public.households as h on h.id = c.household_id
order by h.name, c.name;
