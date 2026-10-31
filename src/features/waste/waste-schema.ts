import { z } from "zod";

/**
 * Indeks hari untuk kolom `waste_schedules.weekday` (`smallint` 0-6).
 * Nilai disimpan sebagai string karena `<select>` selalu menghasilkan string;
 * angka diambil saat insert, sama seperti jumlah pada slice Belanja.
 */
export const weekdayValues = ["0", "1", "2", "3", "4", "5", "6"] as const;

/**
 * Usulan jenis sampah yang umum di Shizuoka. Nama Jepang dipakai apa adanya
 * karena istilah itulah yang tercetak pada kantong dan jadwal dari pengelola
 * gedung; kolom `waste_type` tetap bebas diisi agar sesuai aturan lokal.
 */
export const wasteTypeSuggestions = [
  "Sampah bakar (燃やすごみ)",
  "Plastik dan kemasan (容器包装プラスチック)",
  "Botol, kaleng, dan PET (びん・缶・PET)",
  "Koran, kardus, dan kertas (紙類)",
  "Sampah besar (粗大ごみ)",
];

/**
 * Validasi pembuatan jadwal pengambilan sampah.
 * Batas mengikuti check constraint pada `public.waste_schedules`
 * (waste_type 2-100, notes <= 1000).
 */
export const wasteScheduleSchema = z.object({
  wasteType: z
    .string()
    .trim()
    .min(2, "Tulis jenis sampah yang diambil.")
    .max(100, "Nama jenis sampah maksimal 100 karakter."),
  weekday: z
    .string()
    .trim()
    .refine((value) => /^[0-6]$/.test(value), "Pilih hari pengambilan."),
  collectionTime: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(value),
      "Gunakan format jam HH:MM, atau kosongkan bila tidak ada.",
    ),
  notes: z
    .string()
    .trim()
    .max(1000, "Panduan pemilahan maksimal 1000 karakter."),
});

/** Identifier baris untuk aksi hapus jadwal. */
export const wasteIdSchema = z.string().trim().uuid("Jadwal tidak valid.");

/** Nilai form jadwal sampah. */
export type WasteScheduleValues = z.infer<typeof wasteScheduleSchema>;
