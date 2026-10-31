import type { SupabaseClient } from "@supabase/supabase-js";

import type { HouseholdRole } from "@/lib/household";

/** Ringkasan identitas akun untuk halaman Profil. */
export type ProfileCard = {
  displayName: string;
  timezone: string;
};

/** Hasil pembacaan profil milik pengguna yang sedang masuk. */
export type ProfileCardResult = {
  profile: ProfileCard | null;
  error: string | null;
};

/** Keanggotaan rumah tangga aktif beserta nama rumahnya, untuk kartu profil. */
export type MembershipSummary = {
  householdId: string | null;
  role: HouseholdRole | null;
  householdName: string | null;
};

/** Hasil pembacaan keanggotaan pengguna yang sedang masuk. */
export type MembershipSummaryResult = {
  membership: MembershipSummary;
  error: string | null;
};

const PROFILE_LOAD_ERROR = "Profil tidak dapat dimuat.";
const HOUSEHOLD_LOAD_ERROR = "Informasi rumah tidak dapat dimuat.";

/**
 * Mengambil baris `profiles` milik pengguna sendiri.
 *
 * RLS hanya mengizinkan pemilik baris dan sesama penghuni membaca, jadi query
 * difilter pada `auth.uid()` yang sudah diketahui di server.
 *
 * @param supabase Client Supabase server (request-scoped).
 * @param userId Identitas pengguna dari sesi Supabase Auth.
 */
export async function fetchProfileCard(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileCardResult> {
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, timezone")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[auth] fetchProfileCard gagal", error.message);
    return { profile: null, error: PROFILE_LOAD_ERROR };
  }

  if (!data) {
    // Baris profil tidak ada (mis. akun dibuat manual tanpa trigger bootstrap).
    return { profile: null, error: PROFILE_LOAD_ERROR };
  }

  return {
    profile: {
      displayName: data.display_name as string,
      timezone: data.timezone as string,
    },
    error: null,
  };
}

/**
 * Mengambil rumah tangga aktif, peran, dan namanya dalam satu query.
 *
 * Relasi `household_members -> households` dipakai agar halaman Profil tidak
 * perlu menunggu hasil kueri keanggotaan sebelum membaca nama rumah (dua
 * round-trip berurutan terasa mahal karena setiap query menuju proyek cloud).
 * Konvensi pemilihan rumah sama dengan `getHouseholdContext()`: keanggotaan
 * paling lama dipakai bila pengguna punya lebih dari satu.
 *
 * @param supabase Client Supabase server (request-scoped).
 * @param userId Identitas pengguna dari sesi Supabase Auth.
 */
export async function fetchMembershipSummary(
  supabase: SupabaseClient,
  userId: string,
): Promise<MembershipSummaryResult> {
  const noHousehold: MembershipSummary = {
    householdId: null,
    role: null,
    householdName: null,
  };

  const { data, error } = await supabase
    .from("household_members")
    .select("household_id, role, household:households(name)")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[auth] fetchMembershipSummary gagal", error.message);
    return { membership: noHousehold, error: HOUSEHOLD_LOAD_ERROR };
  }

  if (!data) {
    // Akun sudah masuk tetapi belum terdaftar pada rumah mana pun.
    return { membership: noHousehold, error: null };
  }

  const household = data.household as { name?: string } | null;

  return {
    membership: {
      householdId: data.household_id as string,
      role: data.role as HouseholdRole,
      householdName: household?.name ?? null,
    },
    error: null,
  };
}
