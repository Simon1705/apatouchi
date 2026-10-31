import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Uchi — Manajemen Rumah",
    template: "%s · Uchi",
  },
  description:
    "Aplikasi rumah bersama untuk tugas, belanja, jadwal sampah, dan catatan penghuni.",
  applicationName: "Uchi",
  // iOS memakai apple-touch-icon (bukan manifest) untuk "Add to Home Screen".
  icons: {
    apple: "/apple-icon-180.png",
  },
  appleWebApp: {
    capable: true,
    title: "Uchi",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3efe6" },
    { media: "(prefers-color-scheme: dark)", color: "#242825" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    // Chrome (lapisan kredensial/autofill bawaan, bukan ekstensi) menyisipkan
    // atribut seperti `__gcrremoteframetoken` ke <html> sebelum React sempat
    // mencocokkan HTML server dengan DOM. Peringatan hidrasi untuk atribut itu
    // tidak dapat dihindari dari kode, jadi diredam di elemen ini saja.
    <html lang="id" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
