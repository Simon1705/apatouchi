begin;

-- Fitur "Kelola Uang Bersama": kas tunai rumah, patungan per ronde, dan pengeluaran.
-- Mata uang tunggal JPY disimpan sebagai integer (yen tidak punya subunit), jadi tidak
-- ada pembulatan float dan saldo cukup satu agregat sum(amount_jpy).

create type public.money_obligation_kind as enum ('dues', 'bill');
-- 'expense'  = uang benar-benar keluar dari kaleng kas.
-- 'advance'  = pengeluaran bersama yang dibayar uang pribadi: TIDAK mengubah saldo kas,
--              tapi membuat talangan yang harus dikembalikan. Karena itu view saldo
--              menyaring kind ini; tanpa pembedaan, setiap pengeluaran kas akan terbaca
--              sebagai utang ke orang yang mencatatnya.
create type public.money_transaction_kind as enum
  ('dues', 'expense', 'advance', 'refund', 'adjustment');

-- Satu baris = satu kali patungan ("kalau habis, setor lagi"). Nominal disimpan per
-- ronde karena ¥5.000 yang dipakai sekarang bisa berubah kapan saja; tidak ada config
-- iuran global dan tidak ada jadwal tetap.
create table public.money_rounds (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  label text not null check (char_length(trim(label)) between 2 and 60),
  amount_per_person_jpy integer not null check (
    amount_per_person_jpy between 100 and 1000000
  ),
  opened_on date not null default current_date,
  closed_on date,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint money_rounds_id_household_key unique (id, household_id),
  constraint money_rounds_period_check check (
    closed_on is null or closed_on >= opened_on
  )
);

-- "Ronde aktif" harus deterministik: hanya satu ronde yang belum ditutup per rumah.
create unique index money_rounds_one_open_idx
  on public.money_rounds (household_id) where closed_on is null;
create index money_rounds_created_by_idx on public.money_rounds (created_by);

create table public.money_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 60),
  is_active boolean not null default true,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint money_categories_id_household_key unique (id, household_id)
);

-- Nama kategori seragam tanpa mempedulikan huruf besar/kecil.
create unique index money_categories_household_lower_name_key
  on public.money_categories (household_id, lower(name));
create index money_categories_household_active_idx
  on public.money_categories (household_id, is_active);

-- "Harus bayar apa/siapa". Lunas atau tidak TIDAK disimpan di sini: kolom ini hanya
-- mencatat kewajibannya, sedangkan pelunasan dilihat dari money_transactions yang
-- menunjuk baris ini. Dengan begitu satu-satunya cara mencatat uang adalah satu
-- INSERT transaksi, sehingga tidak ada keadaan setengah jadi (transaksi tercatat
-- tapi status lupa diubah) yang bikin saldo dan daftar tidak cocok.
create table public.money_obligations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  kind public.money_obligation_kind not null,
  title text not null check (char_length(trim(title)) between 2 and 120),
  amount_jpy integer not null check (amount_jpy between 1 and 10000000),
  member_id uuid references public.profiles (id) on delete restrict,
  round_id uuid,
  category_id uuid,
  -- Tanggal bebas: penghuni sepakat tidak ada tanggal main tetap untuk iuran.
  due_on date,
  note text check (note is null or char_length(note) <= 500),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint money_obligations_round_household_fkey
    foreign key (round_id, household_id)
    references public.money_rounds (id, household_id) on delete cascade,
  constraint money_obligations_category_household_fkey
    foreign key (category_id, household_id)
    references public.money_categories (id, household_id) on delete restrict,
  constraint money_obligations_id_household_key unique (id, household_id),
  -- Iuran selalu milik satu orang di satu ronde; tagihan umum tidak butuh keduanya.
  constraint money_obligations_kind_shape_check check (
    (kind = 'dues' and member_id is not null and round_id is not null)
    or (kind = 'bill')
  )
);

-- Sekali iuran per orang per ronde. Menjadikan aksi "mulai patungan" idempoten:
-- ditekan dua kali tidak melahirkan dua baris tagihan untuk orang yang sama.
create unique index money_obligations_dues_round_key
  on public.money_obligations (round_id, member_id) where kind = 'dues';
create index money_obligations_household_kind_due_idx
  on public.money_obligations (household_id, kind, due_on);
create index money_obligations_member_idx on public.money_obligations (member_id);
create index money_obligations_created_by_idx on public.money_obligations (created_by);

