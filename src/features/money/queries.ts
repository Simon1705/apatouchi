import type { SupabaseClient } from "@supabase/supabase-js";

import type { MoneyTransactionKind } from "@/features/money/money-schema";
import type {
  MoneyAdvanceEntry,
  MoneyBalanceRecord,
  MoneyCategoryRecord,
  MoneyDuesEntry,
  MoneyMemberRecord,
  MoneyMenuSummary,
  MoneyOverview,
  MoneyRoundRecord,
  MoneyTodaySummary,
  MoneyTransactionRecord,
} from "@/features/money/types";
import { advanceOwedJpy } from "@/lib/money";

const LOAD_ERROR = "Data uang tidak dapat dimuat.";
const ROSTER_ERROR = "Daftar penghuni tidak dapat dimuat.";

/** Saldo nol untuk rumah yang belum punya satu pun transaksi (view tidak mengembalikan baris). */
const EMPTY_BALANCE: MoneyBalanceRecord = {
  dues_in_jpy: 0,
  spent_jpy: 0,
  advanced_jpy: 0,
  refunded_jpy: 0,
  adjusted_jpy: 0,
  balance_jpy: 0,
};

/** Nama cadangan bila embedding `display_name` tidak mengembalikan baris. */
const FALLBACK_MEMBER_NAME = "Penghuni";

/**
 * Riwayat yang ditampilkan di layar uang. Dipilih angka tetap, bukan seluruh tabel,
 * karena halaman ini dipakai tiap hari dan daftar panjang membuat saldo sulit dibaca;
 * filter per bulan masuk slice berikutnya.
 */
const RECENT_TRANSACTION_LIMIT = 20;

// Hint nama constraint wajib dipakai: money_transactions punya dua FK ke profiles
// (paid_by, member_id) dan satu FK komposit ke money_categories — sama seperti
// pola pada slice Tugas.
const TRANSACTION_SELECT =
  "id, occurred_on, kind, amount_jpy, paid_by, obligation_id, category_id, " +
  "split_count, note, created_at, created_by, " +
  "payer:profiles!money_transactions_paid_by_fkey(display_name), " +
  "category:money_categories!money_transactions_category_household_fkey(name)";

const DUES_SELECT =
  "id, member_id, amount_jpy, due_on, " +
  "member:profiles!money_obligations_member_id_fkey(display_name)";

// Talangan dibaca dari dua jenis transaksi yang menunjuk dua FK profiles berbeda,
// jadi kedua hint nama constraint wajib ditulis.
const ADVANCE_SELECT =
  "kind, amount_jpy, paid_by, member_id, split_count, " +
  "payer:profiles!money_transactions_paid_by_fkey(display_name), " +
  "recipient:profiles!money_transactions_member_id_fkey(display_name)";

/** Batas baca riwayat talangan; sama dalamnya dengan setoran iuran. */
const ADVANCE_SCAN_LIMIT = 1000;

function logError(label: string, message: string) {
  console.error(`[money] ${label} gagal`, message);
}

/**
 * Mengambil roster penghuni rumah aktif.
 *
 * Kebijakan `profiles_select_household_peers` membatasi hasil pada penghuni satu
 * rumah, sehingga `profiles` di sini ekuivalen dengan anggota rumah tangga.
 * Duplikasi kecil dengan query serupa di slice aturan rumah disengaja: modul fitur
 * tidak saling mengimpor query.
 */
export async function fetchMoneyMembers(
  supabase: SupabaseClient,
): Promise<{ members: MoneyMemberRecord[]; error: string | null }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name")
    .order("display_name");

  if (error) {
    logError("fetchMoneyMembers", error.message);
    return { members: [], error: ROSTER_ERROR };
  }

  return { members: (data ?? []) as unknown as MoneyMemberRecord[], error: null };
}

/**
 * Mengambil saldo kas rumah dari view `money_balances`.
 *
 * View mengembalikan nol baris bila rumah belum punya transaksi sama sekali,
 * jadi hasil dinormalisasi ke saldo nol agar pemanggil tidak perlu cabang kosong.
 */
