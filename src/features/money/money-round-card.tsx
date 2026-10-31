"use client";

import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { closeMoneyRound, type MoneyActionState } from "@/features/money/actions";
import { MoneyRoundForm } from "@/features/money/money-round-form";
import {
  moneyDuesStatusLabels,
  moneyDuesStatusStyles,
} from "@/features/money/money-schema";
import type { MoneyDuesEntry, MoneyRoundRecord } from "@/features/money/types";
import { formatDateLabel } from "@/lib/dates";
import { formatMoneyLabel } from "@/lib/money";

export type MoneyRoundCardProps = {
  /** Ronde aktif; `null` bila rumah belum pernah membuka patungan. */
  round: MoneyRoundRecord | null;
  dues: MoneyDuesEntry[];
  defaultRoundLabel: string;
};

/**
 * Papan iuran patungan berjalan.
 *
 * Barisnya adalah tagihan iuran yang statusnya diturunkan dari setoran tercatat,
 * jadi satu-satunya cara mengubah "belum setor" adalah mencatat uangnya — tidak ada
 * tombol "tandai lunas" yang bisa berbeda dari isi kaleng.
 */
export function MoneyRoundCard({
  round,
  dues,
  defaultRoundLabel,
}: MoneyRoundCardProps) {
  const [actionState, setActionState] = useState<MoneyActionState>({});
  const [isPending, startTransition] = useTransition();

  if (!round) {
    return (
      <div className="space-y-4 rounded-xl border border-dashed border-border bg-card p-4">
        <div>
          <p className="text-sm font-bold">Belum ada patungan berjalan</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Buka patungan untuk menetapkan nominal per orang dan melihat siapa yang
            sudah setor. Nominal boleh diganti kapan saja lewat patungan berikutnya.
          </p>
        </div>
        <MoneyRoundForm defaultLabel={defaultRoundLabel} />
      </div>
    );
  }

  const paidCount = dues.filter((entry) => entry.status === "paid").length;

  function handleClose() {
    if (!round) {
      return;
    }

    // Aksi yang menghentikan perhitungan: konfirmasi menyebut objek yang ditutup.
    const confirmed = window.confirm(
      `Tutup patungan "${round.label}"? Tagihan iuran yang belum setor berhenti dihitung.`,
    );

    if (!confirmed) {
      return;
    }

    setActionState({});
    const formData = new FormData();
    formData.set("roundId", round.id);

    startTransition(async () => {
      setActionState(await closeMoneyRound(formData));
    });
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold">{round.label}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {`${formatMoneyLabel(round.amount_per_person_jpy)} per orang · dibuka ${formatDateLabel(round.opened_on)}`}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[0.65rem] font-extrabold ${
              paidCount === dues.length && dues.length > 0
                ? "bg-success-soft text-success"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            {`${paidCount}/${dues.length} setor`}
          </span>
        </div>

        {actionState.error ? (
          <Alert variant="destructive" className="mt-3" role="alert">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>Patungan belum ditutup</AlertTitle>
            <AlertDescription>{actionState.error}</AlertDescription>
          </Alert>
        ) : null}

        {dues.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Tagihan iuran patungan ini tidak ditemukan. Tutup lalu buka patungan baru.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border border-t border-border">
            {dues.map((entry) => (
              <li key={entry.obligation_id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{entry.member_name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {entry.status === "open"
                      ? `target ${formatMoneyLabel(entry.amount_jpy)}${
                          entry.due_on ? ` · paling lambat ${formatDateLabel(entry.due_on)}` : ""
                        }`
                      : `setor ${formatMoneyLabel(entry.settled_jpy)}${
                          entry.settled_on ? ` · ${formatDateLabel(entry.settled_on)}` : ""
                        }`}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-wide ${moneyDuesStatusStyles[entry.status]}`}
                >
                  {moneyDuesStatusLabels[entry.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {actionState.ok ? (
        <Alert className="border-success/35 bg-success-soft text-foreground" role="status">
          <CheckCircle2 className="text-success" aria-hidden="true" />
          <AlertTitle>Patungan ditutup</AlertTitle>
          <AlertDescription>Saldo tetap terbaca; buka patungan baru kapan saja.</AlertDescription>
        </Alert>
      ) : null}

      <Button
        type="button"
        variant="outline"
        disabled={isPending}
        onClick={handleClose}
        className="w-full gap-2"
      >
        {isPending ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : null}
        <span>{isPending ? "Menutup…" : "Tutup patungan ini"}</span>
      </Button>
    </div>
  );
}