-- Perpindahan uang yang benar-benar terjadi. Ini sumber kebenaran saldo.
create table public.money_transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  occurred_on date not null,
  kind public.money_transaction_kind not null,
  -- Bertanda terhadap kas: iuran masuk positif, pengeluaran dan pengembalian talangan
  -- negatif, koreksi bebas tanda. CHECK di bawah menjaga tanda tetap konsisten dengan
  -- jenisnya sehingga angka tidak pernah "terbalik" akibat salah input.
  amount_jpy integer not null check (
    amount_jpy between -10000000 and 10000000 and amount_jpy <> 0
  ),
  -- Siapa yang menyerahkan/menerima uang secara fisik.
  paid_by uuid not null references public.profiles (id) on delete restrict,
  -- Hanya terisi untuk pengembalian talangan: siapa yang dibayar kembali.
  member_id uuid references public.profiles (id) on delete restrict,
  category_id uuid,
  obligation_id uuid,
  -- Jumlah orang yang menanggung pengeluaran bersama; default diisi jumlah penghuni
  -- oleh Server Action, bukan dari klien, agar tidak bisa dimanipulasi.
  split_count smallint not null default 3 check (split_count between 1 and 9),
  note text check (note is null or char_length(note) <= 500),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint money_transactions_category_household_fkey
    foreign key (category_id, household_id)
    references public.money_categories (id, household_id) on delete restrict,
  constraint money_transactions_obligation_household_fkey
    foreign key (obligation_id, household_id)
    references public.money_obligations (id, household_id) on delete set null,
  constraint money_transactions_id_household_key unique (id, household_id),
  constraint money_transactions_kind_sign_check check (
    (kind = 'dues' and amount_jpy > 0)
    or (kind in ('expense', 'advance', 'refund') and amount_jpy < 0)
    or (kind = 'adjustment')
  ),
  constraint money_transactions_refund_member_check check (
    kind <> 'refund' or member_id is not null
  )
);

create index money_transactions_household_date_idx
  on public.money_transactions (household_id, occurred_on desc, created_at desc);
create index money_transactions_household_kind_idx
  on public.money_transactions (household_id, kind);
create index money_transactions_paid_by_idx on public.money_transactions (paid_by);
create index money_transactions_obligation_idx
  on public.money_transactions (obligation_id) where obligation_id is not null;
create index money_transactions_created_by_idx on public.money_transactions (created_by);

comment on column public.money_transactions.amount_jpy is
  'Signed against the shared cash box: dues positive, expense/advance/refund negative, adjustment either. balance_jpy in money_balances ignores advance.';
comment on column public.money_transactions.split_count is
  'Berapa orang yang menanggung pengeluaran bersama; diisi Server Action dari jumlah penghuni.';
comment on column public.money_obligations.id is
  'Ditelusuri lewat money_transactions.obligation_id; lunas diturunkan, tidak disimpan.';

-- Saldo tunggal kas rumah: hanya jenis yang benar-benar memindahkan uang tunai yang
-- dihitung, sehingga 'advance' (uang pribadi) tidak mengubah saldo kaleng.
create view public.money_balances
with (security_invoker = true) as
select
  t.household_id,
  coalesce(sum(t.amount_jpy) filter (where t.kind = 'dues'), 0)::integer as dues_in_jpy,
  coalesce(-sum(t.amount_jpy) filter (where t.kind = 'expense'), 0)::integer as spent_jpy,
  coalesce(-sum(t.amount_jpy) filter (where t.kind = 'advance'), 0)::integer as advanced_jpy,
  coalesce(-sum(t.amount_jpy) filter (where t.kind = 'refund'), 0)::integer as refunded_jpy,
  coalesce(sum(t.amount_jpy) filter (where t.kind = 'adjustment'), 0)::integer as adjusted_jpy,
  coalesce(sum(t.amount_jpy) filter (where t.kind <> 'advance'), 0)::integer as balance_jpy
from public.money_transactions as t
group by t.household_id;

-- security_invoker = true itu wajib: view default dijalankan dengan hak pemiliknya
-- (postgres) sehingga akan membocorkan transaksi seluruh rumah. Dengan opsi ini
-- kebijakan RLS money_transactions tetap berlaku bagi pemanggil.
comment on view public.money_balances is
  'Saldo kas per rumah; hanya kind dues/expense/refund/adjustment yang dihitung.';

-- Trigger identitas + updated_at mengikuti pola skema awal.
create trigger money_rounds_enforce_identity before update on public.money_rounds
  for each row execute function private.enforce_immutable_columns(
    'id', 'household_id', 'created_by', 'created_at',
    'label', 'amount_per_person_jpy', 'opened_on'
  );
create trigger money_categories_enforce_identity before update on public.money_categories
  for each row execute function private.enforce_immutable_columns(
    'id', 'household_id', 'created_by', 'created_at'
  );
create trigger money_obligations_enforce_identity before update on public.money_obligations
  for each row execute function private.enforce_immutable_columns(
    'id', 'household_id', 'kind', 'member_id', 'round_id', 'created_by', 'created_at'
  );
create trigger money_transactions_enforce_identity before update on public.money_transactions
  for each row execute function private.enforce_immutable_columns(
    'id', 'household_id', 'kind', 'created_by', 'created_at'
  );

create trigger money_rounds_set_updated_at before update on public.money_rounds
  for each row execute function public.set_updated_at();
