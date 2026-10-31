import { z } from "zod";

/** Frekuensi sebuah template tugas; selaras dengan enum `public.chore_frequency`. */
export const choreFrequencies = ["once", "daily", "weekly", "monthly"] as const;
export type ChoreFrequency = (typeof choreFrequencies)[number];

/** Label Bahasa Indonesia untuk pilihan frekuensi pada antarmuka. */
export const choreFrequencyLabels: Record<ChoreFrequency, string> = {
  once: "Sekali",
  daily: "Harian",
  weekly: "Mingguan",
  monthly: "Bulanan",
};

/** Status sebuah penugasan; selaras dengan enum `public.assignment_status`. */
export const assignmentStatuses = ["pending", "completed", "skipped"] as const;
export type AssignmentStatus = (typeof assignmentStatuses)[number];

/** Label status penugasan; dipakai daftar jadwal maupun sorotan hari ini. */
export const assignmentStatusLabels: Record<AssignmentStatus, string> = {
  pending: "Aktif",
  completed: "Selesai",
  skipped: "Dilewati",
};

/**
 * Kelas warna per status. Warna selalu didampingi label teks agar tetap terbaca
 * oleh pengguna dengan gangguan pembedaan warna.
 */
export const assignmentStatusStyles: Record<AssignmentStatus, string> = {
  pending: "bg-warning-soft text-warning",
  completed: "bg-success-soft text-success",
  skipped: "bg-secondary text-muted-foreground",
};

/**
 * Validasi pembuatan template tugas (chore).
 * Batas panjang mengikuti check constraint pada tabel `public.chores`.
 */
export const choreSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Judul minimal 2 karakter.")
    .max(120, "Judul maksimal 120 karakter."),
  area: z
    .string()
    .trim()
    .max(80, "Area maksimal 80 karakter.")
    .refine((value) => value.length === 0 || value.length >= 2, {
      message: "Area minimal 2 karakter bila diisi.",
    })
    .optional(),
  frequency: z.enum(choreFrequencies),
  description: z
    .string()
    .trim()
    .max(500, "Deskripsi maksimal 500 karakter.")
    .optional(),
});

/** Validasi pembuatan penugasan (chore -> anggota -> tanggal). */
export const assignmentSchema = z.object({
  choreId: z.string().trim().uuid("Pilih tugas yang valid."),
  assigneeId: z.string().trim().uuid("Pilih anggota yang valid."),
  scheduledFor: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pilih tanggal yang valid."),
});

/** Validasi identifier baris untuk aksi complete/reopen/deactivate/delete. */
export const idSchema = z.string().trim().uuid("Identifikasi tidak valid.");

/** Nilai form pembuatan template tugas. */
export type ChoreValues = z.infer<typeof choreSchema>;

/** Nilai form pembuatan penugasan. */
export type AssignmentValues = z.infer<typeof assignmentSchema>;
