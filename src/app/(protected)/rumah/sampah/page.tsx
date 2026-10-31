import { Trash2 } from "lucide-react";
import { connection } from "next/server";

import {
  HouseholdNotReadyNotice,
  LoadErrorNotice,
  SupabaseSetupNotice,
} from "@/components/layout/household-notices";
import { SubpageHeader } from "@/components/layout/subpage-header";
import { WasteScheduleForm } from "@/features/waste/waste-schedule-form";
import { WasteScheduleList } from "@/features/waste/waste-schedule-list";
import { fetchWasteSchedules, toUpcomingWaste } from "@/features/waste/queries";
import { formatDateLabel, todayInTokyo, weekdayLabels } from "@/lib/dates";
import { getPublicEnvironment } from "@/lib/env";
import { getHouseholdContext } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";

const header = {
  title: "Jadwal sampah",
  description:
    "Pola pembuangan mingguan satu rumah, lengkap dengan panduan pemisahan sampah.",
};

export default async function WasteSchedulePage() {
  await connection();

  const environment = getPublicEnvironment();

  if (!environment.isSupabaseConfigured) {
    return (
      <div className="space-y-6">
        <SubpageHeader {...header} />
        <SupabaseSetupNotice message={environment.validationMessage} />
      </div>
    );
  }

  const [context, supabase] = await Promise.all([
    getHouseholdContext(),
    createClient(),
  ]);

  if (!context || !supabase) {
    return (
      <div className="space-y-6">
        <SubpageHeader {...header} />
        <HouseholdNotReadyNotice />
      </div>
    );
  }

  const wasteResult = await fetchWasteSchedules(supabase, context.householdId);
  // Jadwal berulang tiap minggu, jadi tanggal terdekat dihitung dari hari acuan
  // di zona waktu rumah, bukan dari kolom next_collection_date.
  const wasteEntries = toUpcomingWaste(wasteResult.schedules, todayInTokyo());
  const next = wasteEntries[0];
  const isOwner = context.role === "owner";

  return (
    <div className="space-y-6">
      <SubpageHeader {...header} />

      <LoadErrorNotice
        messages={[wasteResult.error].filter(
          (message): message is string => Boolean(message),
        )}
      />

      <section
        className="rounded-[20px] bg-charcoal p-5 text-white shadow-sm"
        aria-labelledby="waste-summary-title"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p
              id="waste-summary-title"
              className="text-xs font-extrabold uppercase tracking-[0.12em] text-white/60"
            >
              Pengambilan berikutnya
            </p>
            <p className="display-title mt-1 text-4xl">
              {next ? weekdayLabels[next.schedule.weekday] : "—"}
            </p>
            <p className="mt-1 text-xs text-white/60">
              {next
                ? `${next.schedule.waste_type} · ${formatDateLabel(next.date)}`
                : "Belum ada jadwal — tambahkan di bawah."}
            </p>
          </div>
          <Trash2 className="size-8 text-white/60" aria-hidden="true" />
        </div>
      </section>

      <section aria-labelledby="waste-schedule-title" className="space-y-3">
        <h2 id="waste-schedule-title" className="text-lg font-extrabold">
          Pola mingguan
        </h2>
        <WasteScheduleList entries={wasteEntries} canManage={isOwner} />
      </section>

      {isOwner ? (
        <section aria-labelledby="waste-schedule-form-title" className="space-y-3">
          <h2 id="waste-schedule-form-title" className="text-lg font-extrabold">
            Atur jadwal
          </h2>
          <div className="rounded-[20px] border border-border bg-card p-4 shadow-sm">
            <WasteScheduleForm />
          </div>
        </section>
      ) : (
        <p className="text-xs text-muted-foreground">
          Hanya pemilik rumah yang dapat menambah atau menghapus jadwal sampah.
        </p>
      )}
    </div>
  );
}
