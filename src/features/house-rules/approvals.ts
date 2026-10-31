import type { RuleVoteChoice } from "@/features/house-rules/house-rule-schema";
import type {
  HouseMemberRecord,
  HouseRuleRecord,
} from "@/features/house-rules/types";

/** Ringkasan persetujuan sebuah aturan, dihitung dari roster penghuni aktif. */
export type ApprovalSummary = {
  /** Jumlah penghuni rumah yang sudah menyetujui. */
  approvedCount: number;
  /** Jumlah penghuni rumah saat ini (batas kuorum). */
  memberCount: number;
  /** Penghuni yang memberi suara "tidak setuju". */
  rejectedCount: number;
  /** Nama penghuni yang belum memberi suara. */
  waitingNames: string[];
  /** Suara pengguna saat ini; `null` bila belum memilih. */
  myVote: RuleVoteChoice | null;
  /** Aturan siap disahkan: semua penghuni sudah memberi suara dan tidak ada penolakan. */
  isReady: boolean;
};

/**
 * Menghitung progres persetujuan sebuah aturan terhadap daftar penghuni rumah.
 *
 * Suara dari pengguna yang sudah keluar dari rumah diabaikan, sehingga kuorum
 * selalu dibandingkan dengan roster terbaru — bukan jumlah baris `rule_approvals`.
 *
 * @param rule Aturan beserta suara yang sudah masuk.
 * @param members Roster penghuni rumah aktif.
 * @param currentUserId Pengguna yang sedang login.
 * @returns Ringkasan untuk ditampilkan pada kartu aturan.
 */
export function summarizeApprovals(
  rule: HouseRuleRecord,
  members: HouseMemberRecord[],
  currentUserId: string,
): ApprovalSummary {
  const approvedIds = new Set(
    rule.approvals.filter((vote) => vote.approved).map((vote) => vote.user_id),
  );
  const votedIds = new Set(rule.approvals.map((vote) => vote.user_id));

  const waiting = members.filter((member) => !votedIds.has(member.id));
  const rejectedCount = members.filter(
    (member) => votedIds.has(member.id) && !approvedIds.has(member.id),
  ).length;

  const myApproval = rule.approvals.find((vote) => vote.user_id === currentUserId);

  return {
    approvedCount: members.filter((member) => approvedIds.has(member.id)).length,
    memberCount: members.length,
    rejectedCount,
    waitingNames: waiting.map((member) => member.display_name),
    myVote: myApproval ? (myApproval.approved ? "yes" : "no") : null,
    isReady:
      members.length > 0 && waiting.length === 0 && rejectedCount === 0,
  };
}
