import { Home, Leaf } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LoginForm } from "@/features/auth/login-form";
import { PasskeySignInButton } from "@/features/auth/passkeys/passkey-signin-button";
import { getPublicEnvironment } from "@/lib/env";

export default function LoginPage() {
  const environment = getPublicEnvironment();

  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <div className="ambient-orb ambient-orb-one" aria-hidden="true" />
      <div className="ambient-orb ambient-orb-two" aria-hidden="true" />

      <section className="relative z-10 w-full max-w-[430px] animate-page-in">
        <header className="login-hero px-2">
          <div className="mb-3.5 flex items-center justify-between">
            <div className="grid size-11 place-items-center rounded-[14px] bg-charcoal text-white shadow-sm">
              <Home className="size-6" strokeWidth={1.8} aria-hidden="true" />
            </div>
            <span className="flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs font-bold text-muted-foreground">
              <Leaf className="size-3.5 text-success" aria-hidden="true" />
              Shizuoka · Jepang
            </span>
          </div>
          <p className="eyebrow">Ruang bersama</p>
          <h1 className="display-title text-[clamp(1.75rem,6vw,2.6rem)] leading-[1.1]">
            Selamat pulang.
          </h1>
          <p className="login-hero-copy mt-3 max-w-sm text-sm leading-5 text-muted-foreground">
            Giliran tugas, belanja bersama, dan kabar rumah hari ini.
          </p>
        </header>

        <Card className="gap-0 border border-border/80 bg-card/95 py-0 shadow-[0_18px_55px_rgba(55,47,37,0.12)]">
          <CardHeader className="border-b border-border px-4 py-3.5">
            <p className="text-base font-extrabold">Masuk dengan akun penghuni</p>
            <p className="text-sm text-muted-foreground">
              Email dan password dari pengelola.
            </p>
          </CardHeader>
          <CardContent className="px-4 py-4">
            <LoginForm
              isConfigured={environment.isSupabaseConfigured}
              setupMessage={environment.validationMessage}
            />
            {/* Flag menandai passkey sudah diaktifkan di Supabase Auth; tanpa
                itu tombol hanya akan menghasilkan galat provider_disabled. */}
            {environment.enablePasskeys ? <PasskeySignInButton /> : null}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
