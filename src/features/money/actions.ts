"use server";

import { revalidatePath } from "next/cache";

import {
  moneyAdjustFormSchema,
  moneyCategoryFormSchema,
  moneyDuesFormSchema,
  moneyExpenseFormSchema,
  moneyIdSchema,
  moneyRefundFormSchema,
  moneyRoundFormSchema,
} from "@/features/money/money-schema";
import type { MoneyMemberRecord } from "@/features/money/types";
import {
  fetchMoneyAdvances,
  fetchMoneyBalance,
  fetchMoneyMembers,
  fetchOpenMoneyRound,
} from "@/features/money/queries";
import { getHouseholdContext, type HouseholdContext } from "@/lib/household";
import { todayInTokyo } from "@/lib/dates";
import { formatMoneyLabel } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

import type { SupabaseClient } from "@supabase/supabase-js";

/** State yang dikembalikan seluruh Server Action fitur Uang Bersama. */
export type MoneyActionState = {
  error?: string;
  ok?: boolean;
};

const SESSION_ERROR =
  "Sesi rumah tidak tersedia. Muat ulang halaman lalu coba lagi.";
const GENERIC_ERROR = "Tidak dapat menyimpan perubahan. Coba beberapa saat lagi.";
const ROSTER_ERROR = "Daftar penghuni tidak dapat dimuat. Muat ulang halaman.";
const DUPLICATE_ROUND_ERROR =
  "Patungan masih berjalan. Selesaikan setoran lebih dulu atau tutup patungan ini.";
const DUPLICATE_CATEGORY_ERROR = "Kategori dengan nama itu sudah ada.";
const TRANSACTION_NOT_FOUND_ERROR =
  "Catatan tidak ditemukan — mungkin sudah dihapus. Muat ulang halaman.";
const TRANSACTION_FORBIDDEN_ERROR =
  "Catatan ini hanya dapat dihapus oleh pembuatnya atau pemilik rumah.";

/**
 * Batas `split_count` pada check constraint (1..9); jumlah penghuni nyata selalu
 * di dalamnya, tapi nilai tetap diklaim agar insert tidak pernah ditolak database.
 */
const MAX_SPLIT_COUNT = 9;

type MoneySession = {
  context: HouseholdContext;
  supabase: SupabaseClient;
};

/**
 * Menyiapkan konteks rumah + client Supabase.
 *
 * Berbeda dari jadwal sampah, tidak ada syarat owner: mencatat uang bersama adalah
 * aksi setara antar penghuni, dan yang memegang uang fisik bisa bergantian.
 */
async function requireMoneySession(): Promise<MoneySession | null> {
  const context = await getHouseholdContext();

  if (!context) {
    return null;
  }

  const supabase = await createClient();

  if (!supabase) {
    return null;
  }

  return { context, supabase };
}

/**
 * Menyegarkan layar yang menampilkan angka uang.
 *
 * Uang bersama muncul di tiga tempat: halamannya sendiri, subtitle menu Rumah
 * (saldo), dan strip Hari Ini (saldo + belum setor). Aksi yang tidak memindahkan
 * uang tunai — membuka atau menutup patungan — tidak mengubah saldo, jadi subtitle
 * Rumah dilewati. Dipusatkan dalam satu fungsi karena jalur tulis yang tersebar
 * mudah lupa menyegarkan satu layar.
 */
function revalidateMoneyViews({ cashMoved = true }: { cashMoved?: boolean } = {}) {
  revalidatePath("/rumah/uang");
  revalidatePath("/hari-ini");

  if (cashMoved) {
    revalidatePath("/rumah");
  }
}

/** Mengambil pesan validasi pertama agar actionable dan dekat dengan field. */
function firstIssueMessage(
  error: { issues: { message: string }[] },
  fallback: string,
) {
  return error.issues[0]?.message ?? fallback;
}

/** Memecah `amount_jpy` string hasil form menjadi angka. */
function toAmount(value: string) {
  return Number.parseInt(value, 10);
}

/**
 * Membuka ronde patungan baru: satu baris ronde + satu baris tagihan iuran per penghuni.
 *
 * Tagihan iuran dibuat sekali jalan (satu INSERT multi-baris) agar atomic. Bila
 * pembuatan tagihan gagal, ronde yang baru dibuat dihapus lagi — tanpa langkah
 * kompensi ini, index partial "satu ronde terbuka" akan membuat pengguna tidak bisa
 * membuka patungan sama sekali.
 */
