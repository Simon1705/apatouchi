"use client";

import { ClipboardCheck, Home, ShoppingBag, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navigationItems = [
  { href: "/hari-ini", label: "Hari Ini", icon: Sun },
  { href: "/tugas", label: "Tugas", icon: ClipboardCheck },
  { href: "/belanja", label: "Belanja", icon: ShoppingBag },
  { href: "/rumah", label: "Rumah", icon: Home },
] as const;

/** Provides thumb-friendly navigation for the four primary mobile routes. */
export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav className="bottom-navigation" aria-label="Navigasi utama">
      {navigationItems.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className="bottom-navigation-item"
            data-active={isActive}
          >
            <Icon className="size-[21px]" strokeWidth={1.9} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
