"use server";

import { revalidatePath } from "next/cache";

import { summarizeApprovals } from "@/features/house-rules/approvals";
import {
  houseRuleSchema,
  ruleIdSchema,
  ruleVoteSchema,
  type RuleStatus,
} from "@/features/house-rules/house-rule-schema";
import {
  fetchHouseholdMembers,
  fetchHouseRule,
} from "@/features/house-rules/queries";
import type { HouseRuleRecord } from "@/features/house-rules/types";
import { getHouseholdContext, type HouseholdContext } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";

import type { SupabaseClient } from "@supabase/supabase-js";

/** State yang dikembalikan seluruh Server Action fitur Aturan Rumah. */
export type HouseRuleActionState = {
  error?: string;
  ok?: boolean;
};

const SESSION_ERROR =
  "Sesi rumah tidak tersedia. Muat ulang halaman lalu coba lagi.";
const GENERIC_ERROR = "Tidak dapat menyimpan perubahan. Coba beberapa saat lagi.";
const RULE_ERROR = "Aturan tidak ditemukan atau sudah diubah. Muat ulang halaman.";
const MANAGE_ERROR = "Hanya pengusul aturan atau pemilik rumah yang dapat mengubah ini.";

/** Status yang masih membuka proses persetujuan. */
const OPEN_STATUSES: RuleStatus[] = ["draft", "pending_approval"];

type HouseRuleSession = {
  context: HouseholdContext;
  supabase: SupabaseClient;
};

/**
 * Menyiapkan konteks rumah + client Supabase untuk sebuah aksi.
 * `household_id` dan `created_by` selalu diambil dari sesi (bukan dari client)
 * agar mutasi lolos kebijakan RLS.
 */
