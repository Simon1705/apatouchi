"use server";

import { revalidatePath } from "next/cache";

import { wasteIdSchema, wasteScheduleSchema } from "@/features/waste/waste-schema";
import { getHouseholdContext, type HouseholdContext } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";

import type { SupabaseClient } from "@supabase/supabase-js";

/** State yang dikembalikan seluruh Server Action fitur Jadwal Sampah. */
export type WasteActionState = {
  error?: string;
  ok?: boolean;
};

const SESSION_ERROR =
  "Sesi rumah tidak tersedia. Muat ulang halaman lalu coba lagi.";
const GENERIC_ERROR = "Tidak dapat menyimpan perubahan. Coba beberapa saat lagi.";
const OWNER_ONLY_ERROR =
  "Hanya pemilik rumah yang dapat menambah atau menghapus jadwal sampah.";
const SCHEDULE_ERROR = "Jadwal tidak ditemukan atau sudah diubah. Muat ulang halaman.";

type WasteSession = {
  context: HouseholdContext;
  supabase: SupabaseClient;
};

/**
 * Menyiapkan konteks rumah + client Supabase untuk sebuah aksi.
 * Cek peran owner dilakukan pemanggil: kebijakan `waste_schedules_*_owner`
 * hanya mengizinkan pemilik rumah menulis, jadi penolakan dijelaskan lebih awal
 * daripada gagal senyap saat query.
 */
async function requireOwnerSession(): Promise<WasteSession | null> {
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
function firstIssueMessage(
  error: { issues: { message: string }[] },
  fallback: string,
) {
  return error.issues[0]?.message ?? fallback;
}

/**
 * RLS membuat DELETE yang tidak diizinkan menjadi no-op tanpa error,
 * sehingga baris terdampak harus diperiksa sendiri.
 */
function assertRowTouched(rows: { id: string }[] | null) {
  return Array.isArray(rows) && rows.length > 0;
}

/** Memvalidasi identifier jadwal dari form. */
function parseScheduleId(formData: FormData): string | null {
  const scheduleId = String(formData.get("scheduleId") ?? "");

  return wasteIdSchema.safeParse(scheduleId).success ? scheduleId : null;
}

/**
 * Menambahkan pola jadwal pengambilan mingguan.
 * Kombinasi (rumah, jenis sampah, hari) unik di database; duplikat dilaporkan
 * dengan pesan yang menjelaskan isian mana yang perlu diubah.
 */
export async function createWasteSchedule(
  formData: FormData,
): Promise<WasteActionState> {
  const session = await requireOwnerSession();

  if (!session) {
    return { error: SESSION_ERROR };
  }

  if (session.context.role !== "owner") {
    return { error: OWNER_ONLY_ERROR };
  }

  const result = wasteScheduleSchema.safeParse({
    wasteType: formData.get("wasteType"),
    weekday: formData.get("weekday"),
    collectionTime: formData.get("collectionTime"),
    notes: formData.get("notes"),
  });

  if (!result.success) {
    return {
      error: firstIssueMessage(result.error, "Periksa kembali isian jadwal."),
    };
  }

  const { context, supabase } = session;
  const values = result.data;

  const { error } = await supabase.from("waste_schedules").insert({
    household_id: context.householdId,
    created_by: context.userId,
    waste_type: values.wasteType,
    weekday: Number(values.weekday),
    collection_time: values.collectionTime === "" ? null : values.collectionTime,
    notes: values.notes === "" ? null : values.notes,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        error: `Jadwal "${values.wasteType}" pada hari itu sudah ada. Hapus jadwal lama lebih dulu bila ingin menggantinya.`,
      };
    }

    return { error: GENERIC_ERROR };
  }

  revalidatePath("/rumah/sampah");
  revalidatePath("/rumah");
  revalidatePath("/hari-ini");
  return { ok: true };
}

/** Menghapus satu pola jadwal beserta tanggal turunannya. */
export async function deleteWasteSchedule(
  formData: FormData,
): Promise<WasteActionState> {
  const session = await requireOwnerSession();

  if (!session) {
    return { error: SESSION_ERROR };
  }

  if (session.context.role !== "owner") {
    return { error: OWNER_ONLY_ERROR };
  }

  const scheduleId = parseScheduleId(formData);

  if (!scheduleId) {
    return { error: SCHEDULE_ERROR };
  }

  const { supabase } = session;
  const { data, error } = await supabase
    .from("waste_schedules")
    .delete()
    .eq("id", scheduleId)
    .select("id");

  if (error) {
    return { error: GENERIC_ERROR };
  }

  if (!assertRowTouched(data)) {
    return { error: SCHEDULE_ERROR };
  }

  revalidatePath("/rumah/sampah");
  revalidatePath("/rumah");
  revalidatePath("/hari-ini");
  return { ok: true };
}
