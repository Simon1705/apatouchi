import { z } from "zod";

/** Status catatan; selaras dengan enum `public.note_status`. */
export const noteStatuses = ["active", "archived"] as const;
export type NoteStatus = (typeof noteStatuses)[number];

/** Label status catatan memakai istilah penghuni. */
export const noteStatusLabels: Record<NoteStatus, string> = {
  active: "Aktif",
  archived: "Arsip",
};

/** Kelas warna status; warna selalu didampingi label teks. */
export const noteStatusStyles: Record<NoteStatus, string> = {
  active: "bg-accent-soft text-primary",
  archived: "bg-secondary text-muted-foreground",
};

/**
 * Validasi pembuatan dan perubahan catatan rumah.
 * Batas mengikuti check constraint pada `public.house_notes`
 * (title 2-160, content 1-5000).
 */
export const houseNoteSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Judul minimal 2 karakter.")
    .max(160, "Judul maksimal 160 karakter."),
  content: z
    .string()
    .trim()
    .min(1, "Isi catatan tidak boleh kosong.")
    .max(5000, "Isi catatan maksimal 5000 karakter."),
});

/** Identifier baris catatan untuk aksi ubah/semat/arsip/hapus. */
export const noteIdSchema = z.string().trim().uuid("Catatan tidak valid.");

/** Nilai form catatan rumah. */
export type HouseNoteValues = z.infer<typeof houseNoteSchema>;
