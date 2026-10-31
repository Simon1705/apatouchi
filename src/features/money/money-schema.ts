import { z } from "zod";

/**
 * Batas nominal mengikuti check constraint pada migration
 * `202610250001_money_management.sql`:
 * transaksi -10.000.000..10.000.000, tagihan 1..10.000.000, iuran per ronde
 * 100..1.000.000. Form hanya menerima angka positif; tanda diterapkan oleh
 * Server Action sesuai jenis transaksi.
 */
const TRANSACTION_MAX_DIGITS = 7;

/** Jenis transaksi; selaras dengan enum `public.money_transaction_kind`. */
export const moneyTransactionKinds = [
  "dues",
  "expense",
  "advance",
  "refund",
  "adjustment",
] as const;
export type MoneyTransactionKind = (typeof moneyTransactionKinds)[number];

/** Sumber uang pada form pengeluaran: kaleng kas atau uang pribadi penghuni. */
export const moneyExpenseSources = ["box", "personal"] as const;
export type MoneyExpenseSource = (typeof moneyExpenseSources)[number];

/** Label jenis transaksi dengan istilah yang dipakai penghuni sehari-hari. */
export const moneyKindLabels: Record<MoneyTransactionKind, string> = {
  dues: "Iuran",
  expense: "Keluar dari kas",
  advance: "Talangan",
  refund: "Pengembalian",
  adjustment: "Koreksi",
};

/** Kelas warna jenis transaksi; warna selalu didampingi label teks. */
export const moneyKindStyles: Record<MoneyTransactionKind, string> = {
  dues: "bg-success-soft text-success",
  expense: "bg-secondary text-muted-foreground",
  advance: "bg-warning-soft text-warning",
  refund: "bg-accent-soft text-primary",
  adjustment: "bg-secondary text-muted-foreground",
};

/** Status iuran satu penghuni pada ronde aktif; diturunkan dari transaksi, bukan kolom. */
export const moneyDuesStatuses = ["open", "partial", "paid"] as const;
export type MoneyDuesStatus = (typeof moneyDuesStatuses)[number];

/** Label status iuran. */
export const moneyDuesStatusLabels: Record<MoneyDuesStatus, string> = {
  open: "Belum setor",
  partial: "Baru sebagian",
  paid: "Sudah setor",
};

/** Kelas warna status iuran. */
export const moneyDuesStatusStyles: Record<MoneyDuesStatus, string> = {
  open: "bg-destructive/10 text-destructive",
  partial: "bg-warning-soft text-warning",
  paid: "bg-success-soft text-success",
};

/**
 * Nominal iuran yang sedang dipakai rumah (¥5.000 per orang).
 * Ini HANYA nilai awal form, bukan konfigurasi: nominal sebenarnya tersimpan pada
 * tiap ronde karena penghuni bebas menggantinya kapan saja.
 */
export const defaultDuesAmountJpy = 5000;

/**
 * Nominal dalam bentuk string. `<input type="number">` selalu menghasilkan string,
 * jadi format ini dipertahankan sampai insert (sama seperti jumlah pada slice Belanja).
 */
const amountSchema = z
  .string()
  .trim()
  .regex(
    new RegExp(`^[1-9]\\d{0,${TRANSACTION_MAX_DIGITS - 1}}$`),
    "Tulis nominal dalam yen, tanpa titik atau simbol.",
  );

/** Tanggal `YYYY-MM-DD` dari `<input type="date">`. */
const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pilih tanggal yang benar.");

/** Catatan bebas; batas mengikuti check constraint `note <= 500`. */
const noteSchema = z.string().trim().max(500, "Catatan maksimal 500 karakter.");

/** Kategori yang boleh dibiarkan kosong; dipakai form pengeluaran. */
const optionalCategorySchema = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || z.string().uuid().safeParse(value).success,
    "Pilih kategori atau kosongkan.",
  );

/**
 * Hasil hitungan uang fisik. Boleh `0` karena kaleng memang bisa kosong;
 * `amountSchema` menolak nol sehingga tidak dipakai di sini.
 */
const countedAmountSchema = z
  .string()
  .trim()
  .regex(/^(0|[1-9]\d{0,6})$/, "Tulis hasil hitungan dalam yen, tanpa titik atau simbol.");

