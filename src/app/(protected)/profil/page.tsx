import { Fingerprint, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { connection } from "next/server";

import { logout } from "@/app/(protected)/actions";
import {
  LoadErrorNotice,
  SupabaseSetupNotice,
} from "@/components/layout/household-notices";
import { SubpageHeader } from "@/components/layout/subpage-header";
import { Button } from "@/components/ui/button";
import { PasskeyManager } from "@/features/auth/passkeys/passkey-manager";
import {
  fetchMembershipSummary,
  fetchProfileCard,
} from "@/features/auth/queries";
import { getPublicEnvironment } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const header = {
  title: "Profil & keamanan",
  description:
    "Identitas akun, cara masuk, dan passkey yang tersimpan di perangkat ini.",
  backLabel: "Hari Ini",
  backHref: "/hari-ini",
};

/** Satu baris label/nilai pada kartu akun. */
function ProfileRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 truncate text-right text-sm font-semibold">{children}</dd>
    </div>
  );
}

export default async function ProfilePage() {
  await connection();

  const environment = getPublicEnvironment();

  if (!environment.isSupabaseConfigured) {
    return (
      <div className="space-y-6">
        <SubpageHeader {...header} />
        <SupabaseSetupNotice message={environment.validationMessage} />
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = (await supabase?.auth.getUser()) ?? { data: { user: null } };

  if (!supabase || !user) {
    return (
      <div className="space-y-6">
        <SubpageHeader {...header} />
        <LoadErrorNotice messages={["Sesi tidak dapat dibaca. Muat ulang halaman."]} />
      </div>
    );
  }

  // Keanggotaan rumah bersifat opsional di halaman ini: akun tanpa rumah tetap
  // perlu melihat identitasnya dan mengelola passkey. Kedua query berjalan
  // paralel karena setiap round-trip ke proyek cloud menambah waktu render.
  const [profileResult, membershipResult] = await Promise.all([
    fetchProfileCard(supabase, user.id),
    fetchMembershipSummary(supabase, user.id),
  ]);

  const { membership } = membershipResult;

  const roleLabel =
    membership.role === null
      ? "Belum bergabung dengan rumah"
      : membership.role === "owner"
        ? "Pemilik rumah"
        : "Penghuni";

  return (
    <div className="space-y-6">
      <SubpageHeader {...header} />

      <LoadErrorNotice
        messages={[profileResult.error, membershipResult.error].filter(
          (message): message is string => Boolean(message),
        )}
      />

      <section
        aria-labelledby="account-title"
        className="rounded-[20px] border border-border bg-card p-5 shadow-sm"
      >
        <h2 id="account-title" className="eyebrow">
          Profil aktif
        </h2>
        <p className="mt-2 truncate text-lg font-extrabold">
          {profileResult.profile?.displayName ?? user.email}
        </p>
        <p className="mt-1 truncate text-sm text-muted-foreground">{user.email}</p>

        <dl className="mt-4 divide-y divide-border border-t border-border">
          <ProfileRow label="Peran">{roleLabel}</ProfileRow>
          <ProfileRow label="Rumah">
            {membership.householdId
              ? (membership.householdName ?? "Nama rumah tidak tersedia")
              : "Belum ada rumah"}
          </ProfileRow>
          <ProfileRow label="Zona waktu">
            {profileResult.profile?.timezone ?? "Asia/Tokyo"}
          </ProfileRow>
        </dl>

        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          Nama dan email dibuatkan oleh pengelola rumah. Perubahan data ini belum
          tersedia di aplikasi.
        </p>
      </section>

      <section aria-labelledby="security-title" className="space-y-3">
        <h2 id="security-title" className="text-lg font-extrabold">
          Keamanan
        </h2>
        <div className="space-y-4 rounded-[20px] border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <Fingerprint
              className="mt-0.5 size-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-bold">Masuk dengan passkey</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Satu passkey per perangkat. Email dan password tetap selalu bisa
                dipakai sebagai cadangan.
              </p>
            </div>
          </div>

          {environment.enablePasskeys ? (
            <PasskeyManager />
          ) : (
            <p className="rounded-xl border border-dashed border-border bg-secondary/60 px-4 py-3 text-xs leading-5 text-muted-foreground">
              Passkey dinonaktifkan di aplikasi ini. Sebelum dibuka, pengaktifan
              passkey, Relying Party ID, dan daftar origin harus ditetapkan di
              Supabase Authentication pada domain HTTPS final — Relying Party ID
              tidak dapat diubah setelah ada penghuni mendaftar.
            </p>
          )}
        </div>
      </section>

      <form action={logout}>
        <Button type="submit" variant="destructive" size="lg" className="w-full">
          <LogOut aria-hidden="true" />
          Keluar dari akun
        </Button>
      </form>
    </div>
  );
}
