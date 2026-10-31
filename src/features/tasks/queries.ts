import type { SupabaseClient } from "@supabase/supabase-js";

import type { AssignmentRecord } from "@/features/tasks/types";

/**
 * Hasil pembacaan daftar penugasan. `error` selalu terisi saat PostgREST gagal,
 * supaya halaman bisa membedakan "rumah kosong" dan "gagal memuat".
 */
export type AssignmentQueryResult = {
  assignments: AssignmentRecord[];
  error: string | null;
};

const LOAD_ERROR = "Daftar tugas tidak dapat dimuat.";

// Hint nama constraint wajib dipakai: chore_assignments punya beberapa FK ke
// profiles (assignee_id, completed_by, created_by) dan satu FK komposit ke chores.
const ASSIGNMENT_SELECT =
  "id, chore_id, assignee_id, created_by, scheduled_for, status, due_at, " +
  "chore:chores!chore_assignments_chore_household_fkey(title, area, frequency), " +
  "assignee:profiles!chore_assignments_assignee_id_fkey(display_name)";

/**
 * Menyusun hasil query menjadi bentuk yang dipakai halaman.
 *
 * Klien tanpa generated types mengembalikan tipe longgar, karena itu cast lewat
 * `unknown`. Pesan asli hanya dicatat di server; pengguna melihat instruksi aksi.
 */
function toResult(
  label: string,
  data: unknown,
  error: { message: string } | null,
): AssignmentQueryResult {
  if (error) {
    console.error(`[tasks] ${label} gagal`, error.message);
    return { assignments: [], error: LOAD_ERROR };
  }

  return { assignments: (data ?? []) as unknown as AssignmentRecord[], error: null };
}

/**
 * Mengambil penugasan sebuah rumah dalam rentang tanggal `[from, to]`.
 *
 * @param supabase Client Supabase server (request-scoped).
 * @param householdId Rumah tangga aktif.
 * @param from Tanggal awal `YYYY-MM-DD` (inklusif).
 * @param to Tanggal akhir `YYYY-MM-DD` (inklusif).
 * @returns Penugasan terurut tanggal terjadwal, atau error bila query gagal.
 */
export async function fetchAssignmentsInRange(
  supabase: SupabaseClient,
  householdId: string,
  from: string,
  to: string,
): Promise<AssignmentQueryResult> {
  const { data, error } = await supabase
    .from("chore_assignments")
    .select(ASSIGNMENT_SELECT)
    .eq("household_id", householdId)
    .gte("scheduled_for", from)
    .lte("scheduled_for", to)
    .order("scheduled_for", { ascending: true });

  return toResult("fetchAssignmentsInRange", data, error);
}
