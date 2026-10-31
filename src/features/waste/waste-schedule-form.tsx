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
import { Textarea } from "@/components/ui/textarea";
import {
  createWasteSchedule,
  type WasteActionState,
} from "@/features/waste/actions";
import {
  wasteTypeSuggestions,
  wasteScheduleSchema,
  weekdayValues,
  type WasteScheduleValues,
} from "@/features/waste/waste-schema";
import { weekdayLabels } from "@/lib/dates";

const emptyValues: WasteScheduleValues = {
  wasteType: "",
  weekday: "",
  collectionTime: "",
  notes: "",
};

/** Form penambahan pola jadwal pengambilan mingguan (khusus pemilik rumah). */
export function WasteScheduleForm() {
  const [actionState, setActionState] = useState<WasteActionState>({});
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<WasteScheduleValues>({
    resolver: zodResolver(wasteScheduleSchema),
    defaultValues: emptyValues,
  });

  const onSubmit = handleSubmit((values) => {
    setActionState({});
    const formData = new FormData();
    formData.set("wasteType", values.wasteType);
    formData.set("weekday", values.weekday);
    formData.set("collectionTime", values.collectionTime);
    formData.set("notes", values.notes);

    startTransition(async () => {
      const state = await createWasteSchedule(formData);
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
          <AlertTitle>Belum dapat menyimpan jadwal</AlertTitle>
          <AlertDescription>{actionState.error}</AlertDescription>
        </Alert>
      ) : null}

      {actionState.ok ? (
        <Alert className="border-success/35 bg-success-soft text-foreground">
          <CheckCircle2 className="text-success" aria-hidden="true" />
          <AlertTitle>Jadwal tersimpan</AlertTitle>
          <AlertDescription>
            Jadwal minggu ini dan kartu di halaman Hari Ini ikut diperbarui.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="waste-type">Jenis sampah</Label>
        <Input
          id="waste-type"
          list="waste-type-suggestions"
          placeholder="mis. Sampah bakar (燃やすごみ)"
          autoComplete="off"
          aria-invalid={Boolean(errors.wasteType)}
          aria-describedby={errors.wasteType ? "waste-type-error" : undefined}
          disabled={isPending}
          className="h-12 bg-card px-4"
          {...register("wasteType")}
        />
        <datalist id="waste-type-suggestions">
          {wasteTypeSuggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
        {errors.wasteType ? (
          <p
            id="waste-type-error"
            className="text-sm font-medium text-destructive"
          >
            {errors.wasteType.message}
          </p>
        ) : null}
      </div>

      {/* Pasangan hari + jam pakai `.form-grid-pair` (bukan `grid-cols-2` biasa):
          `select` dan `type="time"` punya intrinsic min-width sendiri, jadi di
          ponsel keduanya butuh lebar penuh. Lihat penjelasan di globals.css. */}
      <div className="form-grid-pair">
        <div className="space-y-2">
          <Label htmlFor="waste-weekday">Hari pengambilan</Label>
          <Select
            id="waste-weekday"
            disabled={isPending}
            aria-invalid={Boolean(errors.weekday)}
            aria-describedby={errors.weekday ? "waste-weekday-error" : undefined}
            className="h-12 bg-card px-3"
            {...register("weekday")}
          >
            <option value="">Pilih hari</option>
            {weekdayValues.map((value) => (
              <option key={value} value={value}>
                {weekdayLabels[Number(value)]}
              </option>
            ))}
          </Select>
          {errors.weekday ? (
            <p
              id="waste-weekday-error"
              className="text-sm font-medium text-destructive"
            >
              {errors.weekday.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="waste-time">Paling lambat</Label>
          <Input
            id="waste-time"
            type="time"
            placeholder="08:00"
            aria-invalid={Boolean(errors.collectionTime)}
            aria-describedby={
              errors.collectionTime ? "waste-time-error" : "waste-time-hint"
            }
            disabled={isPending}
            className="h-12 bg-card px-4"
            {...register("collectionTime")}
          />
          {errors.collectionTime ? (
            <p
              id="waste-time-error"
              className="text-sm font-medium text-destructive"
            >
              {errors.collectionTime.message}
            </p>
          ) : (
            <p id="waste-time-hint" className="text-xs text-muted-foreground">
              Kosongkan bila tidak ada batas jam.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="waste-notes">Panduan pemilahan</Label>
        <Textarea
          id="waste-notes"
          rows={3}
          placeholder="mis. Bilas botol, keringkan, dan pisahkan tutupnya."
          aria-invalid={Boolean(errors.notes)}
          aria-describedby={errors.notes ? "waste-notes-error" : undefined}
          disabled={isPending}
          className="bg-card px-4 py-3"
          {...register("notes")}
        />
        {errors.notes ? (
          <p id="waste-notes-error" className="text-sm font-medium text-destructive">
            {errors.notes.message}
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
        <span>{isPending ? "Menyimpan…" : "Simpan jadwal"}</span>
      </Button>
    </form>
  );
}