async function requireSession(): Promise<HouseRuleSession | null> {
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

/**
 * Hak kelola mengikuti kebijakan `house_rules_update_creator_owner`:
 * hanya pengusul atau pemilik rumah. Diperiksa di sisi aplikasi supaya pengguna
 * mendapat penjelasan, bukan kegagalan senyap.
 */
function canManage(rule: HouseRuleRecord, context: HouseholdContext) {
  return rule.created_by === context.userId || context.role === "owner";
}

/**
 * Membaca ulang aturan dalam konteks rumah aktif.
 *
 * @returns `null` bila sesi tidak tersedia, aturan hilang, atau query gagal.
 */
async function loadRule(
  session: HouseRuleSession,
  ruleId: string,
): Promise<HouseRuleRecord | null> {
  return fetchHouseRule(session.supabase, session.context.householdId, ruleId);
}

/** Memvalidasi identifier aturan dari form. */
function parseRuleId(formData: FormData): string | null {
  const ruleId = String(formData.get("ruleId") ?? "");

  return ruleIdSchema.safeParse(ruleId).success ? ruleId : null;
}

/**
 * Mengusulkan aturan baru. Pengusul otomatis langsung tercatat menyetujui
 * usulannya sendiri, jadi kuorum berjalan sejak suara penghuni berikutnya masuk.
 */
export async function createHouseRule(
  formData: FormData,
): Promise<HouseRuleActionState> {
  const session = await requireSession();

  if (!session) {
    return { error: SESSION_ERROR };
  }

  const result = houseRuleSchema.safeParse({
    title: formData.get("title"),
    content: formData.get("content"),
  });

  if (!result.success) {
    return {
      error: firstIssueMessage(result.error, "Periksa kembali isian aturan."),
    };
  }

  const { context, supabase } = session;

  const { data: created, error: insertError } = await supabase
    .from("house_rules")
    .insert({
      household_id: context.householdId,
      created_by: context.userId,
      title: result.data.title,
      content: result.data.content,
      status: "pending_approval",
    })
    .select("id")
    .single();

  if (insertError || !created) {
    return { error: GENERIC_ERROR };
  }

  const { error: approvalError } = await supabase
    .from("rule_approvals")
    .insert({
      household_id: context.householdId,
      rule_id: created.id,
      user_id: context.userId,
      approved: true,
    });

  if (approvalError) {
    // Kompensasi: jangan tinggalkan aturan tanpa suara pengusul yang bisa membuat
    // kuorum terlihat mustahil.
    await supabase.from("house_rules").delete().eq("id", created.id);
    return { error: GENERIC_ERROR };
  }

  revalidatePath("/rumah/aturan");
  revalidatePath("/rumah");
  return { ok: true };
}

/** Mencatat atau mengubah suara penghuni pada aturan yang masih dibuka. */
export async function voteHouseRule(
  formData: FormData,
): Promise<HouseRuleActionState> {
  const session = await requireSession();

  if (!session) {
    return { error: SESSION_ERROR };
  }

  const ruleId = parseRuleId(formData);
  const voteResult = ruleVoteSchema.safeParse(formData.get("vote"));

  if (!ruleId || !voteResult.success) {
    return { error: RULE_ERROR };
  }

  const rule = await loadRule(session, ruleId);

  if (!rule) {
    return { error: RULE_ERROR };
  }

  if (!OPEN_STATUSES.includes(rule.status)) {
    return {
      error:
        rule.status === "active"
          ? "Aturan ini sudah berlaku, jadi suara tidak diperlukan lagi."
          : "Aturan sudah diarsipkan, jadi suara tidak dapat diubah.",
    };
  }

  const { context, supabase } = session;
  const { data, error } = await supabase
    .from("rule_approvals")
    .upsert(
      {
        household_id: context.householdId,
        rule_id: ruleId,
        user_id: context.userId,
        approved: voteResult.data === "yes",
      },
      { onConflict: "rule_id,user_id" },
    )
    .select("id");

  if (error) {
    return { error: GENERIC_ERROR };
  }

  if (!assertRowTouched(data)) {
    return { error: RULE_ERROR };
  }

  revalidatePath("/rumah/aturan");
  revalidatePath("/rumah");
  return { ok: true };
}

/** Mencabut suara sendiri (mis. berubah pikiran atau salah pilih). */
export async function retractHouseRuleVote(
  formData: FormData,
): Promise<HouseRuleActionState> {
  const session = await requireSession();

  if (!session) {
    return { error: SESSION_ERROR };
  }

  const ruleId = parseRuleId(formData);

  if (!ruleId) {
    return { error: RULE_ERROR };
  }

  const { context, supabase } = session;
  const { data, error } = await supabase
    .from("rule_approvals")
    .delete()
    .eq("rule_id", ruleId)
    .eq("user_id", context.userId)
    .select("id");

  if (error) {
    return { error: GENERIC_ERROR };
  }

  if (!assertRowTouched(data)) {
    return { error: "Suara Anda belum tercatat, jadi tidak ada yang perlu dicabut." };
  }

  revalidatePath("/rumah/aturan");
  revalidatePath("/rumah");
  return { ok: true };
}

/**
 * Menaikkan status aturan menjadi `active`.
 *
 * Kuorum dihitung ulang dari data terbaru memakai logika yang sama dengan daftar,
 * sehingga status hanya berubah bila seluruh penghuni benar-benar sudah menyetujui.
 */
export async function activateHouseRule(
  formData: FormData,
): Promise<HouseRuleActionState> {
  const session = await requireSession();

  if (!session) {
    return { error: SESSION_ERROR };
  }

  const ruleId = parseRuleId(formData);

  if (!ruleId) {
    return { error: RULE_ERROR };
  }

  const rule = await loadRule(session, ruleId);

  if (!rule) {
    return { error: RULE_ERROR };
  }

  if (!OPEN_STATUSES.includes(rule.status)) {
    return rule.status === "active"
      ? { ok: true }
      : { error: "Aturan sudah diarsipkan." };
  }

  if (!canManage(rule, session.context)) {
    return {
      error: `Aturan sudah disetujui seluruh penghuni. ${rule.creator?.display_name ?? "Pengusul"} atau pemilik rumah yang dapat mengesahkan.`,
    };
  }

  const { members } = await fetchHouseholdMembers(session.supabase);
  const summary = summarizeApprovals(rule, members, session.context.userId);

  if (summary.rejectedCount > 0) {
    return {
      error: `${summary.rejectedCount} penghuni menolak aturan ini. Bahas kembali sebelum mengesahkan.`,
    };
  }

  if (!summary.isReady) {
    return {
      error: `Baru ${summary.approvedCount} dari ${summary.memberCount} penghuni yang menyetujui.`,
    };
  }

  const { supabase } = session;
  const { data, error } = await supabase
    .from("house_rules")
    .update({ status: "active" })
    .eq("id", ruleId)
    .in("status", OPEN_STATUSES)
    .select("id");

  if (error) {
    return { error: GENERIC_ERROR };
  }

  // Tidak ada baris terdampak berarti aturan sudah diubah orang lain sejak dibaca.
  if (!assertRowTouched(data)) {
    return { error: RULE_ERROR };
  }

  revalidatePath("/rumah/aturan");
  revalidatePath("/rumah");
  return { ok: true };
}

/** Mengarsipkan aturan yang tidak lagi berlaku. */
export async function archiveHouseRule(
  formData: FormData,
): Promise<HouseRuleActionState> {
  const session = await requireSession();

  if (!session) {
    return { error: SESSION_ERROR };
  }

  const ruleId = parseRuleId(formData);

  if (!ruleId) {
    return { error: RULE_ERROR };
  }

  const rule = await loadRule(session, ruleId);

  if (!rule) {
    return { error: RULE_ERROR };
  }

  if (rule.status === "archived") {
    return { ok: true };
  }

  if (!canManage(rule, session.context)) {
    return { error: MANAGE_ERROR };
  }

  const { supabase } = session;
  const { data, error } = await supabase
    .from("house_rules")
    .update({ status: "archived" })
    .eq("id", ruleId)
    .neq("status", "archived")
    .select("id");

  if (error) {
    return { error: GENERIC_ERROR };
  }

  if (!assertRowTouched(data)) {
    return { error: RULE_ERROR };
  }

  revalidatePath("/rumah/aturan");
  revalidatePath("/rumah");
  return { ok: true };
}

/** Menghapus aturan beserta seluruh suaranya (cascade pada `rule_approvals`). */
export async function deleteHouseRule(
  formData: FormData,
): Promise<HouseRuleActionState> {
  const session = await requireSession();

  if (!session) {
    return { error: SESSION_ERROR };
  }

  const ruleId = parseRuleId(formData);

  if (!ruleId) {
    return { error: RULE_ERROR };
  }

  const rule = await loadRule(session, ruleId);

  if (!rule) {
    return { error: RULE_ERROR };
  }

  if (!canManage(rule, session.context)) {
    return { error: MANAGE_ERROR };
  }

  const { supabase } = session;
  const { data, error } = await supabase
    .from("house_rules")
    .delete()
    .eq("id", ruleId)
    .select("id");

  if (error) {
    return { error: GENERIC_ERROR };
  }

  if (!assertRowTouched(data)) {
    return { error: RULE_ERROR };
  }

  revalidatePath("/rumah/aturan");
  revalidatePath("/rumah");
  return { ok: true };
}
