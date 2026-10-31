import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { MobileShell } from "@/components/layout/mobile-shell";
import { getPublicEnvironment } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export default async function ProtectedLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const environment = getPublicEnvironment();
  const supabase = await createClient();
  const {
    data: { user },
  } = (await supabase?.auth.getUser()) ?? { data: { user: null } };

  if (environment.isSupabaseConfigured && !user) {
    redirect("/login");
  }

  const fullName = user?.user_metadata?.full_name;
  const userLabel =
    (typeof fullName === "string" && fullName.trim()) ||
    user?.email ||
    "Penghuni rumah";

  return <MobileShell userLabel={userLabel}>{children}</MobileShell>;
}
