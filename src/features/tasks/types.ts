import type { AssignmentStatus, ChoreFrequency } from "@/features/tasks/task-schema";

/** Profil anggota rumah untuk pilihan assignee. */
export type MemberOption = {
  id: string;
  display_name: string;
};

/** Template tugas aktif untuk pilihan pada form penugasan dan daftar kelola. */
export type ChoreOption = {
  id: string;
  title: string;
  area: string | null;
  frequency: ChoreFrequency;
  description: string | null;
};

/** Baris penugasan beserta relasi chore dan assignee yang di-embed. */
export type AssignmentRecord = {
  id: string;
  chore_id: string;
  assignee_id: string;
  created_by: string;
  scheduled_for: string;
  status: AssignmentStatus;
  due_at: string | null;
  chore: {
    title: string;
    area: string | null;
    frequency: ChoreFrequency;
  } | null;
  assignee: {
    display_name: string;
  } | null;
};
