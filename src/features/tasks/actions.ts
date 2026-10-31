"use server";

import { revalidatePath } from "next/cache";

import { getHouseholdContext, type HouseholdContext } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";
import {
  assignmentSchema,
  choreSchema,
  idSchema,
} from "@/features/tasks/task-schema";

import type { SupabaseClient } from "@supabase/supabase-js";

/** State yang dikembalikan seluruh Server Action fitur Tugas. */
export type TaskActionState = {
  error?: string;
  ok?: boolean;
};

const SESSION_ERROR = "Sesi rumah tidak tersedia. Muat ulang halaman lalu coba lagi.";
const GENERIC_ERROR = "Tidak dapat menyimpan perubahan. Coba beberapa saat lagi.";

type TaskSession = {
  context: HouseholdContext;
  supabase: SupabaseClient;
};

/**
 * Menyiapkan konteks rumah + client Supabase untuk sebuah aksi.
 * `household_id` dan `created_by` selalu diambil dari sesi (bukan dari client)
 * agar mutasi lolos kebijakan RLS.
 */
async function requireSession(): Promise<TaskSession | null> {
  const context = await getHouseholdContext();

  if (!context) {
    return null;
  }

  const supabase = await createClient();

  if (!supabase) {
    return null;
  }

  return { context, supabase };
}

/** Mengambil pesan validasi pertama agar actionable dan dekat dengan field. */
function firstIssueMessage(error: { issues: { message: string }[] }, fallback: string) {
  return error.issues[0]?.message ?? fallback;
}

/** Membuat template tugas (chore) baru untuk rumah tangga aktif. */
export async function createChore(formData: FormData): Promise<TaskActionState> {
  const session = await requireSession();

  if (!session) {
    return { error: SESSION_ERROR };
  }

  const result = choreSchema.safeParse({
    title: formData.get("title"),
    area: formData.get("area"),
    frequency: formData.get("frequency"),
    description: formData.get("description"),
  });

  if (!result.success) {
    return { error: firstIssueMessage(result.error, "Periksa kembali isian tugas.") };
  }

  const { context, supabase } = session;
  const values = result.data;
  const area = values.area?.trim();
  const description = values.description?.trim();

  const { error } = await supabase.from("chores").insert({
    household_id: context.householdId,
    created_by: context.userId,
    title: values.title,
    area: area ? area : null,
    frequency: values.frequency,
    description: description ? description : null,
  });

  if (error) {
    return { error: GENERIC_ERROR };
  }

  revalidatePath("/tugas");
  return { ok: true };
}

/** Menonaktifkan template tugas agar tidak muncul lagi pada pilihan penugasan. */
export async function deactivateChore(formData: FormData): Promise<TaskActionState> {
  const session = await requireSession();

  if (!session) {
    return { error: SESSION_ERROR };
  }

  const choreId = String(formData.get("choreId") ?? "");

  if (!idSchema.safeParse(choreId).success) {
    return { error: "Tugas tidak valid." };
  }

  const { supabase } = session;
  const { error } = await supabase
    .from("chores")
    .update({ is_active: false })
    .eq("id", choreId);

  if (error) {
    return { error: GENERIC_ERROR };
  }

  revalidatePath("/tugas");
  return { ok: true };
}

/**
 * Menghapus template tugas. Penugasan terkait ikut terhapus melalui
 * `on delete cascade` pada foreign key chore_assignments.
 */
export async function deleteChore(formData: FormData): Promise<TaskActionState> {
  const session = await requireSession();

  if (!session) {
    return { error: SESSION_ERROR };
  }

  const choreId = String(formData.get("choreId") ?? "");

  if (!idSchema.safeParse(choreId).success) {
    return { error: "Tugas tidak valid." };
  }

  const { supabase } = session;
  const { error } = await supabase.from("chores").delete().eq("id", choreId);

  if (error) {
    return { error: GENERIC_ERROR };
  }

  revalidatePath("/tugas");
  // Penugasan chore ini ikut terhapus oleh cascade.
  revalidatePath("/hari-ini");
  return { ok: true };
}

/** Menjadwalkan sebuah chore ke anggota tertentu pada tanggal tertentu. */
export async function createAssignment(formData: FormData): Promise<TaskActionState> {
  const session = await requireSession();

  if (!session) {
    return { error: SESSION_ERROR };
  }

  const result = assignmentSchema.safeParse({
    choreId: formData.get("choreId"),
    assigneeId: formData.get("assigneeId"),
    scheduledFor: formData.get("scheduledFor"),
  });

  if (!result.success) {
    return { error: firstIssueMessage(result.error, "Periksa kembali penugasan.") };
  }

  const { context, supabase } = session;
  const values = result.data;

  const { error } = await supabase.from("chore_assignments").insert({
    household_id: context.householdId,
    chore_id: values.choreId,
    assignee_id: values.assigneeId,
    scheduled_for: values.scheduledFor,
    created_by: context.userId,
    status: "pending",
  });

  if (error) {
    // 23505 = unique_violation pada constraint chore_assignments_chore_date_key.
    if (error.code === "23505") {
      return { error: "Tugas ini sudah dijadwalkan pada tanggal tersebut." };
    }
    return { error: GENERIC_ERROR };
  }

  revalidatePath("/tugas");
  // Dashboard Hari Ini membaca penugasan yang sama.
  revalidatePath("/hari-ini");
  return { ok: true };
}

/**
 * Menandai penugasan selesai. `completed_at` dan `completed_by` wajib diisi
 * bersamaan dengan status untuk memenuhi `chore_assignments_completion_check`.
 */
export async function completeAssignment(formData: FormData): Promise<TaskActionState> {
  const session = await requireSession();

  if (!session) {
    return { error: SESSION_ERROR };
  }

  const assignmentId = String(formData.get("assignmentId") ?? "");

  if (!idSchema.safeParse(assignmentId).success) {
    return { error: "Penugasan tidak valid." };
  }

  const { context, supabase } = session;
  const { error } = await supabase
    .from("chore_assignments")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      completed_by: context.userId,
    })
    .eq("id", assignmentId);

  if (error) {
    return { error: GENERIC_ERROR };
  }

  revalidatePath("/tugas");
  revalidatePath("/hari-ini");
  return { ok: true };
}

/** Membuka kembali penugasan yang sudah selesai menjadi pending. */
export async function reopenAssignment(formData: FormData): Promise<TaskActionState> {
  const session = await requireSession();

  if (!session) {
    return { error: SESSION_ERROR };
  }

  const assignmentId = String(formData.get("assignmentId") ?? "");

  if (!idSchema.safeParse(assignmentId).success) {
    return { error: "Penugasan tidak valid." };
  }

  const { supabase } = session;
  const { error } = await supabase
    .from("chore_assignments")
    .update({ status: "pending", completed_at: null, completed_by: null })
    .eq("id", assignmentId);

  if (error) {
    return { error: GENERIC_ERROR };
  }

  revalidatePath("/tugas");
  revalidatePath("/hari-ini");
  return { ok: true };
}
