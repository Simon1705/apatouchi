import type { MetadataRoute } from "next";

/**
 * Manifest PWA untuk pemasangan di beranda ponsel.
 *
 * `start_url` sengaja `/hari-ini` (bukan `/`) agar aplikasi yang terpasang
 * langsung membuka dashboard, dan `/login` hanya muncul bila sesi habis.
 *
 * Aset ikon: `/app-icon-512.png` dipakai untuk "any" dan "maskable" karena
 * latarnya full-bleed (glif berada di zona aman tengah), sesuai aturan topeng
 * Android/iOS. Service worker sengaja tidak dipasang: data rumah bersifat
 * langsung (tugas, belanja, persetujuan) dan cache offline berisiko
 * menampilkan status basi sebagai keadaan terkini.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Uchi — Manajemen Rumah",
    short_name: "Uchi",
    description:
      "Giliran tugas, belanja bersama, jadwal sampah, dan catatan untuk penghuni rumah.",
    id: "/",
    start_url: "/hari-ini",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f3efe6",
    theme_color: "#f3efe6",
    lang: "id",
    categories: ["productivity", "lifestyle", "utilities"],
    icons: [
      {
        src: "/app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/app-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "Tugas rumah",
        short_name: "Tugas",
        description: "Daftar giliran tugas dan status hari ini",
        url: "/tugas",
      },
      {
        name: "Belanja bersama",
        short_name: "Belanja",
        description: "Barang yang perlu dibeli penghuni",
        url: "/belanja",
      },
      {
        name: "Rumah",
        short_name: "Rumah",
        description: "Aturan rumah, jadwal sampah, dan catatan",
        url: "/rumah",
      },
    ],
  };
}
