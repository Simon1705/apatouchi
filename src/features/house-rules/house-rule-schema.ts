import { z } from "zod";

/**
 * Status aturan; selaras dengan enum `public.rule_status`.
 * Urutan mengikuti deklarasi enum di database: draft -> pending_approval -> active -> archived.
 */
export const ruleStatuses = [
  "draft",
  "pending_approval",
  "active",
  "archived",
] as const;
export type RuleStatus = (typeof ruleStatuses)[number];

/** Label status memakai istilah penghuni, bukan istilah basis data. */
export const ruleStatusLabels: Record<RuleStatus, string> = {
  draft: "Draf",
  pending_approval: "Menunggu persetujuan",
  active: "Berlaku",
  archived: "Arsip",
};

/** Kelas warna status; warna selalu didampingi label teks. */
export const ruleStatusStyles: Record<RuleStatus, string> = {
  draft: "bg-secondary text-muted-foreground",
  pending_approval: "bg-warning-soft text-warning",
  active: "bg-success-soft text-success",
  archived: "bg-secondary text-muted-foreground",
};

/** Pilihan suara penghuni pada sebuah aturan. */
export const ruleVotes = ["yes", "no"] as const;
export type RuleVoteChoice = (typeof ruleVotes)[number];

/**
 * Validasi usulan aturan baru.
 * Batas panjang mengikuti check constraint pada `public.house_rules`
 * (title 2-120, content 2-4000).
 */
export const houseRuleSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Judul minimal 2 karakter.")
    .max(120, "Judul maksimal 120 karakter."),
  content: z
    .string()
    .trim()
    .min(2, "Tulis aturan dengan jelas, minimal 2 karakter.")
    .max(4000, "Isi aturan maksimal 4000 karakter."),
});

/** Identifier baris untuk aksi suara/sahkan/arsip/hapus. */
export const ruleIdSchema = z.string().trim().uuid("Aturan tidak valid.");

/** Identifier suara dari form; hanya dua nilai yang dikenal. */
export const ruleVoteSchema = z.enum(ruleVotes);

/** Nilai form usulan aturan. */
export type HouseRuleValues = z.infer<typeof houseRuleSchema>;
