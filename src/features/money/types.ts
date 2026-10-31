import type {
  MoneyDuesStatus,
  MoneyTransactionKind,
} from "@/features/money/money-schema";

/** Penghuni satu rumah tangga, dipakai untuk pilihan "siapa" pada semua form uang. */
export type MoneyMemberRecord = {
  id: string;
  display_name: string;
};

/** Kategori pengeluaran yang aktif. */
export type MoneyCategoryRecord = {
  id: string;
  name: string;
};

/** Ronde patungan yang sedang berjalan (`closed_on is null`). */
export type MoneyRoundRecord = {
  id: string;
  label: string;
  amount_per_person_jpy: number;
  opened_on: string;
};

/** Baris riwayat perpindahan uang, dengan nama penghuni dan kategori ter-embed. */
export type MoneyTransactionRecord = {
  id: string;
  occurred_on: string;
  kind: MoneyTransactionKind;
  amount_jpy: number;
  paid_by: string;
  obligation_id: string | null;
  category_id: string | null;
  split_count: number;
  note: string | null;
  created_at: string;
  /** Pembuat catatan; menentukan siapa yang boleh menghapusnya (creator atau owner). */
  created_by: string;
  payer: { display_name: string } | null;
  category: { name: string } | null;
};

/** Agregat saldo kas per rumah dari view `public.money_balances`. */
export type MoneyBalanceRecord = {
  dues_in_jpy: number;
  spent_jpy: number;
  advanced_jpy: number;
  refunded_jpy: number;
  adjusted_jpy: number;
  balance_jpy: number;
};

/**
 * Status iuran satu penghuni pada ronde aktif.
 * Kolom status tidak ada di database: barisnya dihitung dari kewajiban iuran
 * (`money_obligations`) lalu dicocokkan dengan setoran
 * (`money_transactions.obligation_id`), sehingga "sudah setor" tidak bisa
 * berbeda dari uang yang benar-benar tercatat.
 */
export type MoneyDuesEntry = {
  obligation_id: string;
  member_id: string;
  member_name: string;
  /** Target iuran orang ini pada ronde berjalan. */
  amount_jpy: number;
  /** Total setoran yang sudah menunjuk kewajiban ini. */
  settled_jpy: number;
  status: MoneyDuesStatus;
  due_on: string | null;
  /** Tanggal setoran terakhir, untuk keterangan "setor 24 Okt". */
  settled_on: string | null;
};

/**
 * Talangan satu penghuni: uang pribadi yang sudah terpakai untuk kebutuhan bersama
 * dan masih menjadi tanggungan kaleng kas.
 * Tidak ada kolom penampungnya — angka ini diturunkan dari transaksi `advance`
 * dikurangi `refund` yang menunjuk orang yang sama, sama seperti status iuran.
 */
export type MoneyAdvanceEntry = {
  member_id: string;
  member_name: string;
  /** Total tanggungan kaleng dari pengeluaran pribadinya (bagian wajarnya sendiri sudah dikurangi). */
  advanced_jpy: number;
  /** Total pengembalian yang sudah diterima orang ini dari kaleng. */
  refunded_jpy: number;
  /** Sisa yang masih harus dibayar kaleng; `advanced_jpy - refunded_jpy`. */
  outstanding_jpy: number;
};

/** Muatan satu bacaan halaman Uang Bersama. */
export type MoneyOverview = {
  balance: MoneyBalanceRecord;
  round: MoneyRoundRecord | null;
  dues: MoneyDuesEntry[];
  advances: MoneyAdvanceEntry[];
  transactions: MoneyTransactionRecord[];
  categories: MoneyCategoryRecord[];
  members: MoneyMemberRecord[];
  /** Pesan muat gagal; halaman menampilkan peringatan per slice, bukan crash. */
  errors: string[];
};

/** Ringkasan kecil untuk subtitle menu Rumah (hemat query). */
export type MoneyMenuSummary = {
  balance: MoneyBalanceRecord | null;
  hasOpenRound: boolean;
  error: string | null;
};

/**
 * Angka uang untuk strip di dashboard Hari Ini.
 *
 * Hanya dua hal yang menuntut tindakan penghuni dan ikut dibaca di dashboard: isi
 * kaleng dan jumlah orang yang belum setor pada ronde aktif. Semuanya diturunkan
 * dari fungsi papan yang sama dengan halaman `/rumah/uang`, jadi satu angka tidak
 * bisa berbeda antar layar.
 */
export type MoneyTodaySummary = {
  /** Isi kaleng dari view `money_balances`; 0 bila belum ada transaksi. */
  balance_jpy: number;
  /** Label patungan berjalan; `null` bila belum ada atau sudah ditutup. */
  round_label: string | null;
  /** Penghuni yang iurannya belum lunas; 0 bila tidak ada patungan berjalan. */
  unpaid_dues_count: number;
  /** Pesan muat gagal; strip menampilkan tanda hubung, bukan crash atau nol palsu. */
  errors: string[];
};
