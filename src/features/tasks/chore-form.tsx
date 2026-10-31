"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, LoaderCircle, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createChore, type TaskActionState } from "@/features/tasks/actions";
import {
  choreFrequencies,
  choreFrequencyLabels,
  choreSchema,
  type ChoreValues,
} from "@/features/tasks/task-schema";

const emptyValues: ChoreValues = {
  title: "",
  area: "",
  frequency: "weekly",
  description: "",
};

/** Form pembuatan template tugas (chore) untuk rumah tangga aktif. */
export function ChoreForm() {
  const [actionState, setActionState] = useState<TaskActionState>({});
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChoreValues>({
    resolver: zodResolver(choreSchema),
    defaultValues: emptyValues,
  });

  const onSubmit = handleSubmit((values) => {
    setActionState({});
    const formData = new FormData();
    formData.set("title", values.title);
    formData.set("area", values.area ?? "");
    formData.set("frequency", values.frequency);
    formData.set("description", values.description ?? "");

    startTransition(async () => {
      const state = await createChore(formData);
      setActionState(state);
      if (state.ok) {
        reset(emptyValues);
      }
    });
  });

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      {actionState.error ? (
        <Alert variant="destructive" role="alert">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Gagal menyimpan tugas</AlertTitle>
          <AlertDescription>{actionState.error}</AlertDescription>
        </Alert>
      ) : null}

      {actionState.ok ? (
        <Alert className="border-success/35 bg-success-soft text-foreground">
          <CheckCircle2 className="text-success" aria-hidden="true" />
          <AlertTitle>Tugas ditambahkan</AlertTitle>
          <AlertDescription>
            Template tugas tersimpan dan siap dijadwalkan.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="chore-title">Judul tugas</Label>
        <Input
          id="chore-title"
          placeholder="mis. Cuci piring"
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? "chore-title-error" : undefined}
          disabled={isPending}
          className="h-12 bg-card px-4"
          {...register("title")}
        />
        {errors.title ? (
          <p id="chore-title-error" className="text-sm font-medium text-destructive">
            {errors.title.message}
          </p>
        ) : null}
      </div>

      <div className="form-grid-pair">
        <div className="space-y-2">
          <Label htmlFor="chore-area">Area</Label>
          <Input
            id="chore-area"
            placeholder="opsional"
            aria-invalid={Boolean(errors.area)}
            aria-describedby={errors.area ? "chore-area-error" : undefined}
            disabled={isPending}
            className="h-12 bg-card px-4"
            {...register("area")}
          />
          {errors.area ? (
            <p id="chore-area-error" className="text-sm font-medium text-destructive">
              {errors.area.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="chore-frequency">Frekuensi</Label>
          <Select
            id="chore-frequency"
            disabled={isPending}
            className="h-12 bg-card px-3"
            {...register("frequency")}
          >
            {choreFrequencies.map((frequency) => (
              <option key={frequency} value={frequency}>
                {choreFrequencyLabels[frequency]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="chore-description">Deskripsi</Label>
        <textarea
          id="chore-description"
          placeholder="Catatan singkat (opsional)"
          rows={3}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={errors.description ? "chore-description-error" : undefined}
          disabled={isPending}
          className="w-full rounded-lg border border-input bg-card px-4 py-3 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
          {...register("description")}
        />
        {errors.description ? (
          <p
            id="chore-description-error"
            className="text-sm font-medium text-destructive"
          >
            {errors.description.message}
          </p>
        ) : null}
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
          <Plus aria-hidden="true" />
        )}
        <span>{isPending ? "Menyimpan…" : "Tambah tugas"}</span>
      </Button>
    </form>
  );
}
