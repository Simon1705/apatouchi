import {
  ChevronRight,
  FileText,
  ScrollText,
  Trash2,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";

import {
  HouseholdNotReadyNotice,
  LoadErrorNotice,
  SupabaseSetupNotice,
} from "@/components/layout/household-notices";
import { fetchHouseRules } from "@/features/house-rules/queries";
import { fetchHouseNotes } from "@/features/notes/queries";
import { fetchMoneyMenuSummary } from "@/features/money/queries";
import { fetchWasteSchedules, toUpcomingWaste } from "@/features/waste/queries";
import { formatDateLabel, todayInTokyo, weekdayLabels } from "@/lib/dates";
import { getPublicEnvironment } from "@/lib/env";
import { getHouseholdContext } from "@/lib/household";
import { formatMoneyLabel } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

function PageHeader() {
  return (
    <header>
      <p className="eyebrow">Pusat informasi</p>
      <h1 className="display-title text-[2.65rem] leading-none">Rumah</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Kesepakatan, jadwal, dan pengingat rumah ada di sini.
      </p>
    </header>
  );
}

export default async function HousePage() {
  await connection();

  const environment = getPublicEnvironment();

  if (!environment.isSupabaseConfigured) {
    return (
      <div className="space-y-6">
        <PageHeader />
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
        <PageHeader />
        <HouseholdNotReadyNotice />
      </div>
    );
  }

  const today = todayInTokyo();

  const [rulesResult, wasteResult, notesResult, moneyResult] = await Promise.all([
    fetchHouseRules(supabase, context.householdId),
    fetchWasteSchedules(supabase, context.householdId),
    fetchHouseNotes(supabase, context.householdId),
    fetchMoneyMenuSummary(supabase, context.householdId),
  ]);

  const pendingCount = rulesResult.rules.filter(
    (rule) => rule.status === "draft" || rule.status === "pending_approval",
  ).length;
  const activeRuleCount = rulesResult.rules.filter(
    (rule) => rule.status === "active",
  ).length;
  const nextWaste = toUpcomingWaste(wasteResult.schedules, today)[0];
  const activeNoteCount = notesResult.notes.filter(
    (note) => note.status === "active",
  ).length;

  // Subtitle menu menunjukkan status terkini agar pengguna cukup sekali lihat
  // untuk tahu layar mana yang menuntut tindakan.
  const menuItems: {
    href: string;
    title: string;
    subtitle: string;
    icon: LucideIcon;
  }[] = [
    {
      href: "/rumah/aturan",
      title: "Aturan rumah",
      subtitle: rulesResult.error
        ? "Tidak dapat dimuat"
        : pendingCount > 0
          ? `${pendingCount} usulan menunggu persetujuan`
          : `${activeRuleCount} aturan berlaku`,
      icon: ScrollText,
    },
    {
      href: "/rumah/sampah",
      title: "Jadwal sampah",
      subtitle: wasteResult.error
        ? "Tidak dapat dimuat"
        : nextWaste
          ? `Berikutnya ${weekdayLabels[nextWaste.schedule.weekday]}, ${formatDateLabel(nextWaste.date)}`
          : "Belum ada jadwal",
      icon: Trash2,
    },
    {
      href: "/rumah/catatan",
      title: "Catatan rumah",
      subtitle: notesResult.error
        ? "Tidak dapat dimuat"
        : activeNoteCount > 0
          ? `${activeNoteCount} catatan aktif`
          : "Belum ada catatan",
      icon: FileText,
    },
    {
      href: "/rumah/uang",
      title: "Uang bersama",
      subtitle: moneyResult.error
        ? "Tidak dapat dimuat"
        : moneyResult.balance
          ? `${formatMoneyLabel(moneyResult.balance.balance_jpy)} di kaleng`
          : "Belum ada catatan uang",
      icon: Wallet,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader />

      <LoadErrorNotice
        messages={[
          rulesResult.error,
          wasteResult.error,
          notesResult.error,
          moneyResult.error,
        ].filter((message): message is string => Boolean(message))}
      />

      <nav aria-label="Menu rumah">
        <ul className="overflow-hidden rounded-xl border border-border bg-card">
          {menuItems.map((item) => (
            <li key={item.href} className="border-border not-last:border-b">
              <Link
                href={item.href}
                className="flex min-h-20 items-center gap-3 px-4 py-3 transition-colors hover:bg-accent-soft"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
                  <item.icon className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">{item.title}</span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {item.subtitle}
                  </span>
                </span>
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
