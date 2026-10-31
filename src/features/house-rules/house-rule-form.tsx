"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, LoaderCircle, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createHouseRule,
  type HouseRuleActionState,
} from "@/features/house-rules/actions";
import {
  houseRuleSchema,
  type HouseRuleValues,
} from "@/features/house-rules/house-rule-schema";

const emptyValues: HouseRuleValues = {
  title: "",
  content: "",
};

/** Form usulan aturan baru; status awal selalu menunggu persetujuan. */
export function HouseRuleForm() {
  const [actionState, setActionState] = useState<HouseRuleActionState>({});
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<HouseRuleValues>({
    resolver: zodResolver(houseRuleSchema),
    defaultValues: emptyValues,
  });

  const onSubmit = handleSubmit((values) => {
    setActionState({});
    const formData = new FormData();
    formData.set("title", values.title);
    formData.set("content", values.content);

    startTransition(async () => {
      const state = await createHouseRule(formData);
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
          <AlertTitle>Belum dapat mengusulkan aturan</AlertTitle>
          <AlertDescription>{actionState.error}</AlertDescription>
        </Alert>
      ) : null}

      {actionState.ok ? (
        <Alert className="border-success/35 bg-success-soft text-foreground">
          <CheckCircle2 className="text-success" aria-hidden="true" />
          <AlertTitle>Usulan tercatat</AlertTitle>
          <AlertDescription>
            Aturan masuk ke daftar menunggu persetujuan penghuni lain.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="rule-title">Judul aturan</Label>
        <Input
          id="rule-title"
          placeholder="mis. Jam tenang setelah pukul 22.30"
          autoComplete="off"
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? "rule-title-error" : undefined}
          disabled={isPending}
          className="h-12 bg-card px-4"
          {...register("title")}
        />
        {errors.title ? (
          <p id="rule-title-error" className="text-sm font-medium text-destructive">
            {errors.title.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="rule-content">Isi aturan</Label>
        <Textarea
          id="rule-content"
          rows={4}
          placeholder="Jelaskan aturannya supaya penghuni lain paham maksudnya."
          aria-invalid={Boolean(errors.content)}
          aria-describedby={
            errors.content ? "rule-content-error" : "rule-content-hint"
          }
          disabled={isPending}
          className="bg-card px-4 py-3"
          {...register("content")}
        />
        {errors.content ? (
          <p
            id="rule-content-error"
            className="text-sm font-medium text-destructive"
          >
            {errors.content.message}
          </p>
        ) : (
          <p id="rule-content-hint" className="text-xs text-muted-foreground">
            Aturan baru berlaku setelah disetujui seluruh penghuni rumah.
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
          <Plus aria-hidden="true" />
        )}
        <span>{isPending ? "Menyimpan…" : "Usulkan aturan"}</span>
      </Button>
    </form>
  );
}
