import { createClient } from "@/lib/supabase/server";

/** Peran seorang pengguna di dalam sebuah rumah tangga. */
export type HouseholdRole = "owner" | "member";

/** Konteks rumah tangga aktif untuk pengguna yang sedang login. */
export type HouseholdContext = {
  householdId: string;
  userId: string;
  role: HouseholdRole;
};

/**
 * Menyelesaikan rumah tangga aktif milik pengguna saat ini untuk dipakai oleh
 * Server Component dan Server Action.
 *
 * Mengasumsikan satu pengguna berada di tepat satu rumah tangga; bila ternyata
 * ada lebih dari satu, keanggotaan paling lama yang dipakai.
 *
 * @returns Konteks rumah tangga, atau `null` bila Supabase belum dikonfigurasi,
 * pengguna belum terautentikasi, atau pengguna belum memiliki rumah tangga.
 */
export async function getHouseholdContext(): Promise<HouseholdContext | null> {
  const supabase = await createClient();

  if (!supabase) {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return null;
  }

  return {
    householdId: data.household_id,
    userId: user.id,
    role: data.role as HouseholdRole,
  };
}
