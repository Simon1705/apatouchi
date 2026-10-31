"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CalendarPlus, CheckCircle2, LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createAssignment, type TaskActionState } from "@/features/tasks/actions";
import { assignmentSchema, type AssignmentValues } from "@/features/tasks/task-schema";
import type { ChoreOption, MemberOption } from "@/features/tasks/types";
import { todayInTokyo } from "@/lib/dates";

export type AssignmentFormProps = {
  chores: ChoreOption[];
  members: MemberOption[];
};

/** Form penjadwalan sebuah chore ke anggota pada tanggal tertentu. */
export function AssignmentForm({ chores, members }: AssignmentFormProps) {
  const today = todayInTokyo();
  const [actionState, setActionState] = useState<TaskActionState>({});
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AssignmentValues>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      choreId: chores[0]?.id ?? "",
      assigneeId: members[0]?.id ?? "",
      scheduledFor: today,
    },
  });

  const isReady = chores.length > 0 && members.length > 0;

  const onSubmit = handleSubmit((values) => {
    setActionState({});
    const formData = new FormData();
    formData.set("choreId", values.choreId);
    formData.set("assigneeId", values.assigneeId);
    formData.set("scheduledFor", values.scheduledFor);

    startTransition(async () => {
      const state = await createAssignment(formData);
      setActionState(state);
      if (state.ok) {
        reset({ ...values, scheduledFor: today });
      }
    });
  });

  if (!isReady) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
        {chores.length === 0
          ? "Buat setidaknya satu template tugas sebelum menjadwalkan."
          : "Belum ada anggota rumah untuk dijadwalkan."}
      </p>
    );
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      {actionState.error ? (
        <Alert variant="destructive" role="alert">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Gagal menjadwalkan</AlertTitle>
          <AlertDescription>{actionState.error}</AlertDescription>
        </Alert>
      ) : null}

      {actionState.ok ? (
        <Alert className="border-success/35 bg-success-soft text-foreground">
          <CheckCircle2 className="text-success" aria-hidden="true" />
          <AlertTitle>Penugasan dibuat</AlertTitle>
          <AlertDescription>Tugas masuk ke jadwal rumah.</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="assignment-chore">Tugas</Label>
        <Select
          id="assignment-chore"
          disabled={isPending}
          className="h-12 bg-card px-3"
          aria-invalid={Boolean(errors.choreId)}
          aria-describedby={errors.choreId ? "assignment-chore-error" : undefined}
          {...register("choreId")}
        >
          {chores.map((chore) => (
            <option key={chore.id} value={chore.id}>
              {chore.area ? `${chore.title} — ${chore.area}` : chore.title}
            </option>
          ))}
        </Select>
        {errors.choreId ? (
          <p id="assignment-chore-error" className="text-sm font-medium text-destructive">
            {errors.choreId.message}
          </p>
        ) : null}
      </div>

      <div className="form-grid-pair">
        <div className="space-y-2">
          <Label htmlFor="assignment-assignee">Anggota</Label>
          <Select
            id="assignment-assignee"
            disabled={isPending}
            className="h-12 bg-card px-3"
            aria-invalid={Boolean(errors.assigneeId)}
            aria-describedby={
              errors.assigneeId ? "assignment-assignee-error" : undefined
            }
            {...register("assigneeId")}
          >
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.display_name}
              </option>
            ))}
          </Select>
          {errors.assigneeId ? (
            <p
              id="assignment-assignee-error"
              className="text-sm font-medium text-destructive"
            >
              {errors.assigneeId.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="assignment-date">Tanggal</Label>
          <Input
            id="assignment-date"
            type="date"
            disabled={isPending}
            className="h-12 bg-card px-3"
            aria-invalid={Boolean(errors.scheduledFor)}
            aria-describedby={
              errors.scheduledFor ? "assignment-date-error" : undefined
            }
            {...register("scheduledFor")}
          />
          {errors.scheduledFor ? (
            <p
              id="assignment-date-error"
              className="text-sm font-medium text-destructive"
            >
              {errors.scheduledFor.message}
            </p>
          ) : null}
        </div>
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={isPending}
        className="h-12 w-full gap-2 text-base font-bold shadow-sm"
      >
        {isPending ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <CalendarPlus aria-hidden="true" />
        )}
        <span>{isPending ? "Menjadwalkan…" : "Jadwalkan tugas"}</span>
      </Button>
    </form>
  );
}
