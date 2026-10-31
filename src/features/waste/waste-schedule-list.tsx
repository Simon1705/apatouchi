"use client";

import { AlertCircle, LoaderCircle, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  deleteWasteSchedule,
  type WasteActionState,
} from "@/features/waste/actions";
import type { UpcomingWaste } from "@/features/waste/types";
import { formatDateLabel, formatTimeLabel, weekdayLabels } from "@/lib/dates";

export type WasteScheduleListProps = {
  entries: UpcomingWaste[];
  /** Jadwal hanya dapat diubah oleh pemilik rumah (kebijakan RLS). */
  canManage: boolean;
};

/** Label sisa hari yang natural: "Hari ini", "Besok", lalu hitungan hari. */
function relativeLabel(daysAway: number) {
  if (daysAway === 0) {
    return "Hari ini";
  }

  if (daysAway === 1) {
    return "Besok";
  }

  return `${daysAway} hari lagi`;
}

function relativeStyle(daysAway: number) {
  if (daysAway === 0) {
    return "bg-warning-soft text-warning";
  }

  if (daysAway === 1) {
    return "bg-accent-soft text-primary";
  }

  return "bg-secondary text-muted-foreground";
}

/** Jadwal pengambilan sampah minggu ini, urut tanggal terdekat. */
export function WasteScheduleList({ entries, canManage }: WasteScheduleListProps) {
  const [actionState, setActionState] = useState<WasteActionState>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete(entry: UpcomingWaste) {
    // Aksi destruktif: konfirmasi menyebut objek yang dihapus.
    const confirmed = window.confirm(
      `Hapus jadwal "${entry.schedule.waste_type}"?`,
    );

    if (!confirmed) {
      return;
    }

    setActionState({});
    setPendingId(entry.schedule.id);
    const formData = new FormData();
    formData.set("scheduleId", entry.schedule.id);

    startTransition(async () => {
      const state = await deleteWasteSchedule(formData);
      setActionState(state);
      setPendingId(null);
    });
  }

  if (entries.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
        {canManage
          ? "Belum ada jadwal sampah. Tambahkan lewat form di bawah."
          : "Belum ada jadwal sampah. Minta pemilik rumah mengaturnya di form bawah."}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {actionState.error ? (
        <Alert variant="destructive" role="alert">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Tidak dapat memperbarui jadwal</AlertTitle>
          <AlertDescription>{actionState.error}</AlertDescription>
        </Alert>
      ) : null}

      {actionState.ok ? (
        <p className="text-sm font-medium text-success" role="status">
          Jadwal diperbarui.
        </p>
      ) : null}

      <ul className="space-y-3">
        {entries.map((entry) => {
          const { schedule } = entry;
          const time = formatTimeLabel(schedule.collection_time);
          const meta = [
            time ? `sebelum pukul ${time}` : null,
            formatDateLabel(entry.date),
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <li
              key={schedule.id}
              className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="grid w-12 shrink-0 place-items-center rounded-xl bg-secondary py-1.5 text-center">
                <span className="text-[0.65rem] font-extrabold uppercase tracking-wide text-muted-foreground">
                  {weekdayLabels[schedule.weekday].slice(0, 3)}
                </span>
                <span className="display-title text-2xl leading-none">
                  {Number(entry.date.slice(8, 10))}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold">{schedule.waste_type}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-wide ${relativeStyle(entry.daysAway)}`}
                  >
                    {relativeLabel(entry.daysAway)}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">{meta}</p>
                {schedule.notes ? (
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {schedule.notes}
                  </p>
                ) : null}
              </div>

              {canManage ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title="Hapus jadwal"
                  aria-label={`Hapus jadwal ${schedule.waste_type}`}
                  disabled={isPending}
                  onClick={() => handleDelete(entry)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  {pendingId === schedule.id ? (
                    <LoaderCircle className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Trash2 aria-hidden="true" />
                  )}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