export async function openMoneyRound(
  formData: FormData,
): Promise<MoneyActionState> {
  const session = await requireMoneySession();

  if (!session) {
    return { error: SESSION_ERROR };
  }

  const result = moneyRoundFormSchema.safeParse({
    label: formData.get("label"),
    amountPerPersonJpy: formData.get("amountPerPersonJpy"),
  });

  if (!result.success) {
    return {
      error: firstIssueMessage(result.error, "Periksa nama dan nominal patungan."),
    };
  }

  const { context, supabase } = session;
  const membersResult = await fetchMoneyMembers(supabase);

  if (membersResult.error || membersResult.members.length === 0) {
    return { error: ROSTER_ERROR };
  }

  const { data: createdRound, error: roundError } = await supabase
    .from("money_rounds")
    .insert({
      household_id: context.householdId,
      created_by: context.userId,
      label: result.data.label,
      amount_per_person_jpy: toAmount(result.data.amountPerPersonJpy),
    })
    .select("id")
    .single();

  if (roundError) {
    if (roundError.code === "23505") {
      return { error: DUPLICATE_ROUND_ERROR };
    }

    return { error: GENERIC_ERROR };
  }

  const duesRows = membersResult.members.map((member: MoneyMemberRecord) => ({
    household_id: context.householdId,
    kind: "dues",
    // Judul mengikuti label ronde agar riwayat mudah dibaca tanpa membuka detail.
    title: `Iuran ${result.data.label}`,
    amount_jpy: toAmount(result.data.amountPerPersonJpy),
    member_id: member.id,
    round_id: createdRound.id,
    created_by: context.userId,
  }));

  const { error: duesError } = await supabase.from("money_obligations").insert(duesRows);

  if (duesError) {
    await supabase.from("money_rounds").delete().eq("id", createdRound.id);

    return duesError.code === "23505"
      ? { error: DUPLICATE_ROUND_ERROR }
      : { error: GENERIC_ERROR };
  }

  revalidateMoneyViews({ cashMoved: false });
  return { ok: true };
}

/**
 * Menutup ronde patungan agar ronde baru bisa dibuka.
 *
 * Hanya `closed_on` yang ditulis; kolom ronde lain dikunci trigger identitas,
 * jadi semua penghuni aman diberi hak UPDATE pada tabel ini.
 */
export async function closeMoneyRound(
  formData: FormData,
): Promise<MoneyActionState> {
  const session = await requireMoneySession();

  if (!session) {
    return { error: SESSION_ERROR };
  }

  const roundId = String(formData.get("roundId") ?? "");

  if (!moneyIdSchema.safeParse(roundId).success) {
    return { error: "Patungan tidak ditemukan atau sudah ditutup. Muat ulang halaman." };
  }

  const { supabase } = session;
  const { data, error } = await supabase
    .from("money_rounds")
    .update({ closed_on: todayInTokyo() })
    .eq("id", roundId)
    .is("closed_on", null)
    .select("id");

  if (error) {
    return { error: GENERIC_ERROR };
  }

  // RLS membuat update yang tidak diizinkan menjadi no-op tanpa error.
  if (!data || data.length === 0) {
    return { error: "Patungan tidak ditemukan atau sudah ditutup. Muat ulang halaman." };
  }

  revalidateMoneyViews({ cashMoved: false });
  return { ok: true };
}

/**
 * Mencatat setoran uang ke kaleng kas.
 *
 * Bila penghuni punya tagihan iuran yang belum lunas pada ronde aktif, transaksi
 * ditautkan ke tagihan itu agar status papan ikut berubah; setoran tambahan atau
 * setoran tanpa patungan berjalan tetap tercatat (tanpa tautan).
 */
