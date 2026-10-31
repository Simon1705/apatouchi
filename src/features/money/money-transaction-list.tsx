"use client";

import { AlertCircle, LoaderCircle, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { deleteMoneyTransaction, type MoneyActionState } from "@/features/money/actions";
import {
  moneyKindLabels,
  moneyKindStyles,
} from "@/features/money/money-schema";
import type { MoneyTransactionRecord } from "@/features/money/types";
import { formatDateLabel } from "@/lib/dates";
import { formatMoneyDeltaLabel } from "@/lib/money";

export type MoneyTransactionListProps = {
  transactions: MoneyTransactionRecord[];
  /** Pengguna yang sedang login, untuk tahu catatan mana yang boleh dihapus. */
  currentUserId: string;
  /** Pemilik rumah boleh menghapus catatan siapa pun (mengikuti policy RLS). */
  isHouseholdOwner: boolean;
};

/**
 * Nama pendek sebuah baris riwayat.
 * Kategori dipakai bila ada karena itulah yang diingat penghuni ("Gas", bukan
 * "Keluar dari kas"); jenis tetap ditampilkan sebagai badge di sebelahnya.
 */
function transactionTitle(record: MoneyTransactionRecord) {
  if (record.category?.name) {
    return record.category.name;
  }

  return moneyKindLabels[record.kind];
}

/**
 * Isi konfirmasi hapus: menyebut objek yang dihapus beserta dampaknya, dan memberi
 * langkah berikutnya karena menghapus adalah satu-satunya jalan mengoreksi salah
 * catat (transaksi tidak bisa diedit).
 */
function deleteConfirmation(record: MoneyTransactionRecord) {
  const impact =
    record.kind === "dues"
      ? "Saldo kaleng akan langsung berubah dan orang itu kembali berstatus belum setor."
      : "Saldo kaleng akan langsung berubah.";

  return [
    `Hapus catatan "${transactionTitle(record)}" ${formatDateLabel(record.occurred_on)} (${formatMoneyDeltaLabel(record.amount_jpy)})?`,
    impact,
    "Kalau ini salah nominal, catat ulang dengan angka yang benar.",
  ].join(" ");
}

/** Riwayat perpindahan uang terbaru, urut tanggal, dengan aksi koreksi. */
export function MoneyTransactionList({
  transactions,
  currentUserId,
  isHouseholdOwner,
}: MoneyTransactionListProps) {
  const [actionState, setActionState] = useState<MoneyActionState>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Server Action tetap memfilter lewat RLS; tombol hanya menyembunyikan aksi yang
  // pasti ditolak database supaya pengguna tidak dikasih pilihan yang gagal.
  function canDelete(record: MoneyTransactionRecord) {
    return isHouseholdOwner || record.created_by === currentUserId;
  }

  function handleDelete(record: MoneyTransactionRecord) {
    if (!window.confirm(deleteConfirmation(record))) {
      return;
    }

    setActionState({});
    setPendingId(record.id);
    const formData = new FormData();
    formData.set("transactionId", record.id);

    startTransition(async () => {
      const state = await deleteMoneyTransaction(formData);
      setActionState(state);
      setPendingId(null);
    });
  }

  if (transactions.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
        Belum ada transaksi tercatat.
      </p>
    );
  }

  const hasOwnRecord = transactions.some(canDelete);

  return (
    <div className="space-y-3">
      {actionState.error ? (
        <Alert variant="destructive" role="alert">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Catatan belum terhapus</AlertTitle>
          <AlertDescription>{actionState.error}</AlertDescription>
        </Alert>
      ) : null}

      {actionState.ok ? (
        <p className="text-sm font-medium text-success" role="status">
          Catatan dihapus dan saldo diperbarui. Silakan catat ulang dengan nominal
          yang benar.
        </p>
      ) : null}

      <ul className="space-y-3">
        {transactions.map((record) => (
          <li
            key={record.id}
            className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold">{transactionTitle(record)}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-wide ${moneyKindStyles[record.kind]}`}
                >
                  {moneyKindLabels[record.kind]}
                </span>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {`${record.payer?.display_name ?? "Penghuni"} · ${formatDateLabel(record.occurred_on)}`}
              </p>
              {record.note ? (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {record.note}
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {/* Nominal bertanda dan berwarna, tapi warnanya selalu didampingi tanda
                  +/- agar buta warna tetap bisa membedakan masuk dan keluar. */}
              <p
                className={`text-sm font-extrabold tabular-nums ${
                  record.amount_jpy > 0 ? "text-success" : "text-foreground"
                }`}
              >
                {formatMoneyDeltaLabel(record.amount_jpy)}
              </p>
              {canDelete(record) ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title="Hapus catatan"
                  aria-label={`Hapus catatan ${transactionTitle(record)} ${formatDateLabel(record.occurred_on)}`}
                  disabled={isPending}
                  onClick={() => handleDelete(record)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  {pendingId === record.id ? (
                    <LoaderCircle className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Trash2 aria-hidden="true" />
                  )}
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {!hasOwnRecord ? (
        <p className="text-xs leading-5 text-muted-foreground">
          Hanya catatan yang Anda buat sendiri yang bisa dihapus. Kalau yang perlu
          dikoreksi punya penghuni lain, minta dia menghapusnya atau minta pemilik
          rumah.
        </p>
      ) : null}
    </div>
  );
}
