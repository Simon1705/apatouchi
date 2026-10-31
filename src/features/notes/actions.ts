"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  houseNoteSchema,
  noteIdSchema,
  noteStatuses,
  type NoteStatus,
} from "@/features/notes/note-schema";
import { fetchHouseNote } from "@/features/notes/queries";
import type { HouseNoteRecord } from "@/features/notes/types";
import { getHouseholdContext, type HouseholdContext } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";

/** State yang dikembalikan seluruh Server Action fitur Catatan Rumah. */
export type NoteActionResult = {
  error: string | null;
  /** Pesan sukses yang ditampilkan dekat aksi; dipakai saat hasilnya ambigu. */
  message?: string;
};

/** Bagian catatan yang boleh ditulis lewat aksi. */
type NotePatch = {
  title?: string;
  content?: string;
  is_pinned?: boolean;
  status?: NoteStatus;
};

const SESSION_ERROR =
  "Sesi rumah tidak tersedia. Muat ulang halaman lalu coba lagi.";
const NOT_FOUND = "Catatan tidak ditemukan atau sudah dihapus. Muat ulang halaman.";
const EDIT_FORBIDDEN =
  "Catatan ini hanya dapat diubah oleh pembuatnya, pengubah terakhir, atau pemilik rumah.";
const DELETE_FORBIDDEN =
  "Catatan ini hanya dapat dihapus oleh pembuatnya atau pemilik rumah.";
const WRITE_ERROR = "Catatan gagal disimpan. Coba beberapa saat lagi.";
const DELETE_ERROR = "Catatan gagal dihapus. Coba beberapa saat lagi.";

/** Status yang boleh ditulis lewat aksi arsip/pulihkan. */
const noteStatusSchema = z.enum(noteStatuses);

type NoteSession = {
  context: HouseholdContext;
  supabase: SupabaseClient;
};

/**
 * Menyiapkan konteks rumah + client Supabase untuk sebuah aksi.
 * `household_id`, `created_by`, dan `updated_by` selalu diambil dari sesi
 * (bukan dari client) agar mutasi lolos kebijakan RLS.
 */
async function requireSession(): Promise<NoteSession | null> {
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
 * RLS membuat UPDATE/DELETE yang tidak diizinkan menjadi no-op tanpa error,
 * sehingga jumlah baris terdampak harus diperiksa sendiri.
 */
function assertRowTouched(rows: { id: string }[] | null) {
  return Array.isArray(rows) && rows.length > 0;
}

/** Catatan boleh diubah oleh pembuat, pengubah terakhir, atau pemilik rumah. */
function canEdit(note: HouseNoteRecord, context: HouseholdContext) {
  return (
    note.created_by === context.userId ||
    note.updated_by === context.userId ||
    context.role === "owner"
  );
}

/** Hanya pembuat catatan atau pemilik rumah yang boleh menghapus. */
function canDelete(note: HouseNoteRecord, context: HouseholdContext) {
  return note.created_by === context.userId || context.role === "owner";
}

/** Memvalidasi identifier catatan dari form. */
function parseNoteId(formData: FormData): string | null {
  const noteId = String(formData.get("noteId") ?? "");

  return noteIdSchema.safeParse(noteId).success ? noteId : null;
}

/** Membaca catatan dalam rumah aktif; `null` bila hilang atau query gagal. */
function loadNote(session: NoteSession, noteId: string) {
  return fetchHouseNote(session.supabase, session.context.householdId, noteId);
}

/**
 * Memverifikasi hak lalu menerapkan patch pada satu catatan.
 *
 * `updated_by` selalu ikut ditulis supaya label "Diperbarui oleh" akurat dan
 * policy `house_notes_update_author_editor_owner` tetap lolos.
 */
async function patchNote(
  session: NoteSession,
  noteId: string,
  patch: NotePatch,
): Promise<NoteActionResult> {
  const note = await loadNote(session, noteId);

  if (!note) {
    return { error: NOT_FOUND };
  }

  if (!canEdit(note, session.context)) {
    return { error: EDIT_FORBIDDEN };
  }

  const { data, error } = await session.supabase
    .from("house_notes")
    .update({ ...patch, updated_by: session.context.userId })
    .eq("household_id", session.context.householdId)
    .eq("id", noteId)
    .select("id");

  if (error) {
    console.error("[notes] patchNote gagal", error);
    return { error: WRITE_ERROR };
  }

  if (!assertRowTouched(data)) {
    return { error: EDIT_FORBIDDEN };
  }

  revalidatePaths();

  return { error: null };
}

/**
 * Catatan muncul di tiga layar (daftar, hub Rumah, kartu Hari Ini), jadi
 * semuanya di-invalidate bersamaan agar tidak ada yang menampilkan data lama.
 */
function revalidatePaths() {
  revalidatePath("/rumah/catatan");
  revalidatePath("/rumah");
  revalidatePath("/hari-ini");
}

/**
 * Membuat catatan rumah baru.
 *
 * Policy `house_notes_insert_creator` mewajibkan `created_by` dan `updated_by`
 * sama dengan pengguna saat ini.
 *
 * @param formData Field `title` dan `content`.
 */
export async function createHouseNote(
  formData: FormData,
): Promise<NoteActionResult> {
  const session = await requireSession();

  if (!session) {
    return { error: SESSION_ERROR };
  }

  const parsed = houseNoteSchema.safeParse({
    title: formData.get("title"),
    content: formData.get("content"),
  });

  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error, "Input tidak valid.") };
  }

  const { error } = await session.supabase.from("house_notes").insert({
    household_id: session.context.householdId,
    created_by: session.context.userId,
    updated_by: session.context.userId,
    title: parsed.data.title,
    content: parsed.data.content,
  });

  if (error) {
    console.error("[notes] createHouseNote gagal", error);
    return { error: "Catatan gagal dibuat. Coba beberapa saat lagi." };
  }

  revalidatePaths();

  return { error: null, message: "Catatan tersimpan." };
}

