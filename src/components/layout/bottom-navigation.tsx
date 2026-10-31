"use client";

import {
  ClipboardCheck,
  Home,
  LoaderCircle,
  ShoppingBag,
  Sun,
  type LucideIcon,
} from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

const navigationItems = [
  { href: "/hari-ini", label: "Hari Ini", icon: Sun },
  { href: "/tugas", label: "Tugas", icon: ClipboardCheck },
  { href: "/belanja", label: "Belanja", icon: ShoppingBag },
  { href: "/rumah", label: "Rumah", icon: Home },
] as const;

type NavigationLinkProps = {
  href: (typeof navigationItems)[number]["href"];
  label: string;
  icon: LucideIcon;
  isActive: boolean;
};

/** Provides thumb-friendly navigation for the four primary mobile routes. */
export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav className="bottom-navigation" aria-label="Navigasi utama">
      {navigationItems.map(({ href, label, icon: Icon }) => (
        <NavigationLink
          key={href}
          href={href}
          label={label}
          icon={Icon}
          isActive={pathname === href || pathname.startsWith(`${href}/`)}
        />
      ))}
    </nav>
  );
}

/**
 * Satu tab navigasi dengan indikator selama halaman tujuannya dimuat.
 *
 * Keempat rute ini dirender oleh Server Component yang memanggil Supabase cloud,
 * jadi ketukan baru menampilkan data setelah ratusan milidetik. Tanpa penanda,
 * layar tampak tidak merespons dan pengguna mengetuk ulang. Ikon ditukar dengan
 * spinner pada slot yang sama (ukuran identik) supaya tidak ada pergeseran layout.
 *
 * `useLinkStatus()` membaca transisi milik `Link` di komponen tempat ia dipanggil,
 * karena itu pemakaiannya harus di child ini — di `BottomNavigation` hasilnya
 * akan selalu `pending: false`.
 */
function NavigationLink({ href, label, icon: Icon, isActive }: NavigationLinkProps) {
  const { pending } = useLinkStatus();

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      aria-busy={pending || undefined}
      className="bottom-navigation-item"
      data-active={isActive}
    >
      {pending ? (
        <LoaderCircle
          className="size-[21px] animate-spin"
          strokeWidth={1.9}
          aria-hidden="true"
        />
      ) : (
        <Icon className="size-[21px]" strokeWidth={1.9} aria-hidden="true" />
      )}
      <span>{label}</span>
    </Link>
  );
}
