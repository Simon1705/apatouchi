import type { SupabaseClient } from "@supabase/supabase-js";

import type { ShoppingItemRecord } from "@/features/shopping/types";

/**
 * Hasil pembacaan daftar belanja. `error` selalu terisi saat PostgREST gagal,
 * supaya halaman bisa membedakan "rumah memang kosong" dan "gagal memuat".
 */
export type ShoppingQueryResult = {
  items: ShoppingItemRecord[];
  error: string | null;
};

/** Hasil hitungan barang yang masih perlu dibeli. */
export type ShoppingCountResult = {
  count: number;
  error: string | null;
};

const LIST_LOAD_ERROR = "Daftar belanja tidak dapat dimuat.";
const COUNT_LOAD_ERROR = "Jumlah barang belanja tidak dapat dimuat.";

// shopping_items punya dua FK ke profiles (created_by, purchased_by), sehingga
// hint nama constraint wajib dipakai saat embedding relasi.
const ITEM_SELECT =
  "id, name, quantity, priority, status, created_by, purchased_by, purchased_at, created_at, " +
  "creator:profiles!shopping_items_created_by_fkey(display_name), " +
  "buyer:profiles!shopping_items_purchased_by_fkey(display_name)";

/**
 * Mengambil seluruh barang belanja sebuah rumah (kecuali yang dilepas), diurutkan
 * agar barang yang belum dibeli dan berbobot prioritas tinggi tampil lebih dulu.
 *
 * @param supabase Client Supabase server (request-scoped).
 * @param householdId Rumah tangga aktif.
 * @returns Daftar barang, atau error bila query gagal.
 */
export async function fetchShoppingItems(
  supabase: SupabaseClient,
  householdId: string,
): Promise<ShoppingQueryResult> {
  const { data, error } = await supabase
    .from("shopping_items")
    .select(ITEM_SELECT)
    .eq("household_id", householdId)
    .neq("status", "removed")
    // Urutan enum status: needed, purchased, removed.
    .order("status", { ascending: true })
    // Enum prioritas dinaikkan turun agar high lebih dulu.
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[shopping] fetchShoppingItems gagal", error.message);
    return { items: [], error: LIST_LOAD_ERROR };
  }

  // Klien tanpa generated types mengembalikan tipe longgar; cast lewat unknown.
  return {
    items: (data ?? []) as unknown as ShoppingItemRecord[],
    error: null,
  };
}

/**
 * Menghitung barang berstatus `needed` untuk ringkasan di dashboard Hari Ini.
 *
 * @param supabase Client Supabase server (request-scoped).
 * @param householdId Rumah tangga aktif.
 * @returns Jumlah barang, atau error bila query gagal.
 */
export async function countNeededItems(
  supabase: SupabaseClient,
  householdId: string,
): Promise<ShoppingCountResult> {
  const { count, error } = await supabase
    .from("shopping_items")
    .select("id", { count: "exact", head: true })
    .eq("household_id", householdId)
    .eq("status", "needed");

  if (error) {
    console.error("[shopping] countNeededItems gagal", error.message);
    return { count: 0, error: COUNT_LOAD_ERROR };
  }

  return { count: count ?? 0, error: null };
}
