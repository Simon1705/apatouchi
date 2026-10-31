import Link from "next/link";
import { ChevronLeft } from "lucide-react";

type SubpageHeaderProps = {
  title: string;
  description: string;
  /** Label tujuan kembali; default ke hub Rumah. */
  backLabel?: string;
  backHref?: string;
};

/**
 * Header subhalaman dengan tautan kembali ke hub Rumah.
 *
 * @param title Judul layar (nama fitur sesuai istilah penghuni).
 * @param description Satu baris konteks tentang isi layar.
 * @param backLabel Label tautan kembali.
 * @param backHref Tujuan tautan kembali.
 */
export function SubpageHeader({
  title,
  description,
  backLabel = "Rumah",
  backHref = "/rumah",
}: SubpageHeaderProps) {
  return (
    <header className="space-y-4">
      <Link
        href={backHref}
        className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        {backLabel}
      </Link>
      <div>
        <h1 className="display-title text-4xl leading-none">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </header>
  );
}