export async function fetchMoneyBalance(
  supabase: SupabaseClient,
  householdId: string,
): Promise<{ balance: MoneyBalanceRecord; error: string | null }> {
  const { data, error } = await supabase
    .from("money_balances")
    .select(
      "dues_in_jpy, spent_jpy, advanced_jpy, refunded_jpy, adjusted_jpy, balance_jpy",
    )
    .eq("household_id", householdId)
    .maybeSingle();

  if (error) {
    logError("fetchMoneyBalance", error.message);
    return { balance: EMPTY_BALANCE, error: LOAD_ERROR };
  }

  return {
    balance: (data ?? EMPTY_BALANCE) as unknown as MoneyBalanceRecord,
    error: null,
  };
}

/** Mengambil kategori pengeluaran yang masih aktif, urut nama. */
export async function fetchMoneyCategories(
  supabase: SupabaseClient,
  householdId: string,
): Promise<{ categories: MoneyCategoryRecord[]; error: string | null }> {
  const { data, error } = await supabase
    .from("money_categories")
    .select("id, name")
    .eq("household_id", householdId)
    .eq("is_active", true)
    .order("name");

  if (error) {
    logError("fetchMoneyCategories", error.message);
    return { categories: [], error: LOAD_ERROR };
  }

  return { categories: (data ?? []) as unknown as MoneyCategoryRecord[], error: null };
}

/**
 * Mengambil ronde patungan yang sedang berjalan.
 * Index partial `money_rounds_one_open_idx` menjamin paling banyak satu baris.
 */
export async function fetchOpenMoneyRound(
  supabase: SupabaseClient,
  householdId: string,
): Promise<{ round: MoneyRoundRecord | null; error: string | null }> {
  const { data, error } = await supabase
    .from("money_rounds")
    .select("id, label, amount_per_person_jpy, opened_on")
    .eq("household_id", householdId)
    .is("closed_on", null)
    .maybeSingle();

  if (error) {
    logError("fetchOpenMoneyRound", error.message);
    return { round: null, error: LOAD_ERROR };
  }

  return {
    round: (data ?? null) as unknown as MoneyRoundRecord | null,
    error: null,
  };
}

/**
 * Mengambil riwayat transaksi terbaru.
 *
 * @param limit Jumlah baris maksimum; default {@link RECENT_TRANSACTION_LIMIT}.
 */
export async function fetchRecentMoneyTransactions(
  supabase: SupabaseClient,
  householdId: string,
  limit = RECENT_TRANSACTION_LIMIT,
): Promise<{ transactions: MoneyTransactionRecord[]; error: string | null }> {
  const { data, error } = await supabase
    .from("money_transactions")
    .select(TRANSACTION_SELECT)
    .eq("household_id", householdId)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    logError("fetchRecentMoneyTransactions", error.message);
    return { transactions: [], error: LOAD_ERROR };
  }

  return {
    transactions: (data ?? []) as unknown as MoneyTransactionRecord[],
    error: null,
  };
}

/**
 * Status iuran satu penghuni pada ronde aktif.
 *
 * Tagihan iuran (`money_obligations`) dicocokkan dengan setoran yang menunjuknya
 * (`money_transactions.obligation_id`). Dua bacaan digabung di aplikasi — bukan satu
 * kolom status di database — supaya mencatat uang tetap satu INSERT dan tidak bisa
 * setengah jadi (setoran tercatat, status lupa diubah).
 *
 * @param obligations Baris tagihan iuran ronde aktif, nama penghuni sudah ter-embed.
 * @param settlements Transaksi `dues` milik rumah yang menunjuk sebuah tagihan.
 */
