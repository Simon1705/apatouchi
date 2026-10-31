"use server";

import { revalidatePath } from "next/cache";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  shoppingIdSchema,
  shoppingItemSchema,
} from "@/features/shopping/shopping-schema";
import { getHouseholdContext, type HouseholdContext } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";

/** State yang dikembalikan seluruh Server Action fitur Belanja. */
export type ShoppingActionState = {
  error?: string;
  ok?: boolean;
};

const SESSION_ERROR =
  "Sesi rumah tidak tersedia. Muat ulang halaman lalu coba lagi.";
const GENERIC_ERROR = "Tidak dapat menyimpan perubahan. Coba beberapa saat lagi.";
const RLS_ERROR =
  "Barang tidak dapat diperbarui — mungkin statusnya baru berubah atau bukan hak Anda.";

type ShoppingSession = {
  context: HouseholdContext;
  supabase: SupabaseClient;
};

/**
 * Menyiapkan konteks rumah + client Supabase untuk sebuah aksi.
 * `household_id` dan `created_by` selalu diambil dari sesi (bukan dari client)
 * agar mutasi lolos kebijakan RLS.
 */
async function requireSession(): Promise<ShoppingSession | null> {
  const context = await getHouseholdContext();

  if (!context) {
    return null;
  }

  const supabase = await createClient();

  if (!supabase) {
    return null;
  }

  return { context, supabase };
}

/** Mengambil pesan validasi pertama agar actionable dan dekat dengan field. */
function firstIssueMessage(
  error: { issues: { message: string }[] },
  fallback: string,
) {
  return error.issues[0]?.message ?? fallback;
}

/**
 * RLS membuat UPDATE/DELETE yang tidak diizinkan menjadi no-op tanpa error,
 * sehingga jumlah baris terdampak harus diperiksa sendiri.
 */
function assertRowTouched(rows: { id: string }[] | null) {
  return Array.isArray(rows) && rows.length > 0;
}

/** Memvalidasi identifier barang belanja dari form. */
function parseItemId(formData: FormData): string | null {
  const itemId = String(formData.get("itemId") ?? "");

  return shoppingIdSchema.safeParse(itemId).success ? itemId : null;
}

/** Menambahkan barang ke daftar belanja rumah aktif. */
export async function addShoppingItem(
  formData: FormData,
): Promise<ShoppingActionState> {
  const session = await requireSession();

  if (!session) {
    return { error: SESSION_ERROR };
  }

  const result = shoppingItemSchema.safeParse({
    name: formData.get("name"),
    quantity: formData.get("quantity"),
    priority: formData.get("priority"),
  });

  if (!result.success) {
    return {
      error: firstIssueMessage(result.error, "Periksa kembali isian barang."),
    };
  }

  const { context, supabase } = session;
  const values = result.data;

  // Pencegahan duplikat memakai perbandingan case-insensitive di sisi aplikasi:
  // `ilike` akan memperlakukan % dan _ pada nama barang sebagai wildcard.
  const { data: activeRows, error: activeError } = await supabase
    .from("shopping_items")
    .select("name")
    .eq("household_id", context.householdId)
    .eq("status", "needed");

  if (activeError) {
    return { error: GENERIC_ERROR };
  }

  const isDuplicate = (activeRows ?? []).some(
    (row) => row.name.trim().toLowerCase() === values.name.toLowerCase(),
  );

  if (isDuplicate) {
    return { error: "Barang ini sudah ada di daftar yang perlu dibeli." };
  }

  const { error } = await supabase.from("shopping_items").insert({
    household_id: context.householdId,
    created_by: context.userId,
    name: values.name,
    quantity: Number(values.quantity),
    priority: values.priority,
    status: "needed",
  });

  if (error) {
    return { error: GENERIC_ERROR };
  }

  revalidatePath("/belanja");
  revalidatePath("/hari-ini");
  return { ok: true };
}

/**
 * Menandai barang sudah dibeli oleh penghuni yang sedang login.
 * `purchased_by` dan `purchased_at` wajib terisi bersamaan agar lolos
 * `shopping_items_purchase_check`.
 */
export async function markItemPurchased(
  formData: FormData,
): Promise<ShoppingActionState> {
  const session = await requireSession();

  if (!session) {
    return { error: SESSION_ERROR };
  }

  const itemId = parseItemId(formData);

  if (!itemId) {
    return { error: "Barang tidak valid." };
  }

  const { context, supabase } = session;
  const { data, error } = await supabase
    .from("shopping_items")
    .update({
      status: "purchased",
      purchased_by: context.userId,
      purchased_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .select("id");

  if (error) {
    return { error: GENERIC_ERROR };
  }

  if (!assertRowTouched(data)) {
    return { error: RLS_ERROR };
  }

  revalidatePath("/belanja");
  revalidatePath("/hari-ini");
  return { ok: true };
}

/** Mengembalikan barang ke status perlu dibeli (mis. salah centang). */
export async function markItemNeeded(
  formData: FormData,
): Promise<ShoppingActionState> {
  const session = await requireSession();

  if (!session) {
    return { error: SESSION_ERROR };
  }

  const itemId = parseItemId(formData);

  if (!itemId) {
    return { error: "Barang tidak valid." };
  }

  const { supabase } = session;
  const { data, error } = await supabase
    .from("shopping_items")
    .update({ status: "needed", purchased_by: null, purchased_at: null })
    .eq("id", itemId)
    .select("id");

  if (error) {
    return { error: GENERIC_ERROR };
  }

  if (!assertRowTouched(data)) {
    return { error: RLS_ERROR };
  }

  revalidatePath("/belanja");
  revalidatePath("/hari-ini");
  return { ok: true };
}

/** Menghapus barang dari daftar. Hanya pembuat atau owner rumah yang diizinkan RLS. */
export async function deleteShoppingItem(
  formData: FormData,
): Promise<ShoppingActionState> {
  const session = await requireSession();

  if (!session) {
    return { error: SESSION_ERROR };
  }

  const itemId = parseItemId(formData);

  if (!itemId) {
    return { error: "Barang tidak valid." };
  }

  const { supabase } = session;
  const { data, error } = await supabase
    .from("shopping_items")
    .delete()
    .eq("id", itemId)
    .select("id");

  if (error) {
    return { error: GENERIC_ERROR };
  }

  if (!assertRowTouched(data)) {
    return { error: RLS_ERROR };
  }

  revalidatePath("/belanja");
  revalidatePath("/hari-ini");
  return { ok: true };
}