export async function recordMoneyDues(
  formData: FormData,
): Promise<MoneyActionState> {
  const session = await requireMoneySession();

  if (!session) {
    return { error: SESSION_ERROR };
  }

  const result = moneyDuesFormSchema.safeParse({
    amountJpy: formData.get("amountJpy"),
    memberId: formData.get("memberId"),
    occurredOn: formData.get("occurredOn"),
    note: formData.get("note"),
  });

  if (!result.success) {
    return {
      error: firstIssueMessage(result.error, "Periksa nominal dan penghuni yang setor."),
    };
  }

  const { context, supabase } = session;
  const amountJpy = toAmount(result.data.amountJpy);
  const obligationId = await findOpenDuesObligation(
    supabase,
    context.householdId,
    result.data.memberId,
  );

  const { error } = await supabase.from("money_transactions").insert({
    household_id: context.householdId,
    created_by: context.userId,
    kind: "dues",
    amount_jpy: amountJpy,
    paid_by: result.data.memberId,
    occurred_on: result.data.occurredOn,
    obligation_id: obligationId,
    note: result.data.note === "" ? null : result.data.note,
  });

  if (error) {
    return { error: GENERIC_ERROR };
  }

  revalidateMoneyViews();
  return { ok: true };
}

/**
 * Mencatat pengeluaran bersama.
 *
 * `source = box` mengurangi saldo kaleng (`kind = 'expense'`), sedangkan
 * `source = personal` tidak menyentuh saldo tapi menimbulkan talangan
 * (`kind = 'advance'`). `split_count` diambil dari jumlah penghuni di server,
 * bukan dari form, supaya pembagian tidak bisa diubah dari klien.
 */
export async function recordMoneyExpense(
  formData: FormData,
): Promise<MoneyActionState> {
  const session = await requireMoneySession();

  if (!session) {
    return { error: SESSION_ERROR };
  }

  const result = moneyExpenseFormSchema.safeParse({
    amountJpy: formData.get("amountJpy"),
    memberId: formData.get("memberId"),
    categoryId: formData.get("categoryId"),
    source: formData.get("source"),
    occurredOn: formData.get("occurredOn"),
    note: formData.get("note"),
  });

  if (!result.success) {
    return {
      error: firstIssueMessage(result.error, "Periksa nominal dan sumber pengeluaran."),
    };
  }

  const { context, supabase } = session;
  const membersResult = await fetchMoneyMembers(supabase);

  if (membersResult.error || membersResult.members.length === 0) {
    return { error: ROSTER_ERROR };
  }

  const amountJpy = toAmount(result.data.amountJpy);
  const fromCashBox = result.data.source === "box";

  const { error } = await supabase.from("money_transactions").insert({
    household_id: context.householdId,
    created_by: context.userId,
    kind: fromCashBox ? "expense" : "advance",
    amount_jpy: -amountJpy,
    paid_by: result.data.memberId,
    occurred_on: result.data.occurredOn,
    category_id: result.data.categoryId === "" ? null : result.data.categoryId,
    split_count: Math.min(membersResult.members.length, MAX_SPLIT_COUNT),
    note: result.data.note === "" ? null : result.data.note,
  });

  if (error) {
    return { error: GENERIC_ERROR };
  }

  revalidateMoneyViews();
  return { ok: true };
}

/**
 * Mengembalikan uang pribadi penghuni yang terpakai untuk kebutuhan bersama.
 *
 * Nominal maksimum dihitung ulang dari database (`fetchMoneyAdvances`) dan saldo
 * dibaca ulang dari view: form hanya memilih orang, tidak pernah menentukan batas
 * angka. Dua guard ini yang menjaga kaleng tidak pernah mencatat pembayaran lebih
 * besar dari talangan atau lebih besar dari uang tunai yang ada di dalamnya.
 */
