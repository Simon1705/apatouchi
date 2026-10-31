import { ClipboardCheck } from "lucide-react";
import { connection } from "next/server";

import {
  HouseholdNotReadyNotice,
  LoadErrorNotice,
  SupabaseSetupNotice,
} from "@/components/layout/household-notices";
import { AssignmentForm } from "@/features/tasks/assignment-form";
import { AssignmentList } from "@/features/tasks/assignment-list";
import { ChoreForm } from "@/features/tasks/chore-form";
import { ChoreList } from "@/features/tasks/chore-list";
import { fetchAssignmentsInRange } from "@/features/tasks/queries";
import type { ChoreOption, MemberOption } from "@/features/tasks/types";
import { tokyoDateOffset } from "@/lib/dates";
import { getPublicEnvironment } from "@/lib/env";
import { getHouseholdContext } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";

function PageHeader() {
  return (
    <header>
      <p className="eyebrow">Rotasi bersama</p>
      <h1 className="display-title text-[2.65rem] leading-none">Tugas</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Kelola giliran kebersihan dengan pembagian yang transparan dan adil.
      </p>
    </header>
  );
}

export default async function TasksPage() {
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

  const from = tokyoDateOffset(-30);
  const to = tokyoDateOffset(90);

  const [membersResult, choresResult, assignmentResult] = await Promise.all([
    supabase.from("profiles").select("id, display_name").order("display_name"),
    supabase
      .from("chores")
      .select("id, title, area, frequency, description")
      .eq("household_id", context.householdId)
      .eq("is_active", true)
      .order("title"),
    fetchAssignmentsInRange(supabase, context.householdId, from, to),
  ]);

  const loadErrors: string[] = [];

  if (membersResult.error) {
    console.error("[tugas] profiles gagal", membersResult.error.message);
    loadErrors.push("Daftar penghuni tidak dapat dimuat.");
  }

  if (choresResult.error) {
    console.error("[tugas] chores gagal", choresResult.error.message);
    loadErrors.push("Daftar template tugas tidak dapat dimuat.");
  }

  if (assignmentResult.error) {
    loadErrors.push(assignmentResult.error);
  }

  const members = (membersResult.data ?? []) as MemberOption[];
  const chores = (choresResult.data ?? []) as ChoreOption[];
  const assignments = assignmentResult.assignments;
  const pendingCount = assignments.filter(
    (assignment) => assignment.status === "pending",
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader />

      <LoadErrorNotice messages={loadErrors} />

      <section
        className="rounded-[20px] bg-charcoal p-5 text-white shadow-sm"
        aria-labelledby="task-summary-title"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p
              id="task-summary-title"
              className="text-xs font-extrabold uppercase tracking-[0.12em] text-white/60"
            >
              Tugas aktif
            </p>
            <p className="display-title mt-1 text-4xl">{pendingCount}</p>
            <p className="mt-1 text-xs text-white/60">menunggu diselesaikan</p>
          </div>
          <ClipboardCheck className="size-8 text-white/60" aria-hidden="true" />
        </div>
      </section>

      <section aria-labelledby="assignment-list-title" className="space-y-3">
        <h2 id="assignment-list-title" className="text-lg font-extrabold">
          Jadwal tugas
        </h2>
        <AssignmentList
          assignments={assignments}
          currentUserId={context.userId}
          currentRole={context.role}
        />
      </section>

      <section aria-labelledby="assignment-form-title" className="space-y-3">
        <h2 id="assignment-form-title" className="text-lg font-extrabold">
          Jadwalkan tugas
        </h2>
        <div className="rounded-[20px] border border-border bg-card p-4 shadow-sm">
          <AssignmentForm chores={chores} members={members} />
        </div>
      </section>

      <section aria-labelledby="chore-manage-title" className="space-y-3">
        <h2 id="chore-manage-title" className="text-lg font-extrabold">
          Kelola tugas
        </h2>
        <div className="space-y-4 rounded-[20px] border border-border bg-card p-4 shadow-sm">
          <ChoreForm />
        </div>
        <ChoreList chores={chores} />
      </section>
    </div>
  );
}
