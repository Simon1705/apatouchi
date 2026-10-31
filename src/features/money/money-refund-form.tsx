"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, HandCoins, LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { refundMoneyAdvance, type MoneyActionState } from "@/features/money/actions";
import {
  moneyRefundFormSchema,
  type MoneyRefundFormValues,
} from "@/features/money/money-schema";
import type { MoneyAdvanceEntry, MoneyMemberRecord } from "@/features/money/types";
import { formatMoneyLabel } from "@/lib/money";

export type MoneyRefundFormProps = {
  /** Penghuni yang masih punya talangan; satu-satunya pilihan yang sah. */
  advances: MoneyAdvanceEntry[];
  members: MoneyMemberRecord[];
  currentUserId: string;
  today: string;
  /** Isi kaleng saat ini, untuk membatasi nominal sebelum form dikirim. */
  balanceJpy: number;
};

/**
 * Nominal default orang ini: seluruh sisa talangannya, tapi tidak pernah lebih
 * besar dari uang tunai di kaleng — menyimpan angka yang pasti ditolak server
 * hanya membuat pengguna mengira aplikasinya rusak.
 */
function defaultAmountFor(
  advances: MoneyAdvanceEntry[],
  memberId: string,
  balanceJpy: number,
): string {
  const entry = advances.find((advance) => advance.member_id === memberId);

  if (!entry) {
    return "";
  }

  return String(Math.min(entry.outstanding_jpy, Math.max(0, balanceJpy)));
}

/**
 * Form "Kembalikan talangan": kaleng kas membayar kembali uang pribadi penghuni.
 *
 * Pilihan orang dibatasi pada yang masih berhutang ke kaleng, jadi tidak ada
 * kemungkinan membayar talangan orang yang sudah lunas. Nominal ikut terisi
 * sehingga kasus paling umum (lunasi seluruhnya) cukup satu ketukan.
 */
export function MoneyRefundForm({
  advances,
  members,
  currentUserId,
  today,
  balanceJpy,
}: MoneyRefundFormProps) {
  const [actionState, setActionState] = useState<MoneyActionState>({});
  const [isPending, startTransition] = useTransition();
  const firstAdvance = advances[0];
  const initialValues: MoneyRefundFormValues = {
    amountJpy: firstAdvance
      ? defaultAmountFor(advances, firstAdvance.member_id, balanceJpy)
      : "",
    memberId: firstAdvance?.member_id ?? "",
    paidBy: currentUserId,
    occurredOn: today,
    note: "",
  };
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<MoneyRefundFormValues>({
    resolver: zodResolver(moneyRefundFormSchema),
    defaultValues: initialValues,
  });
  const memberField = register("memberId");

  const onSubmit = handleSubmit((values) => {
    setActionState({});
    const formData = new FormData();
    formData.set("amountJpy", values.amountJpy);
    formData.set("memberId", values.memberId);
    formData.set("paidBy", values.paidBy);
    formData.set("occurredOn", values.occurredOn);
    formData.set("note", values.note);

    startTransition(async () => {
      const state = await refundMoneyAdvance(formData);
      setActionState(state);
      if (state.ok) {
        // Setelah lunas, daftar orang bisa berubah saat halaman dimuat ulang dan
        // daftar lama belum pasti benar. Form dikosongkan supaya pembayaran
        // berikutnya selalu pilihan sadar, bukan ulang tombol yang sama.
        reset({ ...initialValues, memberId: "", amountJpy: "" });
      }
    });
  });

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      {actionState.error ? (
        <Alert variant="destructive" role="alert">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Pengembalian belum tercatat</AlertTitle>
          <AlertDescription>{actionState.error}</AlertDescription>
        </Alert>
      ) : null}

      {actionState.ok ? (
        <Alert
          className="border-success/35 bg-success-soft text-foreground"
          role="status"
        >
          <CheckCircle2 className="text-success" aria-hidden="true" />
          <AlertTitle>Uang pribadi sudah dikembalikan</AlertTitle>
          <AlertDescription>Saldo kaleng dan talangan sudah diperbarui.</AlertDescription>
        </Alert>
      ) : null}

      {/* Pasangan orang + nominal memakai `.form-grid-pair`: `<select>` punya
          intrinsic min-width, jadi di ponsel keduanya butuh baris sendiri. */}
      <div className="form-grid-pair">
        <div className="space-y-2">
          <Label htmlFor="refund-member">Dikembalikan kepada</Label>
          <Select
            id="refund-member"
            disabled={isPending || advances.length === 0}
            aria-invalid={Boolean(errors.memberId)}
            className="h-12 bg-card px-3"
            {...memberField}
            onChange={(event) => {
              memberField.onChange(event);
              setValue("amountJpy", defaultAmountFor(advances, event.target.value, balanceJpy), {
                shouldValidate: false,
              });
            }}
          >
            <option value="">Pilih orang</option>
            {advances.map((entry) => (
              <option key={entry.member_id} value={entry.member_id}>
                {`${entry.member_name} (${formatMoneyLabel(entry.outstanding_jpy)})`}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="refund-amount">Nominal (yen)</Label>
          <Input
            id="refund-amount"
            type="number"
            min={1}
            step={100}
            inputMode="numeric"
            enterKeyHint="next"
            autoComplete="off"
            aria-invalid={Boolean(errors.amountJpy)}
            aria-describedby={
              errors.amountJpy ? "refund-amount-error" : "refund-amount-hint"
            }
            disabled={isPending}
            className="h-12 bg-card px-4 tabular-nums"
            {...register("amountJpy")}
          />
          {errors.amountJpy ? (
            <p id="refund-amount-error" className="text-sm font-medium text-destructive">
              {errors.amountJpy.message}
            </p>
          ) : (
            <p id="refund-amount-hint" className="text-xs text-muted-foreground">
              {`Nominal terisi sesuai sisa talangan orang terpilih dan tidak akan melebihi isi kaleng ${formatMoneyLabel(balanceJpy)}.`}
            </p>
          )}
        </div>
      </div>

      <div className="form-grid-pair">
        <div className="space-y-2">
          <Label htmlFor="refund-payer">Yang menyerahkan uang</Label>
          <Select
            id="refund-payer"
            disabled={isPending || members.length === 0}
            aria-invalid={Boolean(errors.paidBy)}
            className="h-12 bg-card px-3"
            {...register("paidBy")}
          >
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.display_name}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="refund-date">Tanggal bayar</Label>
          <Input
            id="refund-date"
            type="date"
            aria-invalid={Boolean(errors.occurredOn)}
            disabled={isPending}
            className="h-12 bg-card px-4"
            {...register("occurredOn")}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="refund-note">Catatan</Label>
        <Input
          id="refund-note"
          placeholder="mis. dikasih tunai waktu di rumah"
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
        disabled={isPending || advances.length === 0}
        className="h-12 w-full gap-2 text-base font-bold shadow-sm"
      >
        {isPending ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <HandCoins aria-hidden="true" />
        )}
        <span>{isPending ? "Menyimpan…" : "Kembalikan dari kas"}</span>
      </Button>
    </form>
  );
}