export function toMoneyDuesBoard(
  obligations: MoneyDuesObligationRow[],
  settlements: MoneyDuesSettlementRow[],
): MoneyDuesEntry[] {
  const settledByObligation = new Map<
    string,
    { total: number; lastDate: string | null }
  >();

  for (const transaction of settlements) {
    if (!transaction.obligation_id) {
      continue;
    }

    const current = settledByObligation.get(transaction.obligation_id) ?? {
      total: 0,
      lastDate: null,
    };

    settledByObligation.set(transaction.obligation_id, {
      total: current.total + transaction.amount_jpy,
      // occurred_on sudah dibatasi format YYYY-MM-DD, jadi perbandingan string aman.
      lastDate:
        current.lastDate === null ||
        transaction.occurred_on > current.lastDate
          ? transaction.occurred_on
          : current.lastDate,
    });
  }

  return obligations.map((obligation) => {
    const settled = settledByObligation.get(obligation.id);
    const settledJpy = settled?.total ?? 0;
    const status =
      settledJpy >= obligation.amount_jpy
        ? "paid"
        : settledJpy > 0
          ? "partial"
          : "open";

    return {
      obligation_id: obligation.id,
      member_id: obligation.member_id,
      member_name: obligation.member?.display_name ?? FALLBACK_MEMBER_NAME,
      amount_jpy: obligation.amount_jpy,
      settled_jpy: settledJpy,
      status,
      due_on: obligation.due_on,
      settled_on: settled?.lastDate ?? null,
    };
  });
}

/**
 * Talangan per penghuni, diturunkan dari transaksi `advance` dan `refund`.
 *
 * Yang dipinjam kaleng bukan harga barang penuh: bagian wajar pembayar sendiri
 * sudah ia tanggung (lihat {@link advanceOwedJpy}). Pengembalian yang diterima orang
 * yang sama lalu mengurangi sisanya, jadi angka ini tidak bisa berbeda dari riwayat
 * uang yang tercatat — sama seperti status iuran, tidak ada kolom status yang dipakai.
 */
export function toMoneyAdvances(rows: MoneyAdvanceRow[]): MoneyAdvanceEntry[] {
  const byMember = new Map<string, MoneyAdvanceEntry>();

  function entryFor(
    memberId: string,
    memberName: string | null | undefined,
  ): MoneyAdvanceEntry {
    const existing = byMember.get(memberId);

    if (existing) {
      return existing;
    }

    const created: MoneyAdvanceEntry = {
      member_id: memberId,
      member_name: memberName ?? FALLBACK_MEMBER_NAME,
      advanced_jpy: 0,
      refunded_jpy: 0,
      outstanding_jpy: 0,
    };
    byMember.set(memberId, created);

    return created;
  }

  for (const row of rows) {
    if (row.kind === "advance") {
      const entry = entryFor(row.paid_by, row.payer?.display_name);
      entry.advanced_jpy += advanceOwedJpy(row.amount_jpy, row.split_count);
      continue;
    }

    if (row.kind === "refund" && row.member_id) {
      const entry = entryFor(row.member_id, row.recipient?.display_name);
      entry.refunded_jpy += Math.abs(row.amount_jpy);
    }
  }

  return [...byMember.values()]
    .map((entry) => ({
      ...entry,
      outstanding_jpy: entry.advanced_jpy - entry.refunded_jpy,
    }))
    .filter((entry) => entry.outstanding_jpy > 0)
    .sort(
      (a, b) =>
        b.outstanding_jpy - a.outstanding_jpy ||
        a.member_name.localeCompare(b.member_name),
    );
}

/**
 * Membaca talangan yang masih menjadi tanggungan kaleng.
 *
 * Dipakai layar maupun Server Action: nominal yang boleh dikembalikan selalu
 * dihitung ulang dari database, tidak pernah dipercaya dari form.
 */
