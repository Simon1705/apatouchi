"use client";

import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  RotateCcw,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  completeAssignment,
  reopenAssignment,
  type TaskActionState,
} from "@/features/tasks/actions";
import {
  assignmentStatusLabels,
  assignmentStatusStyles,
  choreFrequencyLabels,
} from "@/features/tasks/task-schema";
import type { AssignmentRecord } from "@/features/tasks/types";
import { formatDateLabel } from "@/lib/dates";
import type { HouseholdRole } from "@/lib/household";

export type AssignmentListProps = {
  assignments: AssignmentRecord[];
  currentUserId: string;
  currentRole: HouseholdRole;
};

type FilterKey = "all" | "pending" | "completed";

const filters: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "pending", label: "Aktif" },
  { key: "completed", label: "Selesai" },
];

/** Daftar penugasan dengan filter status dan aksi selesai/buka kembali. */
export function AssignmentList({
  assignments,
  currentUserId,
  currentRole,
}: AssignmentListProps) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [actionState, setActionState] = useState<TaskActionState>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const visible = useMemo(() => {
    if (filter === "pending") {
      return assignments.filter((item) => item.status === "pending");
    }
    if (filter === "completed") {
      return assignments.filter((item) => item.status === "completed");
    }
    return assignments;
  }, [assignments, filter]);

  function run(
    action: (formData: FormData) => Promise<TaskActionState>,
    assignmentId: string,
  ) {
    setActionState({});
    setPendingId(assignmentId);
    const formData = new FormData();
    formData.set("assignmentId", assignmentId);

    startTransition(async () => {
      const state = await action(formData);
      setActionState(state);
      setPendingId(null);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2" role="group" aria-label="Filter status tugas">
        {filters.map((item) => (
          <Button
            key={item.key}
            type="button"
            size="sm"
            variant={filter === item.key ? "secondary" : "ghost"}
            aria-pressed={filter === item.key}
            onClick={() => setFilter(item.key)}
            className="flex-1"
          >
            {item.label}
          </Button>
        ))}
      </div>

      {actionState.error ? (
        <Alert variant="destructive" role="alert">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Tidak dapat memperbarui</AlertTitle>
          <AlertDescription>{actionState.error}</AlertDescription>
        </Alert>
      ) : null}

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          {assignments.length === 0
            ? "Belum ada tugas terjadwal."
            : "Tidak ada tugas pada filter ini."}
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((assignment) => {
            const canModify =
              assignment.assignee_id === currentUserId ||
              assignment.created_by === currentUserId ||
              currentRole === "owner";
            const meta = [
              assignment.chore?.area,
              assignment.chore
                ? choreFrequencyLabels[assignment.chore.frequency]
                : null,
              assignment.assignee?.display_name,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <li
                key={assignment.id}
                className="rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">
                      {assignment.chore?.title ?? "Tugas"}
                    </p>
                    {meta ? (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {meta}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs font-semibold text-foreground/80">
                      {formatDateLabel(assignment.scheduled_for)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[0.65rem] font-extrabold uppercase tracking-wide ${assignmentStatusStyles[assignment.status]}`}
                  >
                    {assignmentStatusLabels[assignment.status]}
                  </span>
                </div>

                {canModify && assignment.status !== "skipped" ? (
                  <div className="mt-3 flex justify-end">
                    {assignment.status === "pending" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={isPending}
                        onClick={() => run(completeAssignment, assignment.id)}
                        className="gap-1.5"
                      >
                        {pendingId === assignment.id ? (
                          <LoaderCircle className="animate-spin" aria-hidden="true" />
                        ) : (
                          <CheckCircle2 aria-hidden="true" />
                        )}
                        <span>Tandai selesai</span>
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={isPending}
                        onClick={() => run(reopenAssignment, assignment.id)}
                        className="gap-1.5 text-muted-foreground"
                      >
                        {pendingId === assignment.id ? (
                          <LoaderCircle className="animate-spin" aria-hidden="true" />
                        ) : (
                          <RotateCcw aria-hidden="true" />
                        )}
                        <span>Buka kembali</span>
                      </Button>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
