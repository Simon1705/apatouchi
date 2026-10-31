"use client";

import { AlertCircle, Archive, LoaderCircle, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  deactivateChore,
  deleteChore,
  type TaskActionState,
} from "@/features/tasks/actions";
import { choreFrequencyLabels } from "@/features/tasks/task-schema";
import type { ChoreOption } from "@/features/tasks/types";

export type ChoreListProps = {
  chores: ChoreOption[];
};

/** Daftar template tugas aktif dengan aksi nonaktifkan dan hapus. */
export function ChoreList({ chores }: ChoreListProps) {
  const [actionState, setActionState] = useState<TaskActionState>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(
    action: (formData: FormData) => Promise<TaskActionState>,
    choreId: string,
  ) {
    setActionState({});
    setPendingId(choreId);
    const formData = new FormData();
    formData.set("choreId", choreId);

    startTransition(async () => {
      const state = await action(formData);
      setActionState(state);
      setPendingId(null);
    });
  }

  function handleDelete(chore: ChoreOption) {
    // Aksi destruktif: konfirmasi menyebut objek yang dihapus beserta dampaknya.
    const confirmed = window.confirm(
      `Hapus tugas "${chore.title}" beserta seluruh jadwalnya?`,
    );
    if (!confirmed) {
      return;
    }
    run(deleteChore, chore.id);
  }

  if (chores.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
        Belum ada template tugas. Tambahkan lewat form di atas.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {actionState.error ? (
        <Alert variant="destructive" role="alert">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Tidak dapat memperbarui</AlertTitle>
          <AlertDescription>{actionState.error}</AlertDescription>
        </Alert>
      ) : null}

      <ul className="overflow-hidden rounded-xl border border-border bg-card">
        {chores.map((chore) => (
          <li
            key={chore.id}
            className="flex items-center gap-3 border-border px-4 py-3 not-last:border-b"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{chore.title}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {[chore.area, choreFrequencyLabels[chore.frequency]]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Nonaktifkan"
                aria-label={`Nonaktifkan ${chore.title}`}
                disabled={isPending}
                onClick={() => run(deactivateChore, chore.id)}
                className="text-muted-foreground"
              >
                {pendingId === chore.id ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : (
                  <Archive aria-hidden="true" />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Hapus"
                aria-label={`Hapus ${chore.title}`}
                disabled={isPending}
                onClick={() => handleDelete(chore)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
