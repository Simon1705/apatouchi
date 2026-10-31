import {
  Ban,
  BellRing,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileText,
  ShoppingBag,
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
import { countNeededItems } from "@/features/shopping/queries";
import { fetchAssignmentsInRange } from "@/features/tasks/queries";
import { fetchHouseNoteHighlights } from "@/features/notes/queries";
import { fetchMoneyTodaySummary } from "@/features/money/queries";
import type { MoneyTodaySummary } from "@/features/money/types";
import type { NextWasteSummary } from "@/features/waste/queries";
import { fetchNextWasteSummary } from "@/features/waste/queries";
import {
  assignmentStatusLabels,
  assignmentStatusStyles,
  type AssignmentStatus,
} from "@/features/tasks/task-schema";
import type { AssignmentRecord } from "@/features/tasks/types";
import {
  formatDateLabel,
  formatRelativeDayLabel,
  formatTimeLabel,
  todayInTokyo,
  tokyoDateFromIso,
  tokyoDateOffset,
  weekdayLabels,
} from "@/lib/dates";
import { getPublicEnvironment } from "@/lib/env";
import { getHouseholdContext } from "@/lib/household";
import { formatMoneyLabel } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

// Tugas pending yang jauh lebih lama dari ini tidak lagi dianggap pekerjaan
// hari ini; window sama dengan jendela jadwal pada halaman Tugas.
const OVERDUE_WINDOW_DAYS = 30;

const statusIcons: Record<AssignmentStatus, LucideIcon> = {
  pending: BellRing,
  completed: CheckCircle2,
  skipped: Ban,
};

const statusRank: Record<AssignmentStatus, number> = {
  pending: 0,
  completed: 1,
  skipped: 2,
};

function formatToday() {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Tokyo",
  }).format(new Date());
}

function assignmentMeta(assignment: AssignmentRecord) {
  return [assignment.chore?.area, assignment.assignee?.display_name]
    .filter(Boolean)
    .join(" · ");
}

/** Selisih hari antara tanggal tugas yang terlewat dengan hari ini. */
function daysLate(scheduledFor: string, today: string) {
  const diffMs =
    Date.parse(`${today}T00:00:00Z`) - Date.parse(`${scheduledFor}T00:00:00Z`);

  return Math.max(1, Math.round(diffMs / 86_400_000));
}

/** Urutkan: yang belum dikerjakan dulu, lalu judul agar daftar stabil. */
function byStatusThenTitle(a: AssignmentRecord, b: AssignmentRecord) {
  const rank = statusRank[a.status] - statusRank[b.status];

  if (rank !== 0) {
    return rank;
  }

  return (a.chore?.title ?? "").localeCompare(b.chore?.title ?? "");
}

/**
 * Isi kartu "Sampah": tanggal terdekat diberi label hari singkat, sisanya menjadi
 * satu baris meta yang menyebut jenis, sisa hari, dan batas jam bila ada.
 */
function wasteCard(result: NextWasteSummary) {
  if (result.error) {
    return { headline: "—", meta: result.error };
  }

  const entry = result.next;

  if (!entry) {
    return { headline: "—", meta: "Belum ada jadwal — atur di tab Rumah." };
  }

  const time = formatTimeLabel(entry.schedule.collection_time);
  const when =
    entry.daysAway === 0
      ? "hari ini"
      : entry.daysAway === 1
        ? "besok"
        : `${entry.daysAway} hari lagi`;
  const types =
    result.additionalTypes > 0
      ? `${entry.schedule.waste_type} +${result.additionalTypes}`
      : entry.schedule.waste_type;

  return {
    headline: weekdayLabels[entry.schedule.weekday].slice(0, 3),
    meta: [types, when, time ? `sebelum ${time}` : null]
      .filter(Boolean)
      .join(" · "),
  };
}

/**
 * Isi kartu "Uang bersama": saldo sebagai angka utama, lalu satu baris yang
 * menunjuk tindakan (setor iuran).
 *
 * "0 orang belum setor" tanpa patungan berjalan akan terbaca seperti kabar baik,
 * padahal patungannya belum pernah dibuka — karena itu keadaan tanpa ronde diberi
 * tanda hubung dan penjelasannya dipindah ke keterangan saldo. Bila salah satu baca
 * gagal, seluruh sel ikut berisi tanda hubung: menampilkan ¥0 yang salah lebih
 * berbahaya daripada tidak menampilkan angka, karena bisa memicu setor ganda.
 */
