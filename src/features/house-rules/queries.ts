import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  HouseMemberRecord,
  HouseRuleRecord,
} from "@/features/house-rules/types";

/** Hasil pembacaan daftar aturan; `error` terisi saat query gagal. */
export type HouseRuleQueryResult = {
  rules: HouseRuleRecord[];
  error: string | null;
};

/** Hasil pembacaan roster penghuni. */
export type HouseMemberQueryResult = {
  members: HouseMemberRecord[];
  error: string | null;
};

const RULE_LOAD_ERROR = "Daftar aturan rumah tidak dapat dimuat.";
const MEMBER_LOAD_ERROR = "Daftar penghuni tidak dapat dimuat.";

// Hint nama constraint dipakai walau saat ini hanya ada satu FK per tabel ke
// profiles: menghindari ambiguitas bila kolom FK bertambah, dan konsisten
// dengan slice Tugas/Belanja yang memakai hint yang sama.
const RULE_SELECT =
  "id, title, content, status, created_by, created_at, updated_at, " +
  "creator:profiles!house_rules_created_by_fkey(display_name), " +
  "approvals:rule_approvals(user_id, approved, " +
  "voter:profiles!rule_approvals_user_id_fkey(display_name))";

/**
 * Menyembunyikan detail PostgREST dari pengguna: pesan asli hanya dicatat di
 * server, antarmuka menampilkan instruksi aksi.
 */
function logError(label: string, message: string) {
  console.error(`[house-rules] ${label} gagal`, message);
}

/**
 * Mengambil seluruh aturan rumah beserta suara yang sudah masuk.
 *
 * Urutan mengikuti enum `rule_status` (draft, pending_approval, active, archived)
 * lalu aturan terbaru lebih dulu, sehingga usulan yang butuh aksi tampil di atas.
 *
 * @param supabase Client Supabase server (request-scoped).
 * @param householdId Rumah tangga aktif.
 */
export async function fetchHouseRules(
  supabase: SupabaseClient,
  householdId: string,
): Promise<HouseRuleQueryResult> {
  const { data, error } = await supabase
    .from("house_rules")
    .select(RULE_SELECT)
    .eq("household_id", householdId)
    .order("status", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    logError("fetchHouseRules", error.message);
    return { rules: [], error: RULE_LOAD_ERROR };
  }

  return { rules: (data ?? []) as unknown as HouseRuleRecord[], error: null };
}

/**
 * Mengambil satu aturan beserta suaranya, untuk divalidasi sebelum aksi tulis.
 *
 * @returns `null` bila aturan tidak ada, tidak bisa dibaca, atau query gagal.
 */
export async function fetchHouseRule(
  supabase: SupabaseClient,
  householdId: string,
  ruleId: string,
): Promise<HouseRuleRecord | null> {
  const { data, error } = await supabase
    .from("house_rules")
    .select(RULE_SELECT)
    .eq("household_id", householdId)
    .eq("id", ruleId)
    .maybeSingle();

  if (error) {
    logError("fetchHouseRule", error.message);
    return null;
  }

  return (data ?? null) as unknown as HouseRuleRecord | null;
}

/**
 * Mengambil roster penghuni rumah aktif.
 *
 * Kebijakan `profiles_select_household_peers` membatasi hasil pada penghuni satu
 * rumah, sehingga `profiles` di sini ekuivalen dengan anggota rumah tangga.
 *
 * @param supabase Client Supabase server (request-scoped).
 */
export async function fetchHouseholdMembers(
  supabase: SupabaseClient,
): Promise<HouseMemberQueryResult> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name")
    .order("display_name");

  if (error) {
    logError("fetchHouseholdMembers", error.message);
    return { members: [], error: MEMBER_LOAD_ERROR };
  }

  return { members: (data ?? []) as unknown as HouseMemberRecord[], error: null };
}
