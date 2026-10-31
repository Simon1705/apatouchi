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
import { recordMoneyDues, type MoneyActionState } from "@/features/money/actions";
import {
  moneyDuesFormSchema,
  type MoneyDuesFormValues,
} from "@/features/money/money-schema";
import type { MoneyMemberRecord } from "@/features/money/types";
import { formatMoneyLabel } from "@/lib/money";

export type MoneyDuesFormProps = {
  members: MoneyMemberRecord[];
  currentUserId: string;
  /** Tanggal rumah hari ini (`YYYY-MM-DD`); hampir semua setoran dicatat pada hari itu. */
  today: string;
  /** Nominal iuran ronde aktif, dipakai sebagai nilai awal. */
  defaultAmountJpy: number;
};

/**
 * Form cepat "Tambah uang": satu penghuni menyetor uang ke kaleng kas.
 *
 * Dioptimalkan untuk pemakaian berulang — nominal dan tanggal sudah terisi,
 * jadi setoran normal hanya butuh satu atau dua ketikan.
 */
export function MoneyDuesForm({
  members,
  currentUserId,
  today,
  defaultAmountJpy,
}: MoneyDuesFormProps) {
  const [actionState, setActionState] = useState<MoneyActionState>({});
  const [isPending, startTransition] = useTransition();
  const initialValues: MoneyDuesFormValues = {
    amountJpy: String(defaultAmountJpy),
    memberId: currentUserId,
    occurredOn: today,
    note: "",
  };
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MoneyDuesFormValues>({
    resolver: zodResolver(moneyDuesFormSchema),
    defaultValues: initialValues,
  });

  const onSubmit = handleSubmit((values) => {
    setActionState({});
    const formData = new FormData();
    formData.set("amountJpy", values.amountJpy);
    formData.set("memberId", values.memberId);
    formData.set("occurredOn", values.occurredOn);
    formData.set("note", values.note);

    startTransition(async () => {
      const state = await recordMoneyDues(formData);
      setActionState(state);
      if (state.ok) {
        // Nominal kembali ke target ronde agar setoran berikutnya tinggal tekan simpan.
        reset({ ...initialValues, note: "" });
      }
    });
  });

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      {actionState.error ? (
        <Alert variant="destructive" role="alert">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Belum dapat menyimpan setoran</AlertTitle>
          <AlertDescription>{actionState.error}</AlertDescription>
        </Alert>
      ) : null}

      {actionState.ok ? (
        <Alert className="border-success/35 bg-success-soft text-foreground" role="status">
          <CheckCircle2 className="text-success" aria-hidden="true" />
          <AlertTitle>Uang masuk kas</AlertTitle>
          <AlertDescription>
            Saldo dan papan iuran sudah diperbarui.
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Pasangan nominal + penghuni memakai `.form-grid-pair`: `<select>` punya
          intrinsic min-width, jadi di ponsel keduanya butuh baris sendiri. */}
      <div className="form-grid-pair">
        <div className="space-y-2">
          <Label htmlFor="dues-amount">Nominal (yen)</Label>
          <Input
            id="dues-amount"
            type="number"
            min={1}
            step={100}
            inputMode="numeric"
            enterKeyHint="next"
            autoComplete="off"
            aria-invalid={Boolean(errors.amountJpy)}
            aria-describedby={errors.amountJpy ? "dues-amount-error" : "dues-amount-hint"}
            disabled={isPending}
            className="h-12 bg-card px-4 tabular-nums"
            {...register("amountJpy")}
          />
          {errors.amountJpy ? (
            <p id="dues-amount-error" className="text-sm font-medium text-destructive">
              {errors.amountJpy.message}
            </p>
          ) : (
            <p id="dues-amount-hint" className="text-xs text-muted-foreground">
              Target patungan {formatMoneyLabel(defaultAmountJpy)} per orang.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="dues-member">Yang menyetor</Label>
          <Select
            id="dues-member"
            disabled={isPending}
            aria-invalid={Boolean(errors.memberId)}
            className="h-12 bg-card px-3"
            {...register("memberId")}
          >
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.display_name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="dues-date">Tanggal setor</Label>
        <Input
          id="dues-date"
          type="date"
          aria-invalid={Boolean(errors.occurredOn)}
          disabled={isPending}
          className="h-12 bg-card px-4"
          {...register("occurredOn")}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="dues-note">Catatan</Label>
        <Input
          id="dues-note"
          placeholder="mis. uang kembalian dari belanja"
          autoComplete="off"
          aria-invalid={Boolean(errors.note)}
          disabled={isPending}
          className="h-12 bg-card px-4"
          {...register("note")}
        />
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={isPending || members.length === 0}
        className="h-12 w-full gap-2 text-base font-bold shadow-sm"
      >
        {isPending ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <Plus aria-hidden="true" />
        )}
        <span>{isPending ? "Menyimpan…" : "Tambah uang ke kas"}</span>
      </Button>
    </form>
  );
}