function moneyStrip(summary: MoneyTodaySummary) {
  if (summary.errors.length > 0) {
    const reason = summary.errors[0] ?? "Tidak dapat dimuat.";

    return {
      headline: "—",
      caption: reason,
      dues: { value: "—", hint: "Belum dapat dimuat" },
    };
  }

  const hasRound = summary.round_label !== null;

  return {
    headline: formatMoneyLabel(summary.balance_jpy),
    caption: hasRound
      ? `di kaleng · patungan ${summary.round_label}`
      : "di kaleng · patungan belum dibuka",
    dues: {
      value: hasRound
        ? summary.unpaid_dues_count > 0
          ? `${summary.unpaid_dues_count} orang`
          : "Aman"
        : "—",
      hint: hasRound
        ? summary.unpaid_dues_count > 0
          ? "belum setor"
          : "semua sudah setor"
        : "mulai patungan dulu",
    },
  };
}

function PageHeader() {
  return (
    <header>
      <p className="eyebrow">{formatToday()}</p>
      <h1 className="display-title text-[2.65rem] leading-none">Hari Ini</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Semua yang perlu diperhatikan di rumah, dalam satu pandangan.
      </p>
    </header>
  );
}

/** Baris ringkas satu penugasan; `caption` menandai terlambat, `dateLabel` tanggal asli. */
function AssignmentRow({
  assignment,
  caption,
  dateLabel,
}: {
  assignment: AssignmentRecord;
  caption?: string;
  dateLabel?: string;
}) {
  const Icon = statusIcons[assignment.status];
  const statusLabel = assignmentStatusLabels[assignment.status];
  const detail = [caption, dateLabel, assignmentMeta(assignment)]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex min-h-20 items-center gap-3 border-border p-4 not-last:border-b">
      <span
        className={`grid size-10 shrink-0 place-items-center rounded-xl ${assignmentStatusStyles[assignment.status]}`}
      >
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">
          {assignment.chore?.title ?? "Tugas"}
        </p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {detail || statusLabel}
        </p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-[0.65rem] font-extrabold uppercase tracking-wide ${assignmentStatusStyles[assignment.status]}`}
      >
        {statusLabel}
      </span>
    </div>
  );
}

export default async function TodayPage() {
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

  const [assignmentResult, shoppingResult, wasteResult, noteResult, moneyResult] =
    await Promise.all([
      fetchAssignmentsInRange(
        supabase,
        context.householdId,
        tokyoDateOffset(-OVERDUE_WINDOW_DAYS),
        today,
      ),
      countNeededItems(supabase, context.householdId),
      fetchNextWasteSummary(supabase, context.householdId, today),
      // Kartu catatan menampilkan sematan lebih dulu, lalu perubahan terbaru.
      fetchHouseNoteHighlights(supabase, context.householdId, 2),
      fetchMoneyTodaySummary(supabase, context.householdId),
    ]);

  const loadErrors: string[] = [];

  if (assignmentResult.error) {
    loadErrors.push(assignmentResult.error);
  }

  if (shoppingResult.error) {
    loadErrors.push(shoppingResult.error);
  }

  if (wasteResult.error) {
    loadErrors.push(wasteResult.error);
  }

  if (noteResult.error) {
    loadErrors.push(noteResult.error);
  }

  loadErrors.push(...moneyResult.errors);

  // Tanggal `YYYY-MM-DD` bisa dibandingkan sebagai string.
  const overdue = assignmentResult.assignments
    .filter(
      (assignment) =>
        assignment.status === "pending" && assignment.scheduled_for < today,
    )
    .sort(
      (a, b) =>
        a.scheduled_for.localeCompare(b.scheduled_for) ||
        byStatusThenTitle(a, b),
    );
  const highlights = assignmentResult.assignments
    .filter((assignment) => assignment.scheduled_for === today)
    .sort(byStatusThenTitle);

  const myOpen = [...overdue, ...highlights].filter(
    (assignment) =>
      assignment.status === "pending" && assignment.assignee_id === context.userId,
  );
  const myOverdueCount = myOpen.filter(
    (assignment) => assignment.scheduled_for < today,
  ).length;
  const myOpenTitle =
    myOpen.length === 1
      ? (myOpen[0]?.chore?.title ?? "Tugas")
      : `${myOpen.length} tugas menunggu Anda`;

  const waste = wasteCard(wasteResult);
  const money = moneyStrip(moneyResult);

  return (
    <div className="space-y-6">
      <PageHeader />

      <LoadErrorNotice messages={loadErrors} />

      <section
        className="relative overflow-hidden rounded-[20px] bg-charcoal p-5 text-white shadow-sm"
        aria-labelledby="task-summary-title"
      >
        <div className="absolute -right-8 -top-10 size-32 rounded-full border border-white/10" />
        <div className="absolute -right-2 top-2 size-20 rounded-full border border-white/10" />
        <div className="relative">
          <div className="mb-10 flex items-start justify-between gap-4">
            {myOpen.length > 0 ? (
              <span className="rounded-full bg-warning-soft px-3 py-1 text-xs font-extrabold text-warning">
                Giliran Anda
              </span>
            ) : (
              <span />
            )}
            <ClipboardCheck className="size-6 text-white/70" aria-hidden="true" />
          </div>
          {myOpen.length > 0 ? (
            <>
              <h2 id="task-summary-title" className="text-xl font-extrabold">
                {myOpenTitle}
              </h2>
              <p className="mt-2 text-sm text-white/70">
                {myOverdueCount > 0
                  ? `${myOverdueCount} di antaranya sudah lewat tanggal. Selesaikan hari ini.`
                  : "Selesaikan dari tab Tugas atau daftar di bawah."}
              </p>
            </>
          ) : (
            <>
              <h2 id="task-summary-title" className="text-xl font-extrabold">
                Tidak ada giliran Anda hari ini
              </h2>
              <p className="mt-2 text-sm text-white/70">
                Tugas rumah yang lain tetap terlihat di sorotan berikut.
              </p>
            </>
          )}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3" aria-label="Ringkasan cepat">
        <article className="min-h-40 rounded-[18px] border border-primary/25 bg-accent-soft p-4">
          <div className="flex items-center justify-between gap-2 text-primary">
            <span className="text-xs font-extrabold uppercase tracking-[0.12em]">
              Sampah
            </span>
            <Trash2 className="size-5" aria-hidden="true" />
          </div>
          <p className="display-title mt-7 text-3xl">{waste.headline}</p>
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {waste.meta}
          </p>
        </article>
        <article className="min-h-40 rounded-[18px] border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 text-foreground">
            <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-primary">
              Belanja
            </span>
            <ShoppingBag className="size-5" aria-hidden="true" />
          </div>
          <p className="display-title mt-7 text-3xl">
            {shoppingResult.error ? "—" : shoppingResult.count}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            barang belum dibeli
          </p>
        </article>
      </section>

      <section aria-labelledby="money-summary-title">
        <Link
          href="/rumah/uang"
          className="block rounded-[18px] border border-primary/25 bg-card p-4 shadow-sm transition-colors hover:border-primary/60"
        >
          <div className="flex items-center justify-between gap-2">
            <span
              id="money-summary-title"
              className="text-xs font-extrabold uppercase tracking-[0.12em] text-primary"
            >
              Uang bersama
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Wallet className="size-5 text-primary" aria-hidden="true" />
              <ChevronRight className="size-4" aria-hidden="true" />
            </span>
          </div>
          <p className="display-title mt-3 text-3xl">{money.headline}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {money.caption}
          </p>
          <dl className="mt-4 border-t border-border pt-4">
            <div className="min-w-0">
              <dt className="text-[0.65rem] font-extrabold uppercase tracking-wide text-muted-foreground">
                Belum setor
              </dt>
              <dd className="mt-1 truncate text-sm font-bold">{money.dues.value}</dd>
              <dd className="truncate text-xs text-muted-foreground">
                {money.dues.hint}
              </dd>
            </div>
          </dl>
        </Link>
      </section>

      {noteResult.notes.length > 0 ? (
        <section aria-labelledby="note-highlights-title" className="space-y-3">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Pengingat</p>
              <h2 id="note-highlights-title" className="text-lg font-extrabold">
                Catatan rumah
              </h2>
            </div>
            <FileText className="size-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <ul className="space-y-3">
            {noteResult.notes.map((note) => (
              <li key={note.id}>
                <Link
                  href="/rumah/catatan"
                  className="block rounded-[18px] border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40"
                >
                  <p className="text-sm font-bold">{note.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {note.content}
                  </p>
                  <p className="mt-2 text-[0.7rem] text-muted-foreground">
                    Diperbarui{" "}
                    {note.editor?.display_name ?? note.creator?.display_name ?? "penghuni"} ·{" "}
                    {formatRelativeDayLabel(tokyoDateFromIso(note.updated_at), today)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {overdue.length > 0 ? (
        <section aria-labelledby="overdue-title">
          <div className="mb-3">
            <p className="eyebrow">Terlambat</p>
            <h2 id="overdue-title" className="text-lg font-extrabold">
              {overdue.length} tugas menunggu
            </h2>
          </div>
          <div className="overflow-hidden rounded-xl border border-warning/35 bg-card">
            {overdue.map((assignment) => (
              <AssignmentRow
                key={assignment.id}
                assignment={assignment}
                caption={`Terlambat ${daysLate(assignment.scheduled_for, today)} hari`}
                dateLabel={formatDateLabel(assignment.scheduled_for)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="home-highlights-title">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Hari ini</p>
            <h2 id="home-highlights-title" className="text-lg font-extrabold">
              Sorotan rumah
            </h2>
          </div>
          <CalendarDays className="size-5 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {highlights.length === 0 ? (
            <div className="flex min-h-20 items-center gap-3 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-success-soft text-success">
                <CheckCircle2 className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">Tidak ada tugas hari ini</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Jadwalkan tugas dari tab Tugas bila perlu.
                </p>
              </div>
            </div>
          ) : (
            highlights.map((assignment) => (
              <AssignmentRow key={assignment.id} assignment={assignment} />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