export async function fetchMoneyAdvances(
  supabase: SupabaseClient,
  householdId: string,
): Promise<{ advances: MoneyAdvanceEntry[]; error: string | null }> {
  const { data, error } = await supabase
    .from("money_transactions")
    .select(ADVANCE_SELECT)
    .eq("household_id", householdId)
    .in("kind", ["advance", "refund"])
    .limit(ADVANCE_SCAN_LIMIT);

  if (error) {
    logError("fetchMoneyAdvances", error.message);
    return { advances: [], error: LOAD_ERROR };
  }

  return {
    advances: toMoneyAdvances((data ?? []) as unknown as MoneyAdvanceRow[]),
    error: null,
  };
}

/**
 * Papan iuran ronde aktif: tagihan per penghuni dicocokkan dengan setorannya.
 *
 * Tanpa ronde tidak ada yang perlu disetor, jadi kedua query dilewati. Digabung ke
 * satu helper karena halaman Uang dan strip Hari Ini membutuhkan papan yang sama,
 * dan status "sudah setor" tidak boleh dihitung dua cara.
 */
async function fetchMoneyDuesBoard(
  supabase: SupabaseClient,
  householdId: string,
  roundId: string | null,
): Promise<{ dues: MoneyDuesEntry[]; error: string | null }> {
  if (!roundId) {
    return { dues: [], error: null };
  }

  const [obligationsResult, settlementsResult] = await Promise.all([
    fetchMoneyDuesObligations(supabase, householdId, roundId),
    fetchMoneyDuesSettlements(supabase, householdId),
  ]);

  if (obligationsResult.error || settlementsResult.error) {
    return { dues: [], error: LOAD_ERROR };
  }

  return {
    dues: toMoneyDuesBoard(
      obligationsResult.obligations,
      settlementsResult.settlements,
    ),
    error: null,
  };
}

/**
 * Angka uang untuk strip Hari Ini: isi kaleng dan siapa yang belum setor.
 * Talangan dan riwayat sengaja tidak ikut — layar ini menunjuk tindakan,
 * penjelasannya ada di `/rumah/uang`.
 *
 * Ronde aktif dibaca lebih dulu karena papan iuran membutuhkannya; sisanya berjalan
 * paralel dan kegagalan per-query dikumpulkan supaya strip tetap terisi angka nol.
 */
export async function fetchMoneyTodaySummary(
  supabase: SupabaseClient,
  householdId: string,
): Promise<MoneyTodaySummary> {
  const roundResult = await fetchOpenMoneyRound(supabase, householdId);

  const [balanceResult, duesResult] = await Promise.all([
    fetchMoneyBalance(supabase, householdId),
    fetchMoneyDuesBoard(supabase, householdId, roundResult.round?.id ?? null),
  ]);

  return {
    balance_jpy: balanceResult.balance.balance_jpy,
    round_label: roundResult.round?.label ?? null,
    unpaid_dues_count: duesResult.dues.filter(
      (entry) => entry.status !== "paid",
    ).length,
    errors: [roundResult.error, balanceResult.error, duesResult.error].filter(
      (message): message is string => Boolean(message),
    ),
  };
}

/**
 * Membaca seluruh muatan halaman `/rumah/uang`.
 *
 * Ronde aktif dibaca lebih dulu karena tagihan iuran butuh `round_id`-nya; sisanya
 * jalan paralel. Kegagalan per-query dikumpulkan di `errors` agar layar tetap
 * menampilkan saldo (nol) daripada ikut gagal.
 */
export async function fetchMoneyOverview(
  supabase: SupabaseClient,
  householdId: string,
): Promise<MoneyOverview> {
  const roundResult = await fetchOpenMoneyRound(supabase, householdId);

  const [
    balanceResult,
    categoriesResult,
    membersResult,
    transactionsResult,
    duesResult,
    advancesResult,
  ] = await Promise.all([
    fetchMoneyBalance(supabase, householdId),
    fetchMoneyCategories(supabase, householdId),
    fetchMoneyMembers(supabase),
    fetchRecentMoneyTransactions(supabase, householdId),
    fetchMoneyDuesBoard(supabase, householdId, roundResult.round?.id ?? null),
    fetchMoneyAdvances(supabase, householdId),
  ]);

  const errors = [
    roundResult.error,
    balanceResult.error,
    categoriesResult.error,
    membersResult.error,
    transactionsResult.error,
    duesResult.error,
    advancesResult.error,
  ].filter((message): message is string => Boolean(message));

  return {
    balance: balanceResult.balance,
    round: roundResult.round,
    dues: duesResult.dues,
    advances: advancesResult.advances,
    transactions: transactionsResult.transactions,
    categories: categoriesResult.categories,
    members: membersResult.members,
    errors,
  };
}

