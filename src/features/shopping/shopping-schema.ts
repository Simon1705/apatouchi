import { z } from "zod";

/** Prioritas barang; selaras dengan enum `public.shopping_priority`. */
export const shoppingPriorities = ["low", "normal", "high"] as const;
export type ShoppingPriority = (typeof shoppingPriorities)[number];

/** Status barang; selaras dengan enum `public.shopping_status`. */
export const shoppingStatuses = ["needed", "purchased", "removed"] as const;
export type ShoppingStatus = (typeof shoppingStatuses)[number];

/** Label prioritas dengan istilah yang dipakai penghuni sehari-hari. */
export const shoppingPriorityLabels: Record<ShoppingPriority, string> = {
  low: "Rendah",
  normal: "Biasa",
  high: "Mendesak",
};

/** Label status barang. */
export const shoppingStatusLabels: Record<ShoppingStatus, string> = {
  needed: "Perlu dibeli",
  purchased: "Sudah dibeli",
  removed: "Dilepas",
};

/** Kelas warna status; warna selalu didampingi label teks. */
export const shoppingStatusStyles: Record<ShoppingStatus, string> = {
  needed: "bg-warning-soft text-warning",
  purchased: "bg-success-soft text-success",
  removed: "bg-secondary text-muted-foreground",
};

/** Kelas badge prioritas, dari paling tenang sampai paling mendesak. */
export const shoppingPriorityStyles: Record<ShoppingPriority, string> = {
  low: "bg-secondary text-muted-foreground",
  normal: "bg-accent-soft text-primary",
  high: "bg-destructive/10 text-destructive",
};

/**
 * Validasi penambahan barang.
 * Batas panjang dan rentang mengikuti check constraint pada
 * `public.shopping_items` (name 1-160, quantity 1-999).
 *
 * `quantity` sengaja tetap string agar nilai form dan tipe hasil parse sama
 * (input `<input type="number">` selalu menghasilkan string); angka dipakai saat insert.
 */
export const shoppingItemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Tulis nama barang yang dibutuhkan.")
    .max(160, "Nama barang maksimal 160 karakter."),
  quantity: z
    .string()
    .trim()
    .regex(/^\d{1,3}$/, "Jumlah harus angka antara 1 sampai 999.")
    .refine((value) => Number(value) >= 1, "Jumlah minimal 1 barang."),
  priority: z.enum(shoppingPriorities),
});

/**
 * Identifier baris untuk aksi beli/batal beli/hapus.
 * Didefinisikan ulang di slice ini agar batas antar modul fitur tetap rapi;
 * slice Tugas punya skema id sendiri.
 */
export const shoppingIdSchema = z.string().trim().uuid("Barang tidak valid.");

/** Nilai form penambahan barang belanja. */
export type ShoppingItemValues = z.infer<typeof shoppingItemSchema>;
