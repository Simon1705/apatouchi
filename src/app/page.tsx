import { redirect } from "next/navigation";

import { getPublicEnvironment } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const environment = getPublicEnvironment();

  if (!environment.isSupabaseConfigured) {
    redirect("/login");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = (await supabase?.auth.getUser()) ?? { data: { user: null } };

  redirect(user ? "/hari-ini" : "/login");
}
