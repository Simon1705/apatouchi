import { FileText } from "lucide-react";
import { connection } from "next/server";

import {
  HouseholdNotReadyNotice,
  LoadErrorNotice,
  SupabaseSetupNotice,
} from "@/components/layout/household-notices";
import { SubpageHeader } from "@/components/layout/subpage-header";
import { NoteForm } from "@/features/notes/note-form";
import { NoteList } from "@/features/notes/note-list";
import { fetchHouseNotes } from "@/features/notes/queries";
import { todayInTokyo } from "@/lib/dates";
import { getPublicEnvironment } from "@/lib/env";
import { getHouseholdContext } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";

const header = {
  title: "Catatan rumah",
  description:
    "Pengingat operasional yang perlu diketahui bersama: jadwal petugas gedung, iuran, dan hal teknis.",
};

export default async function HouseNotesPage() {
  await connection();

  const environment = getPublicEnvironment();

  if (!environment.isSupabaseConfigured) {
    return (
      <div className="space-y-6">
        <SubpageHeader {...header} />
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
        <SubpageHeader {...header} />
        <HouseholdNotReadyNotice />
      </div>
    );
  }

  const notesResult = await fetchHouseNotes(supabase, context.householdId);
  const notes = notesResult.notes;
  const activeNotes = notes.filter((note) => note.status === "active");
  const pinnedCount = activeNotes.filter((note) => note.is_pinned).length;

  return (
    <div className="space-y-6">
      <SubpageHeader {...header} />

      <LoadErrorNotice
        messages={[notesResult.error].filter(
          (message): message is string => Boolean(message),
        )}
      />

      <section
        className="rounded-[20px] bg-charcoal p-5 text-white shadow-sm"
        aria-labelledby="note-summary-title"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p
              id="note-summary-title"
              className="text-xs font-extrabold uppercase tracking-[0.12em] text-white/60"
            >
              Catatan aktif
            </p>
            <p className="display-title mt-1 text-4xl">{activeNotes.length}</p>
            <p className="mt-1 text-xs text-white/60">
              {pinnedCount > 0
                ? `${pinnedCount} catatan disematkan`
                : "Sematkan catatan penting agar muncul di Hari Ini"}
            </p>
          </div>
          <FileText className="size-8 text-white/60" aria-hidden="true" />
        </div>
      </section>

      <section aria-labelledby="note-list-title" className="space-y-3">
        <h2 id="note-list-title" className="text-lg font-extrabold">
          Daftar catatan
        </h2>
        <NoteList
          notes={notes}
          today={todayInTokyo()}
          currentUserId={context.userId}
          currentRole={context.role}
        />
      </section>

      <section aria-labelledby="note-form-title" className="space-y-3">
        <h2 id="note-form-title" className="text-lg font-extrabold">
          Tulis catatan
        </h2>
        <div className="rounded-[20px] border border-border bg-card p-4 shadow-sm">
          <NoteForm />
        </div>
      </section>
    </div>
  );
}
