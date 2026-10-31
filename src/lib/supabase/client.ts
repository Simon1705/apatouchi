import { createBrowserClient } from "@supabase/ssr";

import { getPublicEnvironment } from "@/lib/env";

/** Creates a browser Supabase client, or null while setup is incomplete. */
export function createClient() {
  const environment = getPublicEnvironment();

  if (
    !environment.isSupabaseConfigured ||
    !environment.supabaseUrl ||
    !environment.supabasePublishableKey
  ) {
    return null;
  }

  return createBrowserClient(
    environment.supabaseUrl,
    environment.supabasePublishableKey,
  );
}