/**
 * Validasi form "Tambah uang": satu penghuni menyetor uang ke kaleng kas.
 * Nominal boleh berbeda dari target ronde (setoran tambahan atau sebagian).
 */
export const moneyDuesFormSchema = z.object({
  amountJpy: amountSchema,
  memberId: z.string().trim().uuid("Pilih penghuni yang menyetor uang."),
  occurredOn: dateSchema,
  note: noteSchema,
});

/**
 * Validasi form "Catat pengeluaran".
 * `source` menentukan jenis transaksi: `box` mengurangi saldo kas, `personal`
 * menjadi talangan yang harus dikembalikan.
 */
export const moneyExpenseFormSchema = z.object({
  amountJpy: amountSchema,
  memberId: z.string().trim().uuid("Pilih siapa yang mencatat pengeluaran ini."),
  categoryId: optionalCategorySchema,
  source: z.enum(moneyExpenseSources),
  occurredOn: dateSchema,
  note: noteSchema,
});

/**
 * Validasi form "Kembalikan talangan": kaleng kas membayar kembali uang pribadi
 * yang terpakai untuk kebutuhan bersama.
 * `memberId` = orang yang dibayar (pemilik talangan), `paidBy` = penghuni yang
 * secara fisik mengambil uang dari kaleng.
 */
export const moneyRefundFormSchema = z.object({
  amountJpy: amountSchema,
  memberId: z.string().trim().uuid("Pilih orang yang dibayar."),
  paidBy: z.string().trim().uuid("Pilih siapa yang menyerahkan uangnya."),
  occurredOn: dateSchema,
  note: noteSchema,
});

/**
 * Validasi form "Hitung kas": menyamakan catatan dengan uang tunai hasil hitungan.
 *
 * Alasan (`note`) wajib: koreksi adalah satu-satunya jalur yang mengubah saldo
 * tanpa ada uang benar-benar masuk atau keluar, jadi barisnya harus bisa dijelaskan
 * ke penghuni lain di kemudian hari.
 */
export const moneyAdjustFormSchema = z.object({
  countedAmountJpy: countedAmountSchema,
  occurredOn: dateSchema,
  note: z
    .string()
    .trim()
    .min(3, "Tulis alasannya, mis. selisih hitungan atau kembalian belum tercatat.")
    .max(500, "Alasan maksimal 500 karakter."),
});

/** Validasi pembukaan ronde patungan baru. */
export const moneyRoundFormSchema = z.object({
  label: z
    .string()
    .trim()
    .min(2, "Tulis nama patungan, mis. Iuran Oktober.")
    .max(60, "Nama patungan maksimal 60 karakter."),
  amountPerPersonJpy: z
    .string()
    .trim()
    .regex(/^[1-9]\d{2,6}$/, "Nominal per orang antara ¥100 sampai ¥1.000.000."),
});

/** Validasi penambahan kategori pengeluaran. */
export const moneyCategoryFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Tulis nama kategori, mis. Gas.")
    .max(60, "Nama kategori maksimal 60 karakter."),
});

/**
 * Identifier baris untuk aksi money.
 * Didefinisikan ulang di slice ini agar batas antar modul fitur tetap rapi,
 * sama seperti `shoppingIdSchema` dan id schema pada slice Tugas.
 */
export const moneyIdSchema = z.string().trim().uuid("Data uang tidak valid.");

/** Nilai form setor iuran. */
export type MoneyDuesFormValues = z.infer<typeof moneyDuesFormSchema>;
/** Nilai form pengeluaran. */
export type MoneyExpenseFormValues = z.infer<typeof moneyExpenseFormSchema>;
/** Nilai form pengembalian talangan. */
export type MoneyRefundFormValues = z.infer<typeof moneyRefundFormSchema>;
/** Nilai form hitung kas. */
export type MoneyAdjustFormValues = z.infer<typeof moneyAdjustFormSchema>;
/** Nilai form pembukaan ronde. */
export type MoneyRoundFormValues = z.infer<typeof moneyRoundFormSchema>;
/** Nilai form penambahan kategori. */
export type MoneyCategoryFormValues = z.infer<typeof moneyCategoryFormSchema>;