create trigger money_categories_set_updated_at before update on public.money_categories
  for each row execute function public.set_updated_at();
create trigger money_obligations_set_updated_at before update on public.money_obligations
  for each row execute function public.set_updated_at();
create trigger money_transactions_set_updated_at before update on public.money_transactions
  for each row execute function public.set_updated_at();

alter table public.money_rounds enable row level security;
alter table public.money_categories enable row level security;
alter table public.money_obligations enable row level security;
alter table public.money_transactions enable row level security;

-- Uang bersama adalah urusan tiga orang yang setara: berbeda dari jadwal sampah,
-- semua penghuni boleh mencatat, bukan hanya pemilik rumah.

create policy "money_rounds_select_members"
on public.money_rounds for select to authenticated
using (private.is_household_member(household_id));

create policy "money_rounds_insert_creator"
on public.money_rounds for insert to authenticated
with check (created_by = auth.uid() and private.is_household_member(household_id));

-- Menutup patungan (mengisi closed_on) adalah aksi bersama, jadi semua penghuni boleh
-- UPDATE ronde. Aman karena trigger identitas di atas mengunci seluruh kolom lain:
-- satu-satunya perubahan yang mungkin adalah closed_on.
create policy "money_rounds_update_members"
on public.money_rounds for update to authenticated
using (private.is_household_member(household_id))
with check (private.is_household_member(household_id));

create policy "money_rounds_delete_creator_owner"
on public.money_rounds for delete to authenticated
using (
  private.is_household_member(household_id)
  and (created_by = auth.uid() or private.is_household_owner(household_id))
);

create policy "money_categories_select_members"
on public.money_categories for select to authenticated
using (private.is_household_member(household_id));

create policy "money_categories_insert_creator"
on public.money_categories for insert to authenticated
with check (created_by = auth.uid() and private.is_household_member(household_id));

create policy "money_categories_update_creator_owner"
on public.money_categories for update to authenticated
using (
  private.is_household_member(household_id)
  and (created_by = auth.uid() or private.is_household_owner(household_id))
)
with check (private.is_household_member(household_id));

create policy "money_categories_delete_creator_owner"
on public.money_categories for delete to authenticated
using (
  private.is_household_member(household_id)
  and (created_by = auth.uid() or private.is_household_owner(household_id))
);

create policy "money_obligations_select_members"
on public.money_obligations for select to authenticated
using (private.is_household_member(household_id));

create policy "money_obligations_insert_member"
on public.money_obligations for insert to authenticated
with check (
  created_by = auth.uid()
  and private.is_household_member(household_id)
  and (
    member_id is null
    or exists (
      select 1 from public.household_members as dues_membership
      where dues_membership.household_id = money_obligations.household_id
        and dues_membership.user_id = money_obligations.member_id
    )
  )
  and (
    round_id is null
    or exists (
      select 1 from public.money_rounds as open_round
      where open_round.id = money_obligations.round_id
        and open_round.household_id = money_obligations.household_id
    )
  )
);

create policy "money_obligations_update_creator_owner"
on public.money_obligations for update to authenticated
using (
  private.is_household_member(household_id)
  and (created_by = auth.uid() or private.is_household_owner(household_id))
)
with check (private.is_household_member(household_id));

create policy "money_obligations_delete_creator_owner"
on public.money_obligations for delete to authenticated
using (
  private.is_household_member(household_id)
  and (created_by = auth.uid() or private.is_household_owner(household_id))
);

create policy "money_transactions_select_members"
on public.money_transactions for select to authenticated
using (private.is_household_member(household_id));

create policy "money_transactions_insert_member"
on public.money_transactions for insert to authenticated
with check (
  created_by = auth.uid()
  and private.is_household_member(household_id)
  and exists (
    select 1 from public.household_members as payer_membership
    where payer_membership.household_id = money_transactions.household_id
      and payer_membership.user_id = money_transactions.paid_by
  )
  and (
    member_id is null
    or exists (
      select 1 from public.household_members as refund_membership
      where refund_membership.household_id = money_transactions.household_id
        and refund_membership.user_id = money_transactions.member_id
    )
  )
);

-- Sengaja tidak ada policy UPDATE untuk transaksi: koreksi dilakukan dengan menghapus
-- lalu mencatat ulang, supaya riwayat uang tidak berubah diam-diam.

create policy "money_transactions_delete_creator_owner"
on public.money_transactions for delete to authenticated
using (
  private.is_household_member(household_id)
  and (created_by = auth.uid() or private.is_household_owner(household_id))
);

revoke all on table public.money_rounds, public.money_categories,
  public.money_obligations, public.money_transactions,
  public.money_balances from anon;

grant select, insert, update, delete on table public.money_rounds,
  public.money_categories, public.money_obligations, public.money_transactions
  to authenticated;

grant select on public.money_balances to authenticated;

commit;
