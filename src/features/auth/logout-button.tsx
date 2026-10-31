"use client";

import type { VariantProps } from "class-variance-authority";
import { LoaderCircle, LogOut } from "lucide-react";
import { useFormStatus } from "react-dom";

import { logout } from "@/app/(protected)/actions";
import { Button, buttonVariants } from "@/components/ui/button";

export type LogoutButtonProps = {
  /**
   * Teks tombol. Dikosongkan untuk varian ikon saja di header shell, di mana
   * tidak ada label yang bisa berubah — umpan baliknya lewat spinner dan status
   * untuk pembaca layar.
   */
  label?: string;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  className?: string;
};

/**
 * Tombol keluar dengan indikator selama Server Action `logout` berjalan.
 *
 * Aksi ini mengakhiri sesi lalu `redirect("/login")`. Di jaringan seluler
 * rentang itu mudah melewati 500 ms, dan tanpa sinyal apa pun pengguna tidak
 * punya cara membedakan "sedang diproses" dari "tombol mati" — akibatnya mereka
 * menekan ulang dan memicu sign-out kedua.
 *
 * Dipakai di dua tempat (header shell dan halaman profil) supaya keduanya
 * mendapat perilaku yang sama; sebelumnya keduanya berupa `<form action={logout}>`
 * polos yang tidak memberi feedback apa pun.
 */
export function LogoutButton({
  label,
  variant,
  size,
  className,
}: LogoutButtonProps) {
  return (
    <form action={logout} suppressHydrationWarning>
      <LogoutSubmitButton
        label={label}
        variant={variant}
        size={size}
        className={className}
      />
    </form>
  );
}

/**
 * Bagian dalam `<form>` yang boleh membaca status submit.
 *
 * `useFormStatus()` hanya melaporkan form di mana komponen ini dirender, jadi
 * panggilannya harus terpisah dari `LogoutButton` — dipanggil di induk akan
 * selalu menghasilkan `pending: false`.
 */
function LogoutSubmitButton({
  label,
  variant,
  size,
  className,
}: LogoutButtonProps) {
  const { pending } = useFormStatus();

  return (
    <>
      <Button
        type="submit"
        variant={variant}
        size={size}
        disabled={pending}
        aria-busy={pending || undefined}
        aria-label={label ? undefined : "Keluar dari akun"}
        title={label ? undefined : pending ? "Sedang keluar…" : "Keluar"}
        className={className}
      >
        {pending ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <LogOut aria-hidden="true" />
        )}
        {label ? <span>{pending ? "Mengeluarkan…" : label}</span> : null}
      </Button>
      {/* Varian ikon tidak mengubah teks apa pun, jadi status tertulis ini satu-
          satunya kabar bagi pembaca layar bahwa aksinya diterima. */}
      <span className="sr-only" role="status">
        {pending ? "Sedang keluar dari akun…" : ""}
      </span>
    </>
  );
}
