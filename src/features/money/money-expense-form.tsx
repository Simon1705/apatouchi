"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, LoaderCircle, Minus } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  recordMoneyExpense,
  type MoneyActionState,
} from "@/features/money/actions";
import {
  moneyExpenseFormSchema,
  type MoneyExpenseFormValues,
} from "@/features/money/money-schema";
import type { MoneyCategoryRecord, MoneyMemberRecord } from "@/features/money/types";

export type MoneyExpenseFormProps = {
  members: MoneyMemberRecord[];
  categories: MoneyCategoryRecord[];
  currentUserId: string;
  today: string;
};

/**
 * Form cepat "Catat pengeluaran" untuk kebutuhan bersama (list, air, kantong sampah, dsb).
 *
 * Pilihan sumber uang sengaja dijelaskan lewat teks, bukan hanya label: pengeluaran
 * dari kaleng mengubah saldo, sedangkan pengeluaran dari uang pribadi menimbulkan
 * talangan yang harus dikembalikan.
 */
export function MoneyExpenseForm({
  members,
  categories,
  currentUserId,
  today,
}: MoneyExpenseFormProps) {
  const [actionState, setActionState] = useState<MoneyActionState>({});
  const [isPending, startTransition] = useTransition();
  const initialValues: MoneyExpenseFormValues = {
    amountJpy: "",
    memberId: currentUserId,
    categoryId: "",
    source: "box",
    occurredOn: today,
    note: "",
  };
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MoneyExpenseFormValues>({
    resolver: zodResolver(moneyExpenseFormSchema),
    defaultValues: initialValues,
  });

  const onSubmit = handleSubmit((values) => {
    setActionState({});
    const formData = new FormData();
    formData.set("amountJpy", values.amountJpy);
    formData.set("memberId", values.memberId);
    formData.set("categoryId", values.categoryId);
    formData.set("source", values.source);
    formData.set("occurredOn", values.occurredOn);
    formData.set("note", values.note);

    startTransition(async () => {
      const state = await recordMoneyExpense(formData);
      setActionState(state);
      if (state.ok) {
        reset({ ...initialValues });
      }
    });
  });

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      {actionState.error ? (
        <Alert variant="destructive" role="alert">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Belum dapat menyimpan pengeluaran</AlertTitle>
          <AlertDescription>{actionState.error}</AlertDescription>
        </Alert>
      ) : null}

      {actionState.ok ? (
        <Alert className="border-success/35 bg-success-soft text-foreground" role="status">
          <CheckCircle2 className="text-success" aria-hidden="true" />
          <AlertTitle>Pengeluaran tersimpan</AlertTitle>
          <AlertDescription>
            Riwayat dan saldo sudah diperbarui sesuai sumber uang yang dipilih.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="form-grid-pair">
        <div className="space-y-2">
          <Label htmlFor="expense-amount">Nominal (yen)</Label>
          <Input
            id="expense-amount"
            type="number"
            min={1}
            step={50}
            inputMode="numeric"
            enterKeyHint="next"
            placeholder="mis. 2800"
            autoComplete="off"
            aria-invalid={Boolean(errors.amountJpy)}
            aria-describedby={
              errors.amountJpy ? "expense-amount-error" : undefined
            }
            disabled={isPending}
            className="h-12 bg-card px-4 tabular-nums"
            {...register("amountJpy")}
          />
          {errors.amountJpy ? (
            <p
              id="expense-amount-error"
              className="text-sm font-medium text-destructive"
            >
              {errors.amountJpy.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="expense-category">Kategori</Label>
          <Select
            id="expense-category"
            disabled={isPending}
            aria-describedby={categories.length === 0 ? "expense-category-hint" : undefined}
            className="h-12 bg-card px-3"
            {...register("categoryId")}
          >
            <option value="">Tanpa kategori</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
          {categories.length === 0 ? (
            <p id="expense-category-hint" className="text-xs text-muted-foreground">
              Belum ada kategori. Tambahkan di bagian Kategori di bawah.
            </p>
          ) : null}
        </div>
      </div>

      <div className="form-grid-pair">
        <div className="space-y-2">
          <Label htmlFor="expense-source">Sumber uang</Label>
          <Select
            id="expense-source"
            disabled={isPending}
            aria-describedby="expense-source-hint"
            className="h-12 bg-card px-3"
            {...register("source")}
          >
            <option value="box">Dari kaleng kas</option>
            <option value="personal">Uang pribadi (talangan)</option>
          </Select>
          <p id="expense-source-hint" className="text-xs text-muted-foreground">
            Kaleng kas mengurangi saldo. Uang pribadi tidak mengubah saldo, tapi
            tercatat sebagai talangan yang harus dikembalikan.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="expense-member">Dicatat oleh</Label>
          <Select
            id="expense-member"
            disabled={isPending}
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
        <Label htmlFor="expense-date">Tanggal</Label>
        <Input
          id="expense-date"
          type="date"
          aria-invalid={Boolean(errors.occurredOn)}
          disabled={isPending}
          className="h-12 bg-card px-4"
          {...register("occurredOn")}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="expense-note">Catatan</Label>
        <Input
          id="expense-note"
          placeholder="mis. propane 5kg di Conoco"
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
          <Minus aria-hidden="true" />
        )}
        <span>{isPending ? "Menyimpan…" : "Simpan pengeluaran"}</span>
      </Button>
    </form>
  );
}
