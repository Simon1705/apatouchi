import type { SupabaseClient } from "@supabase/supabase-js";

import { daysUntil, nextDateForWeekday } from "@/lib/dates";
import type {
  UpcomingWaste,
  WasteScheduleRecord,
} from "@/features/waste/types";

/** Hasil pembacaan jadwal sampah. */
export type WasteQueryResult = {
  schedules: WasteScheduleRecord[];
  error: string | null;
};

/** Ringkasan pengambilan terdekat untuk kartu di halaman Hari Ini. */
export type NextWasteSummary = {
  /** `null` bila rumah belum punya jadwal sama sekali. */
  next: UpcomingWaste | null;
  /** Jumlah jenis sampah lain yang diambil pada tanggal yang sama. */
  additionalTypes: number;
  error: string | null;
};

const LOAD_ERROR = "Jadwal sampah tidak dapat dimuat.";

const SCHEDULE_SELECT =
  "id, waste_type, weekday, collection_time, next_collection_date, notes, created_by";

/**
 * Mengambil seluruh pola jadwal mingguan sebuah rumah.
 *
 * @param supabase Client Supabase server (request-scoped).
 * @param householdId Rumah tangga aktif.
 */
export async function fetchWasteSchedules(
  supabase: SupabaseClient,
  householdId: string,
): Promise<WasteQueryResult> {
  const { data, error } = await supabase
    .from("waste_schedules")
    .select(SCHEDULE_SELECT)
    .eq("household_id", householdId)
    .order("weekday", { ascending: true })
    .order("waste_type", { ascending: true });

  if (error) {
    console.error("[waste] fetchWasteSchedules gagal", error.message);
    return { schedules: [], error: LOAD_ERROR };
  }

  return {
    schedules: (data ?? []) as unknown as WasteScheduleRecord[],
    error: null,
  };
}

/**
 * Menghitung tanggal pengambilan berikutnya untuk tiap jadwal dan mengurutkannya.
 *
 * Jadwal dengan hari yang sama dengan hari acuan dianggap "hari ini" (selisih 0),
 * bukan minggu depan, agar kartu tidak menunjukkan tanggal yang sudah terlewat.
 *
 * @param schedules Pola jadwal mingguan.
 * @param today Tanggal acuan `YYYY-MM-DD` di zona waktu rumah.
 */
export function toUpcomingWaste(
  schedules: WasteScheduleRecord[],
  today: string,
): UpcomingWaste[] {
  return schedules
    .map((schedule) => {
      const date = nextDateForWeekday(schedule.weekday, today);

      return { schedule, date, daysAway: daysUntil(today, date) };
    })
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.schedule.waste_type.localeCompare(b.schedule.waste_type),
    );
}

/**
 * Mengambil pengambilan sampah terdekat beserta jenis lain pada hari yang sama.
 * Dipakai kartu "Sampah" pada halaman Hari Ini.
 *
 * @param supabase Client Supabase server (request-scoped).
 * @param householdId Rumah tangga aktif.
 * @param today Tanggal acuan `YYYY-MM-DD` di zona waktu rumah.
 */
export async function fetchNextWasteSummary(
  supabase: SupabaseClient,
  householdId: string,
  today: string,
): Promise<NextWasteSummary> {
  const { schedules, error } = await fetchWasteSchedules(supabase, householdId);

  if (error) {
    return { next: null, additionalTypes: 0, error };
  }

  const upcoming = toUpcomingWaste(schedules, today);
  const next = upcoming[0] ?? null;

  return {
    next,
    additionalTypes: next
      ? upcoming.filter((entry) => entry.date === next.date).length - 1
      : 0,
    error: null,
  };
}
