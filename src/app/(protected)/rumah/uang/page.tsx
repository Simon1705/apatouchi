import { HandCoins, Scale, Wallet } from "lucide-react";
import { connection } from "next/server";

import {
  HouseholdNotReadyNotice,
  LoadErrorNotice,
  SupabaseSetupNotice,
} from "@/components/layout/household-notices";
import { SubpageHeader } from "@/components/layout/subpage-header";
import { MoneyAdvanceCard } from "@/features/money/money-advance-card";
import { MoneyBalanceCard } from "@/features/money/money-balance-card";
import { MoneyCapturePanel } from "@/features/money/money-capture-panel";
import { MoneyCategoryForm } from "@/features/money/money-category-form";
import { MoneyReconcileForm } from "@/features/money/money-reconcile-form";
import { MoneyRoundCard } from "@/features/money/money-round-card";
import { MoneyTransactionList } from "@/features/money/money-transaction-list";
import { fetchMoneyOverview } from "@/features/money/queries";
import { defaultDuesAmountJpy } from "@/features/money/money-schema";
import { todayInTokyo } from "@/lib/dates";
import { getPublicEnvironment } from "@/lib/env";
import { getHouseholdContext } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";

const header = {
  title: "Uang bersama",
  description:
    "Catat iuran dan pengeluaran kas rumah supaya tidak berdebat soal uang tunai di kaleng.",
};

/**
 * Label patungan default, mis. "Iuran Oktober 2026", dari tanggal rumah hari ini.
 * Nama hanya saran: penghuni bebas menggantinya di form.
 */
function defaultRoundLabel(today: string): string {
  const month = new Intl.DateTimeFormat("id-ID", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${today}T00:00:00Z`));

  return `Iuran ${month} ${today.slice(0, 4)}`;
}

export default async function MoneyPage() {
  await connection();

  const environment = getPublicEnvironment();

  if (!environment.isSupabaseConfigured) {
    return (
      <div className="space-y-6">
        <SubpageHeader {...header} />
        <SupabaseSetupNotice message={environment.validationMessage} />
      </div>
    );
  }

  const [context, supabase] = await Promise.all([
    getHouseholdContext(),
    createClient(),
  ]);

  if (!context || !supabase) {
    return (
      <div className="space-y-6">
        <SubpageHeader {...header} />
        <HouseholdNotReadyNotice />
      </div>
    );
  }

  const today = todayInTokyo();
  const overview = await fetchMoneyOverview(supabase, context.householdId);
  const unpaidDuesCount = overview.dues.filter(
    (entry) => entry.status !== "paid",
  ).length;
  const talanganOutstandingJpy = overview.advances.reduce(
    (total, entry) => total + entry.outstanding_jpy,
    0,
  );
  // Seksi talangan tetap tampil selama pernah ada uang pribadi terpakai, jadi
  // pelunasan terakhir menampilkan status "sudah kembali" alih-alih menghapus seksi.
  const hasTalanganHistory =
    overview.balance.advanced_jpy > 0 || overview.balance.refunded_jpy > 0;

  return (
    <div className="space-y-6">
      <SubpageHeader {...header} />

      <LoadErrorNotice messages={overview.errors} />

      <MoneyBalanceCard
        balance={overview.balance}
        round={overview.round}
        unpaidDuesCount={unpaidDuesCount}
        talanganOutstandingJpy={talanganOutstandingJpy}
      />

      <section aria-labelledby="money-round-title" className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Patungan</p>
            <h2 id="money-round-title" className="text-lg font-extrabold">
              Siapa sudah setor
            </h2>
          </div>
          <Wallet className="size-5 text-muted-foreground" aria-hidden="true" />
        </div>
        <MoneyRoundCard
          round={overview.round}
          dues={overview.dues}
          defaultRoundLabel={defaultRoundLabel(today)}
        />
      </section>

      <section aria-labelledby="money-capture-title" className="space-y-3">
        <h2 id="money-capture-title" className="text-lg font-extrabold">
          Catat uang
        </h2>
        <div className="rounded-[20px] border border-border bg-card p-4 shadow-sm">
          <MoneyCapturePanel
            members={overview.members}
            categories={overview.categories}
            currentUserId={context.userId}
            today={today}
            defaultAmountJpy={overview.round?.amount_per_person_jpy ?? defaultDuesAmountJpy}
          />
        </div>
      </section>

      <section aria-labelledby="money-reconcile-title" className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Hitung kas</p>
            <h2 id="money-reconcile-title" className="text-lg font-extrabold">
              Cocokkan dengan uang di kaleng
            </h2>
          </div>
          <Scale className="size-5 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="rounded-[20px] border border-border bg-card p-4 shadow-sm">
          <MoneyReconcileForm
            recordedBalanceJpy={overview.balance.balance_jpy}
            today={today}
          />
        </div>
      </section>

      {hasTalanganHistory ? (
        <section aria-labelledby="money-advance-title" className="space-y-3">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Talangan</p>
              <h2 id="money-advance-title" className="text-lg font-extrabold">
                Uang pribadi yang belum kembali
              </h2>
            </div>
            <HandCoins
              className="size-5 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
          <MoneyAdvanceCard
            advances={overview.advances}
            members={overview.members}
            currentUserId={context.userId}
            today={today}
            balanceJpy={overview.balance.balance_jpy}
          />
        </section>
      ) : null}

      <section aria-labelledby="money-history-title" className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Riwayat</p>
            <h2 id="money-history-title" className="text-lg font-extrabold">
              Transaksi terakhir
            </h2>
          </div>
        </div>
        <MoneyTransactionList
          transactions={overview.transactions}
          currentUserId={context.userId}
          isHouseholdOwner={context.role === "owner"}
        />
      </section>

      <section aria-labelledby="money-category-title" className="space-y-3">
        <h2 id="money-category-title" className="text-lg font-extrabold">
          Kategori
        </h2>
        {overview.categories.length > 0 ? (
          <ul className="flex flex-wrap gap-2" aria-label="Daftar kategori pengeluaran">
            {overview.categories.map((category) => (
              <li
                key={category.id}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground"
              >
                {category.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
            Belum ada kategori. Tambahkan satu di bawah, atau jalankan skrip seed
            untuk mengisi kategori yang umum dipakai.
          </p>
        )}
        <div className="rounded-[20px] border border-border bg-card p-4 shadow-sm">
          <MoneyCategoryForm />
        </div>
      </section>
    </div>
  );
}
