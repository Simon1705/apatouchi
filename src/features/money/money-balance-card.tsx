import { PiggyBank } from "lucide-react";

import type { MoneyBalanceRecord, MoneyRoundRecord } from "@/features/money/types";
import { formatMoneyDeltaLabel, formatMoneyLabel } from "@/lib/money";

export type MoneyBalanceCardProps = {
  balance: MoneyBalanceRecord;
  /** Ronde patungan aktif; `null` bila belum pernah dibuka. */
  round: MoneyRoundRecord | null;
  /** Jumlah penghuni yang setorannya belum lengkap pada ronde aktif. */
  unpaidDuesCount: number;
  /** Sisa talangan yang belum dikembalikan, total semua penghuni. */
  talanganOutstandingJpy: number;
};

/**
 * Kartu saldo kaleng kas.
 *
 * Angka utama adalah saldo fisik hasil catatan, bukan total kekayaan rumah.
 * Peringatan "hampir habis" hanya muncul saat saldo di bawah satu iuran, supaya
 * layar tidak berteriak ketika keadaan sebenarnya baik-baik saja.
 *
 * Talangan memakai sisa yang belum dikembalikan, bukan total pengeluaran pribadi:
 * sebagian yang sudah dibayar balik dari kaleng tidak boleh lagi disebut utang.
 */
export function MoneyBalanceCard({
  balance,
  round,
  unpaidDuesCount,
  talanganOutstandingJpy,
}: MoneyBalanceCardProps) {
  const isRunningLow =
    round !== null && balance.balance_jpy < round.amount_per_person_jpy;

  // Rincian di bawah saldo hanya menyebut komponen yang terisi, jadi angkanya selalu
  // bisa direkonstruksi penghuni — termasuk setelah ada pengembalian talangan atau
  // koreksi hasil hitung kas, yang sebelumnya membuat baris ini tidak lagi cocok.
  const breakdownParts = [
    `iuran ${formatMoneyLabel(balance.dues_in_jpy)}`,
    `keluar ${formatMoneyLabel(balance.spent_jpy)}`,
  ];

  if (balance.refunded_jpy > 0) {
    breakdownParts.push(
      `talangan dibayar ${formatMoneyLabel(balance.refunded_jpy)}`,
    );
  }

  if (balance.adjusted_jpy !== 0) {
    breakdownParts.push(`koreksi ${formatMoneyDeltaLabel(balance.adjusted_jpy)}`);
  }

  return (
    <section
      className="rounded-[20px] bg-charcoal p-5 text-white shadow-sm"
      aria-labelledby="money-balance-title"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p
            id="money-balance-title"
            className="text-xs font-extrabold uppercase tracking-[0.12em] text-white/60"
          >
            Saldo kas rumah
          </p>
          <p className="display-title mt-1 text-4xl">
            {formatMoneyLabel(balance.balance_jpy)}
          </p>
          <p className="mt-1 text-xs text-white/70">{breakdownParts.join(" · ")}</p>
        </div>
        <PiggyBank className="size-8 shrink-0 text-white/60" aria-hidden="true" />
      </div>

      <div className="mt-4 space-y-1 border-t border-white/15 pt-3 text-xs text-white/70">
        {talanganOutstandingJpy > 0 ? (
          <p>
            Ada talangan{" "}
            <span className="font-bold text-white">
              {formatMoneyLabel(talanganOutstandingJpy)}
            </span>{" "}
            dari uang pribadi yang belum dikembalikan.
          </p>
        ) : null}

        {unpaidDuesCount > 0 ? (
          <p>
            <span className="font-bold text-white">{unpaidDuesCount}</span> penghuni
            belum setor penuh pada patungan berjalan.
          </p>
        ) : null}

        {isRunningLow ? (
          <p className="font-bold text-white">
            Kaleng hampir kosong — waktunya patungan lagi.
          </p>
        ) : null}

        {!round ? (
          <p>Belum ada patungan berjalan. Buka satu untuk memulai catatan uang.</p>
        ) : null}
      </div>
    </section>
  );
}