export async function refundMoneyAdvance(
  formData: FormData,
): Promise<MoneyActionState> {
  const session = await requireMoneySession();

  if (!session) {
    return { error: SESSION_ERROR };
  }

  const result = moneyRefundFormSchema.safeParse({
    amountJpy: formData.get("amountJpy"),
    memberId: formData.get("memberId"),
    paidBy: formData.get("paidBy"),
    occurredOn: formData.get("occurredOn"),
    note: formData.get("note"),
  });

  if (!result.success) {
    return {
      error: firstIssueMessage(result.error, "Periksa nominal dan orang yang dibayar."),
    };
  }

  const { context, supabase } = session;
  const amountJpy = toAmount(result.data.amountJpy);
  const [advancesResult, balanceResult] = await Promise.all([
    fetchMoneyAdvances(supabase, context.householdId),
    fetchMoneyBalance(supabase, context.householdId),
  ]);

  if (advancesResult.error) {
    return { error: advancesResult.error };
  }

  if (balanceResult.error) {
    return { error: balanceResult.error };
  }

  const entry = advancesResult.advances.find(
    (advance) => advance.member_id === result.data.memberId,
  );

  if (!entry) {
    return {
      error: "Talangan orang ini tidak ditemukan atau sudah lunas. Muat ulang halaman.",
    };
  }

  if (amountJpy > entry.outstanding_jpy) {
    return {
      error: `Pengembalian melebihi talangan ${entry.member_name} (${formatMoneyLabel(entry.outstanding_jpy)}). Pakai nominal itu atau lebih kecil.`,
    };
  }

  if (amountJpy > balanceResult.balance.balance_jpy) {
    return {
      error: `Isi kaleng ${formatMoneyLabel(balanceResult.balance.balance_jpy)} tidak cukup untuk mengembalikan ${formatMoneyLabel(amountJpy)}. Tambah uang ke kas lebih dulu.`,
    };
  }

  const { error } = await supabase.from("money_transactions").insert({
    household_id: context.householdId,
    created_by: context.userId,
    kind: "refund",
    // Tanda negatif diterapkan di sini, bukan di form, supaya pengguna selalu
    // mengetik angka positif dan tidak bisa membalik arah uang.
    amount_jpy: -amountJpy,
    paid_by: result.data.paidBy,
    member_id: result.data.memberId,
    occurred_on: result.data.occurredOn,
    note: result.data.note === "" ? null : result.data.note,
  });

  if (error) {
    return { error: GENERIC_ERROR };
  }

  revalidateMoneyViews();
  return { ok: true };
}

/**
 * Menghapus satu catatan uang supaya bisa dicatat ulang dengan benar.
 *
 * Transaksi sengaja tidak punya policy UPDATE (riwayat uang tidak boleh berubah
 * diam-diam), jadi koreksi = hapus lalu catat ulang. Policy
 * `money_transactions_delete_creator_owner` membatasi hapus pada pembuatnya atau
 * pemilik rumah. Baris dibaca dulu supaya pesan error bisa membedakan "sudah
 * dihapus" dan "bukan hak Anda", dan karena RLS mengubah delete yang tidak
 * diizinkan menjadi no-op tanpa error, jumlah baris terdampak tetap diperiksa.
 */
export async function deleteMoneyTransaction(
  formData: FormData,
): Promise<MoneyActionState> {
  const session = await requireMoneySession();

  if (!session) {
    return { error: SESSION_ERROR };
  }

  const transactionId = String(formData.get("transactionId") ?? "");

  if (!moneyIdSchema.safeParse(transactionId).success) {
    return { error: TRANSACTION_NOT_FOUND_ERROR };
  }

  const { context, supabase } = session;
  const { data: existing } = await supabase
    .from("money_transactions")
    .select("id, created_by")
    .eq("id", transactionId)
    .eq("household_id", context.householdId)
    .maybeSingle<{ id: string; created_by: string }>();

  if (!existing) {
    return { error: TRANSACTION_NOT_FOUND_ERROR };
  }

  if (existing.created_by !== context.userId && context.role !== "owner") {
    return { error: TRANSACTION_FORBIDDEN_ERROR };
  }

  const { data, error } = await supabase
    .from("money_transactions")
    .delete()
    .eq("id", transactionId)
    .eq("household_id", context.householdId)
    .select("id");

  if (error) {
    return { error: GENERIC_ERROR };
  }

  if (!data || data.length === 0) {
    return { error: TRANSACTION_FORBIDDEN_ERROR };
  }

  revalidateMoneyViews();
  return { ok: true };
}

/**
 * Menyamakan catatan saldo dengan uang tunai hasil hitungan ("hitung kas").
 *
 * Selisih dihitung dari saldo di database saat aksi berjalan, bukan dari angka yang
 * tampak di layar klien: kalau penghuni lain mencatat transaksi di antaranya, hasil
 * akhirnya tetap sama, yaitu saldo catatan = uang yang dihitung. Selisih nol ditolak
 * agar riwayat tidak dipenuhi baris yang tidak mengubah apa pun.
 */
