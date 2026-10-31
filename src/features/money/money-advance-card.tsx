import { MoneyRefundForm } from "@/features/money/money-refund-form";
import type { MoneyAdvanceEntry, MoneyMemberRecord } from "@/features/money/types";
import { formatMoneyLabel } from "@/lib/money";

export type MoneyAdvanceCardProps = {
  /** Penghuni yang masih punya sisa talangan, urut terbesar lebih dulu. */
  advances: MoneyAdvanceEntry[];
  members: MoneyMemberRecord[];
  currentUserId: string;
  today: string;
  balanceJpy: number;
};

/**
 * Daftar uang pribadi penghuni yang terpakai untuk kebutuhan bersama.
 *
 * Angkanya diturunkan dari riwayat transaksi, bukan kolom "sisa talangan", jadi
 * mengembalikan sebagian pun langsung terlihat tanpa perlu mengedit apa pun.
 */
export function MoneyAdvanceCard({
  advances,
  members,
  currentUserId,
  today,
  balanceJpy,
}: MoneyAdvanceCardProps) {
  const totalOutstandingJpy = advances.reduce(
    (total, entry) => total + entry.outstanding_jpy,
    0,
  );

  // Seksi ini sengaja tetap tampil setelah lunas: hilangnya seksi mendadak membuat
  // pengguna ragu apakah pengembaliannya benar-benar tersimpan.
  if (advances.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <p className="text-sm font-bold">Semua talangan sudah kembali</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Tidak ada uang pribadi penghuni yang masih jadi tanggungan kaleng.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div>
        <p className="text-sm font-bold">
          Kaleng berutang {formatMoneyLabel(totalOutstandingJpy)}
        </p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Pengeluaran ini dibayar uang pribadi, bukan isi kaleng — itu sebabnya
          saldo kas masih utuh. Kembalikan saat uang kas mencukupi.
        </p>
      </div>

      <ul className="divide-y divide-border border-t border-border">
        {advances.map((entry) => (
          <li key={entry.member_id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{entry.member_name}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {entry.refunded_jpy > 0
                  ? `${formatMoneyLabel(entry.advanced_jpy)} ditanggung kaleng · sudah kembali ${formatMoneyLabel(entry.refunded_jpy)}`
                  : `${formatMoneyLabel(entry.advanced_jpy)} jadi tanggungan kaleng`}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-warning-soft px-2.5 py-1 text-xs font-extrabold tabular-nums text-warning">
              {formatMoneyLabel(entry.outstanding_jpy)}
            </span>
          </li>
        ))}
      </ul>

      <MoneyRefundForm
        advances={advances}
        members={members}
        currentUserId={currentUserId}
        today={today}
        balanceJpy={balanceJpy}
      />
    </div>
  );
}
