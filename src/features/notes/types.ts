import type { NoteStatus } from "@/features/notes/note-schema";

/**
 * Catatan rumah beserta nama pembuat dan pengubah terakhir.
 * Kedua nama di-embed lewat hint nama FK karena `house_notes` punya dua FK ke
 * `profiles` (`created_by` dan `updated_by`).
 */
export type HouseNoteRecord = {
  id: string;
  title: string;
  content: string;
  status: NoteStatus;
  is_pinned: boolean;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  creator: { display_name: string } | null;
  editor: { display_name: string } | null;
};