/** Baris tagihan iuran mentah dari `DUES_SELECT`. */
type MoneyDuesObligationRow = {
  id: string;
  member_id: string;
  amount_jpy: number;
  due_on: string | null;
  member: { display_name: string } | null;
};

/** Baris setoran yang dipakai untuk menghitung status iuran. */
type MoneyDuesSettlementRow = {
  obligation_id: string | null;
  amount_jpy: number;
  occurred_on: string;
};

/** Baris `advance`/`refund` mentah dari `ADVANCE_SELECT`. */
type MoneyAdvanceRow = {
  kind: MoneyTransactionKind;
  amount_jpy: number;
  paid_by: string;
  member_id: string | null;
  split_count: number;
  payer: { display_name: string } | null;
  recipient: { display_name: string } | null;
};

/**
 * Mengambil tagihan iuran milik satu ronde patungan.
 *
 * `roundId` bernilai `null` bila rumah belum pernah membuka patungan; saat itu
 * papan iuran kosong dan query kedua dilewati.
 */
async function fetchMoneyDuesObligations(
  supabase: SupabaseClient,
  householdId: string,
  roundId: string | null,
): Promise<{ obligations: MoneyDuesObligationRow[]; error: string | null }> {
  if (!roundId) {
    return { obligations: [], error: null };
  }

  const { data, error } = await supabase
    .from("money_obligations")
    .select(DUES_SELECT)
    .eq("household_id", householdId)
    .eq("round_id", roundId)
    .eq("kind", "dues");

  if (error) {
    logError("fetchMoneyDuesObligations", error.message);
    return { obligations: [], error: LOAD_ERROR };
  }

  return {
    obligations: (data ?? []) as unknown as MoneyDuesObligationRow[],
    error: null,
  };
}

/**
 * Mengambil setoran iuran rumah yang menunjuk sebuah tagihan.
 *
 * Batas tinggi dipakai sengaja: tiga penghuni mencatat beberapa baris per bulan,
 * sehingga setahun masih muat dalam satu bacaan dan tidak perlu query per ronde.
 */
async function fetchMoneyDuesSettlements(
  supabase: SupabaseClient,
  householdId: string,
): Promise<{ settlements: MoneyDuesSettlementRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from("money_transactions")
    .select("obligation_id, amount_jpy, occurred_on")
    .eq("household_id", householdId)
    .eq("kind", "dues")
    .not("obligation_id", "is", null)
    .limit(1000);

  if (error) {
    logError("fetchMoneyDuesSettlements", error.message);
    return { settlements: [], error: LOAD_ERROR };
  }

  return {
    settlements: (data ?? []) as unknown as MoneyDuesSettlementRow[],
    error: null,
  };
}

/**
 * Ringkasan hemat untuk subtitle menu Rumah: saldo dan ada/tidaknya patungan aktif.
 * Sengaja tidak membaca riwayat maupun papan iuran karena `/rumah` hanya butuh dua angka.
 */
export async function fetchMoneyMenuSummary(
  supabase: SupabaseClient,
  householdId: string,
): Promise<MoneyMenuSummary> {
  const [balanceResult, roundResult] = await Promise.all([
    fetchMoneyBalance(supabase, householdId),
    fetchOpenMoneyRound(supabase, householdId),
  ]);

  const error = balanceResult.error ?? roundResult.error;

  return {
    balance: balanceResult.error ? null : balanceResult.balance,
    hasOpenRound: Boolean(roundResult.round),
    error,
  };
}
