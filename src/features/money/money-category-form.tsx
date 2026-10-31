"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, LoaderCircle, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addMoneyCategory, type MoneyActionState } from "@/features/money/actions";
import {
  moneyCategoryFormSchema,
  type MoneyCategoryFormValues,
} from "@/features/money/money-schema";

/** Form penambahan kategori pengeluaran (satu field, sering dipakai di awal). */
export function MoneyCategoryForm() {
  const [actionState, setActionState] = useState<MoneyActionState>({});
  const [isPending, startTransition] = useTransition();
  const initialValues: MoneyCategoryFormValues = { name: "" };
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MoneyCategoryFormValues>({
    resolver: zodResolver(moneyCategoryFormSchema),
    defaultValues: initialValues,
  });

  const onSubmit = handleSubmit((values) => {
    setActionState({});
    const formData = new FormData();
    formData.set("name", values.name);

    startTransition(async () => {
      const state = await addMoneyCategory(formData);
      setActionState(state);
      if (state.ok) {
        reset(initialValues);
      }
    });
  });

  return (
    <form className="space-y-3" onSubmit={onSubmit} noValidate>
      {actionState.error ? (
        <Alert variant="destructive" role="alert">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Kategori belum tersimpan</AlertTitle>
          <AlertDescription>{actionState.error}</AlertDescription>
        </Alert>
      ) : null}

      {actionState.ok ? (
        <p className="text-sm font-medium text-success" role="status">
          Kategori ditambahkan.
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="category-name">Nama kategori baru</Label>
        <div className="flex gap-2">
          <Input
            id="category-name"
            placeholder="mis. Kantong sampah"
            autoComplete="off"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "category-name-error" : undefined}
            disabled={isPending}
            className="h-12 min-w-0 flex-1 bg-card px-4"
            {...register("name")}
          />
          <Button
            type="submit"
            disabled={isPending}
            className="h-12 shrink-0 gap-2 px-4 font-bold"
          >
            {isPending ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <Plus aria-hidden="true" />
            )}
            <span>{isPending ? "Menyimpan…" : "Tambah"}</span>
          </Button>
        </div>
        {errors.name ? (
          <p id="category-name-error" className="text-sm font-medium text-destructive">
            {errors.name.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
