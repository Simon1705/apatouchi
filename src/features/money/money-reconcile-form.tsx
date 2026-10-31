"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, LoaderCircle, Scale } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { reconcileMoneyCash, type MoneyActionState } from "@/features/money/actions";
import {
  moneyAdjustFormSchema,
  type MoneyAdjustFormValues,
} from "@/features/money/money-schema";
import { formatMoneyDeltaLabel, formatMoneyLabel } from "@/lib/money";

export type MoneyReconcileFormProps = {
  /** Saldo hasil catatan, jadi pengguna tahu dari angka mana selisih dihitung. */
  recordedBalanceJpy: number;
  today: string;
};

/**
 * Selisih antara uang yang baru dihitung dan saldo catatan.
 *
 * `null` berarti input belum layak dihitung (kosong atau bukan angka) — tampilan
 * tidak boleh menampilkan "¥0" yang kelihatan seperti hasil perhitungan sungguhan.
 */
function differenceFrom(counted: string, recordedBalanceJpy: number): number | null {
  if (!/^\d+$/.test(counted.trim())) {
    return null;
  }

  return Number.parseInt(counted, 10) - recordedBalanceJpy;
}

/** Keterangan selisih dalam bahasa penghuni, bukan istilah akuntansi. */
function differenceCaption(deltaJpy: number, recordedBalanceJpy: number): string {
  if (deltaJpy === 0) {
    return `Sama dengan catatan ${formatMoneyLabel(recordedBalanceJpy)} — tidak ada yang perlu dikoreksi.`;
  }

  const direction = deltaJpy > 0 ? "lebih banyak" : "kurang";

  return `Selisih ${formatMoneyDeltaLabel(deltaJpy)}: kaleng ${direction} dari catatan ${formatMoneyLabel(recordedBalanceJpy)}.`;
}

/**
 * Form "Hitung kas": menghitung uang fisik di kaleng lalu menyamakan catatan.
 *
 * Selisih ditampilkan saat angka diketik, jadi pengguna bisa menyadari kalau ia
 * salah ketik sebelum koreksi masuk ke riwayat. Nominal koreksi tidak pernah
 * diketik — yang diketik adalah hasil hitungan, selisihnya dihitung aplikasi.
 */
export function MoneyReconcileForm({
  recordedBalanceJpy,
  today,
}: MoneyReconcileFormProps) {
  const [actionState, setActionState] = useState<MoneyActionState>({});
  const [countedValue, setCountedValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const initialValues: MoneyAdjustFormValues = {
    countedAmountJpy: "",
    occurredOn: today,
    note: "",
  };
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MoneyAdjustFormValues>({
    resolver: zodResolver(moneyAdjustFormSchema),
    defaultValues: initialValues,
  });
  const countedField = register("countedAmountJpy");
  const deltaJpy = differenceFrom(countedValue, recordedBalanceJpy);

  const onSubmit = handleSubmit((values) => {
    setActionState({});
    const formData = new FormData();
    formData.set("countedAmountJpy", values.countedAmountJpy);
    formData.set("occurredOn", values.occurredOn);
    formData.set("note", values.note);

    startTransition(async () => {
      const state = await reconcileMoneyCash(formData);
      setActionState(state);
      if (state.ok) {
        setCountedValue("");
        reset(initialValues);
      }
    });
  });

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      {actionState.error ? (
        <Alert variant="destructive" role="alert">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Koreksi belum tercatat</AlertTitle>
          <AlertDescription>{actionState.error}</AlertDescription>
        </Alert>
      ) : null}

      {actionState.ok ? (
        <Alert
          className="border-success/35 bg-success-soft text-foreground"
          role="status"
        >
          <CheckCircle2 className="text-success" aria-hidden="true" />
          <AlertTitle>Catatan disamakan</AlertTitle>
          <AlertDescription>
            Saldo sekarang sama dengan uang yang Anda hitung.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="form-grid-pair">
        <div className="space-y-2">
          <Label htmlFor="adjust-counted">Hasil hitungan (yen)</Label>
          <Input
            id="adjust-counted"
            type="number"
            min={0}
            step={100}
            inputMode="numeric"
            enterKeyHint="next"
            autoComplete="off"
            placeholder={String(recordedBalanceJpy)}
            aria-invalid={Boolean(errors.countedAmountJpy)}
            aria-describedby={
              errors.countedAmountJpy ? "adjust-counted-error" : "adjust-counted-hint"
            }
            disabled={isPending}
            className="h-12 bg-card px-4 tabular-nums"
            {...countedField}
            onChange={(event) => {
              countedField.onChange(event);
              setCountedValue(event.target.value);
            }}
          />
          {errors.countedAmountJpy ? (
            <p
              id="adjust-counted-error"
              className="text-sm font-medium text-destructive"
            >
              {errors.countedAmountJpy.message}
            </p>
          ) : (
            <p
              id="adjust-counted-hint"
              className="text-xs text-muted-foreground"
              aria-live="polite"
            >
              {deltaJpy === null
                ? `Saldo catatan ${formatMoneyLabel(recordedBalanceJpy)}.`
                : differenceCaption(deltaJpy, recordedBalanceJpy)}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="adjust-date">Tanggal hitung</Label>
          <Input
            id="adjust-date"
            type="date"
            aria-invalid={Boolean(errors.occurredOn)}
            disabled={isPending}
            className="h-12 bg-card px-4"
            {...register("occurredOn")}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="adjust-note">Alasan koreksi</Label>
        <Input
          id="adjust-note"
          placeholder="mis. hitung ulang kaleng, kembalian belum dicatat"
          autoComplete="off"
          aria-invalid={Boolean(errors.note)}
          aria-describedby={errors.note ? "adjust-note-error" : "adjust-note-hint"}
          disabled={isPending}
          className="h-12 bg-card px-4"
          {...register("note")}
        />
        {errors.note ? (
          <p id="adjust-note-error" className="text-sm font-medium text-destructive">
            {errors.note.message}
          </p>
        ) : (
          <p id="adjust-note-hint" className="text-xs text-muted-foreground">
            Wajib diisi — koreksi mengubah saldo tanpa ada uang masuk atau keluar.
          </p>
        )}
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={isPending || deltaJpy === 0}
        className="h-12 w-full gap-2 text-base font-bold shadow-sm"
      >
        {isPending ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <Scale aria-hidden="true" />
        )}
        <span>
          {isPending
            ? "Menyimpan…"
            : deltaJpy === null || deltaJpy === 0
              ? "Catat koreksi"
              : `Catat koreksi ${formatMoneyDeltaLabel(deltaJpy)}`}
        </span>
      </Button>
    </form>
  );
}