/**
 * Mengubah judul dan isi catatan; pembuat, pengubah terakhir, atau owner saja.
 *
 * @param formData Field `noteId`, `title`, dan `content`.
 */
export async function updateHouseNote(
  formData: FormData,
): Promise<NoteActionResult> {
  const session = await requireSession();

  if (!session) {
    return { error: SESSION_ERROR };
  }

  const noteId = parseNoteId(formData);

  if (!noteId) {
    return { error: NOT_FOUND };
  }

  const parsed = houseNoteSchema.safeParse({
    title: formData.get("title"),
    content: formData.get("content"),
  });

  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error, "Input tidak valid.") };
  }

  return patchNote(session, noteId, parsed.data);
}

/**
 * Membalik status sematan catatan.
 *
 * Nilai saat ini dibaca ulang dulu (sekaligus memverifikasi hak), jadi dua klik
 * berurutan selalu menghasilkan semat / lepas semat yang benar.
 *
 * @param formData Field `noteId`.
 */
export async function toggleHouseNotePin(
  formData: FormData,
): Promise<NoteActionResult> {
  const session = await requireSession();

  if (!session) {
    return { error: SESSION_ERROR };
  }

  const noteId = parseNoteId(formData);

  if (!noteId) {
    return { error: NOT_FOUND };
  }

  const note = await loadNote(session, noteId);

  if (!note) {
    return { error: NOT_FOUND };
  }

  const result = await patchNote(session, note.id, { is_pinned: !note.is_pinned });

  return {
    ...result,
    message: result.error
      ? undefined
      : note.is_pinned
        ? "Sematan dilepas."
        : "Catatan disematkan.",
  };
}

/**
 * Memindahkan catatan ke atau dari arsip.
 *
 * @param formData Field `noteId` dan `status` ("active" | "archived").
 */
export async function setHouseNoteStatus(
  formData: FormData,
): Promise<NoteActionResult> {
  const session = await requireSession();

  if (!session) {
    return { error: SESSION_ERROR };
  }

  const noteId = parseNoteId(formData);
  const status = noteStatusSchema.safeParse(formData.get("status"));

  if (!noteId || !status.success) {
    return { error: NOT_FOUND };
  }

  const result = await patchNote(session, noteId, { status: status.data });

  return {
    ...result,
    message: result.error
      ? undefined
      : status.data === "archived"
        ? "Catatan diarsipkan."
        : "Catatan aktif lagi.",
  };
}

/**
 * Menghapus catatan permanen; pembuat atau pemilik rumah saja.
 *
 * @param formData Field `noteId`.
 */
export async function deleteHouseNote(
  formData: FormData,
): Promise<NoteActionResult> {
  const session = await requireSession();

  if (!session) {
    return { error: SESSION_ERROR };
  }

  const noteId = parseNoteId(formData);

  if (!noteId) {
    return { error: NOT_FOUND };
  }

  const note = await loadNote(session, noteId);

  if (!note) {
    return { error: NOT_FOUND };
  }

  if (!canDelete(note, session.context)) {
    return { error: DELETE_FORBIDDEN };
  }

  const { data, error } = await session.supabase
    .from("house_notes")
    .delete()
    .eq("household_id", session.context.householdId)
    .eq("id", noteId)
    .select("id");

  if (error) {
    console.error("[notes] deleteHouseNote gagal", error);
    return { error: DELETE_ERROR };
  }

  if (!assertRowTouched(data)) {
    return { error: DELETE_FORBIDDEN };
  }

  revalidatePaths();

  return { error: null, message: "Catatan dihapus." };
}
