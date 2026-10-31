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
import { addShoppingItem, type ShoppingActionState } from "@/features/shopping/actions";
import {
  shoppingItemSchema,
  shoppingPriorities,
  shoppingPriorityLabels,
  type ShoppingItemValues,
} from "@/features/shopping/shopping-schema";

const emptyValues: ShoppingItemValues = {
  name: "",
  quantity: "1",
  priority: "normal",
};

/** Form penambahan barang ke daftar belanja rumah aktif. */
export function ShoppingForm() {
  const [actionState, setActionState] = useState<ShoppingActionState>({});
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ShoppingItemValues>({
    resolver: zodResolver(shoppingItemSchema),
    defaultValues: emptyValues,
  });

  const onSubmit = handleSubmit((values) => {
    setActionState({});
    const formData = new FormData();
    formData.set("name", values.name);
    formData.set("quantity", values.quantity);
    formData.set("priority", values.priority);

    startTransition(async () => {
      const state = await addShoppingItem(formData);
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
          <AlertTitle>Belum dapat menambahkan barang</AlertTitle>
          <AlertDescription>{actionState.error}</AlertDescription>
        </Alert>
      ) : null}

      {actionState.ok ? (
        <Alert className="border-success/35 bg-success-soft text-foreground">
          <CheckCircle2 className="text-success" aria-hidden="true" />
          <AlertTitle>Barang ditambahkan</AlertTitle>
          <AlertDescription>Barang masuk ke daftar rumah Anda.</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="shopping-name">Nama barang</Label>
        <Input
          id="shopping-name"
          placeholder="mis. Sabun cuci piring"
          autoComplete="off"
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "shopping-name-error" : undefined}
          disabled={isPending}
          className="h-12 bg-card px-4"
          {...register("name")}
        />
        {errors.name ? (
          <p id="shopping-name-error" className="text-sm font-medium text-destructive">
            {errors.name.message}
          </p>
        ) : null}
      </div>

      <div className="form-grid-pair">
        <div className="space-y-2">
          <Label htmlFor="shopping-quantity">Jumlah</Label>
          <Input
            id="shopping-quantity"
            type="number"
            inputMode="numeric"
            min={1}
            max={999}
            aria-invalid={Boolean(errors.quantity)}
            aria-describedby={errors.quantity ? "shopping-quantity-error" : undefined}
            disabled={isPending}
            className="h-12 bg-card px-4"
            {...register("quantity")}
          />
          {errors.quantity ? (
            <p
              id="shopping-quantity-error"
              className="text-sm font-medium text-destructive"
            >
              {errors.quantity.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="shopping-priority">Prioritas</Label>
          <Select
            id="shopping-priority"
            disabled={isPending}
            className="h-12 bg-card px-3"
            {...register("priority")}
          >
            {shoppingPriorities.map((priority) => (
              <option key={priority} value={priority}>
                {shoppingPriorityLabels[priority]}
              </option>
            ))}
          </Select>
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
          <Plus aria-hidden="true" />
        )}
        <span>{isPending ? "Menyimpan…" : "Tambah barang"}</span>
      </Button>
    </form>
  );
}
