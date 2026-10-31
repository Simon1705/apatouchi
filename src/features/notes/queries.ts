import type { SupabaseClient } from "@supabase/supabase-js";

import type { HouseNoteRecord } from "@/features/notes/types";

/** Hasil pembacaan daftar catatan rumah. */
export type HouseNoteQueryResult = {
  notes: HouseNoteRecord[];
  error: string | null;
};

const LOAD_ERROR = "Catatan rumah tidak dapat dimuat.";

// Dua FK ke profiles (created_by, updated_by) mewajibkan hint nama constraint.
const NOTE_SELECT =
  "id, title, content, status, is_pinned, created_by, updated_by, created_at, updated_at, " +
  "creator:profiles!house_notes_created_by_fkey(display_name), " +
  "editor:profiles!house_notes_updated_by_fkey(display_name)";

/**
 * Mengambil seluruh catatan rumah, aktif maupun arsip.
 *
 * Urutan mengikuti index `house_notes_household_status_idx`: catatan aktif dulu,
 * yang disematkan paling atas, lalu perubahan terbaru agar daftar stabil.
 *
 * @param supabase Client Supabase server (request-scoped).
 * @param householdId Rumah tangga aktif.
 */
export async function fetchHouseNotes(
  supabase: SupabaseClient,
  householdId: string,
): Promise<HouseNoteQueryResult> {
  const { data, error } = await supabase
    .from("house_notes")
    .select(NOTE_SELECT)
    .eq("household_id", householdId)
    .order("status", { ascending: true })
    .order("is_pinned", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[notes] fetchHouseNotes gagal", error.message);
    return { notes: [], error: LOAD_ERROR };
  }

  return { notes: (data ?? []) as unknown as HouseNoteRecord[], error: null };
}

/**
 * Mengambil satu catatan untuk divalidasi sebelum aksi tulis.
 *
 * @returns `null` bila catatan tidak ada, tidak dapat dibaca, atau query gagal.
 */
export async function fetchHouseNote(
  supabase: SupabaseClient,
  householdId: string,
  noteId: string,
): Promise<HouseNoteRecord | null> {
  const { data, error } = await supabase
    .from("house_notes")
    .select(NOTE_SELECT)
    .eq("household_id", householdId)
    .eq("id", noteId)
    .maybeSingle();

  if (error) {
    console.error("[notes] fetchHouseNote gagal", error.message);
    return null;
  }

  return (data ?? null) as unknown as HouseNoteRecord | null;
}

/**
 * Mengambil catatan aktif paling penting untuk halaman Hari Ini.
 * Yang disematkan mendahului; tanpa sematan, perubahan terbaru yang dipakai.
 *
 * @param supabase Client Supabase server (request-scoped).
 * @param householdId Rumah tangga aktif.
 * @param limit Jumlah maksimum kartu yang ditampilkan.
 */
export async function fetchHouseNoteHighlights(
  supabase: SupabaseClient,
  householdId: string,
  limit = 3,
): Promise<HouseNoteQueryResult> {
  const { data, error } = await supabase
    .from("house_notes")
    .select(NOTE_SELECT)
    .eq("household_id", householdId)
    .eq("status", "active")
    .order("is_pinned", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[notes] fetchHouseNoteHighlights gagal", error.message);
    return { notes: [], error: LOAD_ERROR };
  }

  return { notes: (data ?? []) as unknown as HouseNoteRecord[], error: null };
}