export async function reconcileMoneyCash(
  formData: FormData,
): Promise<MoneyActionState> {
  const session = await requireMoneySession();

  if (!session) {
    return { error: SESSION_ERROR };
  }

  const result = moneyAdjustFormSchema.safeParse({
    countedAmountJpy: formData.get("countedAmountJpy"),
    occurredOn: formData.get("occurredOn"),
    note: formData.get("note"),
  });

  if (!result.success) {
    return {
      error: firstIssueMessage(result.error, "Periksa hasil hitungan dan alasannya."),
    };
  }

  const { context, supabase } = session;
  const { balance, error } = await fetchMoneyBalance(supabase, context.householdId);

  if (error) {
    return { error };
  }

  const deltaJpy = toAmount(result.data.countedAmountJpy) - balance.balance_jpy;

  if (deltaJpy === 0) {
    return {
      error: "Tidak ada selisih — isi kaleng sudah sama dengan catatan, jadi tidak ada yang perlu dikoreksi.",
    };
  }

  const { error: insertError } = await supabase.from("money_transactions").insert({
    household_id: context.householdId,
    created_by: context.userId,
    kind: "adjustment",
    amount_jpy: deltaJpy,
    // Yang menghitung uang adalah orang yang memegang kaleng saat itu, jadi
    // `paid_by` diambil dari sesi dan tidak perlu ditanyakan di form.
    paid_by: context.userId,
    occurred_on: result.data.occurredOn,
    note: result.data.note,
  });

  if (insertError) {
    return { error: GENERIC_ERROR };
  }

  revalidateMoneyViews();
  return { ok: true };
}

/** Menambahkan kategori pengeluaran baru. */
export async function addMoneyCategory(
  formData: FormData,
): Promise<MoneyActionState> {
  const session = await requireMoneySession();

  if (!session) {
    return { error: SESSION_ERROR };
  }

  const result = moneyCategoryFormSchema.safeParse({
    name: formData.get("name"),
  });

  if (!result.success) {
    return { error: firstIssueMessage(result.error, "Tulis nama kategori.") };
  }

  const { context, supabase } = session;
  const { error } = await supabase.from("money_categories").insert({
    household_id: context.householdId,
    created_by: context.userId,
    name: result.data.name,
  });

  if (error) {
    return {
      error: error.code === "23505" ? DUPLICATE_CATEGORY_ERROR : GENERIC_ERROR,
    };
  }

  // Nama kategori hanya dipakai di halaman uang (label form dan baris riwayat),
  // jadi sengaja tidak menyentuh revalidateMoneyViews: subtitle Rumah dan strip
  // Hari Ini tidak menampilkan kategori.
  revalidatePath("/rumah/uang");
  return { ok: true };
}

/**
 * Menemukan tagihan iuran yang masih perlu diisi untuk satu penghuni pada ronde aktif.
 *
 * Melanjutkan menautkan setoran pada tagihan yang sudah lunas akan membuat total
 * "settled" melebihi target, jadi tagihan dilewati bila setoran yang sudah masuk
 * mencapai nominalnya. Kegagalan baca dianggap "tidak ada tagihan" sehingga uang
 * tetap bisa dicatat — mencatat kas lebih penting daripada menautkannya.
 */
async function findOpenDuesObligation(
  supabase: SupabaseClient,
  householdId: string,
  memberId: string,
): Promise<string | null> {
  const { round } = await fetchOpenMoneyRound(supabase, householdId);

  if (!round) {
    return null;
  }

  const { data } = await supabase
    .from("money_obligations")
    .select("id, amount_jpy")
    .eq("household_id", householdId)
    .eq("round_id", round.id)
    .eq("member_id", memberId)
    .eq("kind", "dues")
    .maybeSingle<{ id: string; amount_jpy: number }>();

  if (!data) {
    return null;
  }

  const { data: settlements } = await supabase
    .from("money_transactions")
    .select("amount_jpy")
    .eq("household_id", householdId)
    .eq("obligation_id", data.id)
    .eq("kind", "dues");

  const settledJpy = (settlements ?? []).reduce(
    (total, row) => total + row.amount_jpy,
    0,
  );

  // Tautkan selama tagihan belum lunas, meskipun setoran ini membuat totalnya
  // melebihi target: papan akan menampilkan status "Sudah setor" dengan jumlah
  // sebenarnya, dan kelebihan itu tetap terlihat di riwayat.
  return settledJpy < data.amount_jpy ? data.id : null;
}
