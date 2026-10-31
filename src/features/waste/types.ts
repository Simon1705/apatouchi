/** Baris jadwal pengambilan sampah milik sebuah rumah. */
export type WasteScheduleRecord = {
  id: string;
  waste_type: string;
  /** 0 = Minggu sampai 6 = Sabtu, mengikuti `waste_schedules.weekday`. */
  weekday: number;
  collection_time: string | null;
  /**
   * Kolom di skema awal; tidak dipakai untuk perhitungan karena jadwal bersifat
   * berulang mingguan. Tanggal pengambilan selalu diturunkan dari `weekday`.
   */
  next_collection_date: string | null;
  notes: string | null;
  created_by: string;
};

/** Jadwal beserta tanggal pengambilan terdekat dari hari acuan. */
export type UpcomingWaste = {
  schedule: WasteScheduleRecord;
  /** Tanggal `YYYY-MM-DD` pengambilan berikutnya (bisa hari acuan sendiri). */
  date: string;
  /** Selisih hari dari hari acuan: 0 = hari ini, 1 = besok, dst. */
  daysAway: number;
};
