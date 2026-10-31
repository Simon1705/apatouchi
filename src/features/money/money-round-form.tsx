"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, LoaderCircle, RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { openMoneyRound, type MoneyActionState } from "@/features/money/actions";
import {
  defaultDuesAmountJpy,
  moneyRoundFormSchema,
  type MoneyRoundFormValues,
} from "@/features/money/money-schema";

export type MoneyRoundFormProps = {
  /** Mis. "Iuran Oktober 2026" — nama ronde mengikuti bulan berjalan. */
  defaultLabel: string;
};

/**
 * Form membuka ronde patungan baru.
 *
 * Sekali dibuka, sistem membuat satu tagihan iuran per penghuni, jadi "siapa belum
 * setor" langsung terlihat tanpa perlu menuliskannya manual.
 */
export function MoneyRoundForm({ defaultLabel }: MoneyRoundFormProps) {
  const [actionState, setActionState] = useState<MoneyActionState>({});
  const [isPending, startTransition] = useTransition();
  const initialValues: MoneyRoundFormValues = {
    label: defaultLabel,
    amountPerPersonJpy: String(defaultDuesAmountJpy),
  };
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MoneyRoundFormValues>({
    resolver: zodResolver(moneyRoundFormSchema),
    defaultValues: initialValues,
  });

  const onSubmit = handleSubmit((values) => {
    setActionState({});
    const formData = new FormData();
    formData.set("label", values.label);
    formData.set("amountPerPersonJpy", values.amountPerPersonJpy);

    startTransition(async () => {
      const state = await openMoneyRound(formData);
      setActionState(state);
      if (state.ok) {
        reset(initialValues);
      }
    });
  });

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      {actionState.error ? (
        <Alert variant="destructive" role="alert">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Belum dapat membuka patungan</AlertTitle>
          <AlertDescription>{actionState.error}</AlertDescription>
        </Alert>
      ) : null}

      {actionState.ok ? (
        <Alert className="border-success/35 bg-success-soft text-foreground" role="status">
          <CheckCircle2 className="text-success" aria-hidden="true" />
          <AlertTitle>Patungan dibuka</AlertTitle>
          <AlertDescription>
            Tagihan iuran dibuat untuk setiap penghuni.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="round-label">Nama patungan</Label>
        <Input
          id="round-label"
          autoComplete="off"
          aria-invalid={Boolean(errors.label)}
          aria-describedby={errors.label ? "round-label-error" : "round-label-hint"}
          disabled={isPending}
          className="h-12 bg-card px-4"
          {...register("label")}
        />
        {errors.label ? (
          <p id="round-label-error" className="text-sm font-medium text-destructive">
            {errors.label.message}
          </p>
        ) : (
          <p id="round-label-hint" className="text-xs text-muted-foreground">
            Pakai nama yang mudah diingat, mis. Iuran Oktober.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="round-amount">Nominal per orang (yen)</Label>
        <Input
          id="round-amount"
          type="number"
          min={100}
          step={500}
          inputMode="numeric"
          autoComplete="off"
          aria-invalid={Boolean(errors.amountPerPersonJpy)}
          aria-describedby={
            errors.amountPerPersonJpy ? "round-amount-error" : "round-amount-hint"
          }
          disabled={isPending}
          className="h-12 bg-card px-4 tabular-nums"
          {...register("amountPerPersonJpy")}
        />
        {errors.amountPerPersonJpy ? (
          <p
            id="round-amount-error"
            className="text-sm font-medium text-destructive"
          >
            {errors.amountPerPersonJpy.message}
          </p>
        ) : (
          <p id="round-amount-hint" className="text-xs text-muted-foreground">
            Nominal boleh berbeda tiap patungan; nilai ini hanya jadi target.
          </p>
        )}
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
          <RefreshCw aria-hidden="true" />
        )}
        <span>{isPending ? "Membuka…" : "Mulai patungan"}</span>
      </Button>
    </form>
  );
}
