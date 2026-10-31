import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getPublicEnvironment } from "@/lib/env";

/** Creates a request-scoped Supabase server client when credentials exist. */
export async function createClient() {
  const environment = getPublicEnvironment();

  if (
    !environment.isSupabaseConfigured ||
    !environment.supabaseUrl ||
    !environment.supabasePublishableKey
  ) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(
    environment.supabaseUrl,
    environment.supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components cannot always write cookies. The proxy refreshes
            // the session before rendering protected routes.
          }
        },
      },
    },
  );
}
