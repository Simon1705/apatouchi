import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { BottomNavigation } from "@/components/layout/bottom-navigation";
import { LogoutButton } from "@/features/auth/logout-button";

export type MobileShellProps = {
  children: ReactNode;
  userLabel: string;
};

function getInitials(label: string) {
  const segments = label
    .replace(/@.*$/, "")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2);

  return segments.map((segment) => segment[0]?.toUpperCase()).join("") || "U";
}

/** Frames protected screens in the shared mobile application shell. */
export function MobileShell({ children, userLabel }: MobileShellProps) {
  return (
    <div className="mobile-shell">
      <header className="shell-utility-bar">
        {/* Avatar membuka halaman profil, mengikuti pola wireframe `open-profile`.
            prefetch dimatikan: header ini tampil di setiap halaman, sementara
            /profil butuh sesi + query ke Supabase cloud — prefetch otomatis
            membayar harga halaman itu walau profil jarang dibuka.

            Dua petunjuk bahwa blok ini kontrol, bukan keterangan identitas:
            chevron kanan (pola arah yang sama dengan `ChevronLeft` di SubpageHeader)
            dan respons tekan — diperlukan karena `hover` tidak pernah terjadi di
            layar sentuh, sehingga tanpa state aktif baris ini terlihat seperti teks. */}
        <Link
          href="/profil"
          prefetch={false}
          aria-label="Buka profil dan keamanan"
          className="-ml-2 flex min-h-11 min-w-0 items-center gap-3 rounded-lg px-2 transition-[background-color,transform] hover:bg-accent-soft active:bg-accent-soft active:translate-y-px"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground">
            {getInitials(userLabel)}
          </span>
          <div className="min-w-0">
            <p className="eyebrow mb-0">Uchi</p>
            <p className="truncate text-xs font-semibold text-muted-foreground">
              {userLabel}
            </p>
          </div>
          <ChevronRight
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        </Link>
        {/* Indikator selama aksi keluar berjalan ditangani `LogoutButton` lewat
            `useFormStatus`, termasuk `suppressHydrationWarning` pada form-nya —
            Chrome menandai elemen form dengan atribut internal (mis.
            `__gcruniqueid`) setelah HTML dikirim, yang memicu peringatan hidrasi
            tanpa ada data yang benar-benar beda. */}
        <LogoutButton
          variant="ghost"
          size="icon-lg"
          className="size-11 text-muted-foreground hover:text-destructive"
        />
      </header>

      <main className="shell-content animate-page-in">{children}</main>
      <BottomNavigation />
    </div>
  );
}
