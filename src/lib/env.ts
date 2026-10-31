import { z } from "zod";

const httpUrlSchema = z.string().refine(
  (value) => {
    if (!/^(?:http|https):\/\//.test(value)) {
      return false;
    }

    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) && Boolean(url.hostname);
    } catch {
      return false;
    }
  },
  {
    message: "URL Supabase harus menggunakan URL HTTP atau HTTPS yang valid.",
  },
);

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .union([z.literal(""), httpUrlSchema])
    .optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_ENABLE_PASSKEYS: z.enum(["true", "false"]).default("false"),
});

export type PublicEnvironment = {
  supabaseUrl?: string;
  supabasePublishableKey?: string;
  enablePasskeys: boolean;
  isSupabaseConfigured: boolean;
  validationMessage?: string;
};

/**
 * Validates public runtime configuration without failing builds that do not yet
 * have Supabase credentials.
 */
export function getPublicEnvironment(): PublicEnvironment {
  const result = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_ENABLE_PASSKEYS:
      process.env.NEXT_PUBLIC_ENABLE_PASSKEYS ?? "false",
  });

  if (!result.success) {
    return {
      enablePasskeys: false,
      isSupabaseConfigured: false,
      validationMessage:
        "Konfigurasi Supabase belum valid. Periksa URL dan publishable key.",
    };
  }

  const supabaseUrl = result.data.NEXT_PUBLIC_SUPABASE_URL || undefined;
  const supabasePublishableKey =
    result.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || undefined;

  return {
    supabaseUrl,
    supabasePublishableKey,
    enablePasskeys: result.data.NEXT_PUBLIC_ENABLE_PASSKEYS === "true",
    isSupabaseConfigured: Boolean(supabaseUrl && supabasePublishableKey),
  };
}
