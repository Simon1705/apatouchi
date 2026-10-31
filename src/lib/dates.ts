/**
 * Helper tanggal berbasis zona waktu rumah (Asia/Tokyo).
 * Dipakai di server maupun client; hanya mengandalkan `Intl` bawaan.
 */

/** Tanggal Asia/Tokyo yang digeser sejumlah hari, sebagai `YYYY-MM-DD`. */
export function tokyoDateOffset(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  // en-CA memformat tanggal sebagai YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(date);
}

/** Tanggal hari ini di Asia/Tokyo sebagai `YYYY-MM-DD`. */
export function todayInTokyo(): string {
  return tokyoDateOffset(0);
}

/**
 * Label singkat tanggal `YYYY-MM-DD` untuk tampilan, mis. "Sab, 24 Okt".
 * Nilai `date` diparse sebagai UTC agar tidak bergeser oleh zona waktu browser.
 */
export function formatDateLabel(dateOnly: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${dateOnly}T00:00:00Z`));
}

/**
 * Label hari berdasarkan indeks kolom `waste_schedules.weekday`.
 * Indeks mengikuti konvensi `Date.prototype.getUTCDay()`: 0 = Minggu, 6 = Sabtu.
 */
export const weekdayLabels = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
] as const;

/** Indeks hari (0 = Minggu) dari tanggal `YYYY-MM-DD`, dihitung dalam UTC. */
export function weekdayOf(dateOnly: string): number {
  return new Date(`${dateOnly}T00:00:00Z`).getUTCDay();
}

/**
 * Tanggal `YYYY-MM-DD` di zona waktu rumah untuk sebuah timestamp ISO dari
 * database. Column `timestamptz` disimpan dalam UTC, jadi label hari harus
 * dikonversi lebih dulu agar tidak melompat satu hari untuk pukul 00.00-09.00 JST.
 */
export function tokyoDateFromIso(timestamp: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(
    new Date(timestamp),
  );
}

/**
 * Label kapan sebuah catatan diubah, relatif terhadap hari acuan: "hari ini",
 * "kemarin", "4 hari lalu", lalu tanggal eksplisit bila sudah lebih dari seminggu.
 *
 * @param dateOnly Tanggal kejadian `YYYY-MM-DD` (hasil `tokyoDateFromIso`).
 * @param today Tanggal acuan `YYYY-MM-DD` di zona waktu rumah.
 */
export function formatRelativeDayLabel(dateOnly: string, today: string): string {
  const daysAgo = daysUntil(dateOnly, today);

  if (daysAgo <= 0) {
    return "hari ini";
  }

  if (daysAgo === 1) {
    return "kemarin";
  }

  if (daysAgo <= 7) {
    return `${daysAgo} hari lalu`;
  }

  return formatDateLabel(dateOnly);
}

/**
 * Tanggal `YYYY-MM-DD` terdekat yang memiliki hari tertentu, dihitung dari
 * tanggal acuan. Hari yang sama dengan acuan menghasilkan tanggal acuan itu
 * sendiri (selisih 0 hari), supaya jadwal minggu ini tidak "melompat" ke depan.
 */
export function nextDateForWeekday(weekday: number, fromDate: string): string {
  const base = Date.parse(`${fromDate}T00:00:00Z`);
  const offsetDay = weekdayOf(fromDate);
  const delta = (weekday - offsetDay + 7) % 7;

  return new Date(base + delta * 86_400_000).toISOString().slice(0, 10);
}

/** Selisih hari (`0`..`6`) antara tanggal acuan dan tanggal tujuan. */
export function daysUntil(fromDate: string, targetDate: string): number {
  const diffMs =
    Date.parse(`${targetDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`);

  return Math.round(diffMs / 86_400_000);
}

/**
 * Label jam pengambilan untuk ditampilkan, mis. `"08:00:00"` -> `"08.00"`.
 * Format titik mengikuti kebiasaan penulisan jam di Bahasa Indonesia.
 */
export function formatTimeLabel(time: string | null): string | null {
  if (!time) {
    return null;
  }

  return time.slice(0, 5).replace(":", ".");
}

