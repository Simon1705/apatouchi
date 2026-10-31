import type { RuleStatus } from "@/features/house-rules/house-rule-schema";

/** Suara satu penghuni pada sebuah aturan, dengan nama yang di-embed. */
export type RuleApprovalRecord = {
  user_id: string;
  approved: boolean;
  voter: { display_name: string } | null;
};

/** Aturan rumah beserta suara penghuni yang sudah masuk. */
export type HouseRuleRecord = {
  id: string;
  title: string;
  content: string;
  status: RuleStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  creator: { display_name: string } | null;
  approvals: RuleApprovalRecord[];
};

/** Penghuni satu rumah tangga, dipakai untuk roster dan menghitung kuorum. */
export type HouseMemberRecord = {
  id: string;
  display_name: string;
};
