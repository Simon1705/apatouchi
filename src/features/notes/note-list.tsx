"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Archive,
  ArchiveRestore,
  AlertCircle,
  FileText,
  LoaderCircle,
  Pencil,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { formatRelativeDayLabel, tokyoDateFromIso } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  deleteHouseNote,
  setHouseNoteStatus,
  toggleHouseNotePin,
} from "@/features/notes/actions";
import {
  noteStatusLabels,
  noteStatusStyles,
  type NoteStatus,
} from "@/features/notes/note-schema";
import { NoteEditForm } from "@/features/notes/note-edit-form";
import type { HouseNoteRecord } from "@/features/notes/types";

/** Isi panjang ditampilkan singkat agar daftar tetap mudah discan. */
const CONTENT_PREVIEW_LIMIT = 240;

type NoteListProps = {
  notes: HouseNoteRecord[];
  /** Tanggal rumah hari ini (`YYYY-MM-DD`) untuk label "kemarin" dan sejenisnya. */
  today: string;
  currentUserId: string;
  currentRole: string;
};

type NoteAction = (
  formData: FormData,
) => Promise<{ error: string | null; message?: string }>;

type NoteCardProps = {
  note: HouseNoteRecord;
  today: string;
  canEdit: boolean;
  canDelete: boolean;
  isBusy: boolean;
  run: (
    action: NoteAction,
    key: string,
    formData: FormData,
    successMessage?: string,
  ) => void;
};

/**
 * Daftar catatan rumah: filter aktif/arsip, sematan, ubah in-place, arsipkan, hapus.
 *
 * Hak ubah mengikuti policy `house_notes_update_author_editor_owner` (pembuat,
 * pengubah terakhir, atau pemilik rumah), jadi tombol "Ubah" bisa muncul pada
 * catatan milik penghuni lain yang baru saja kita perbarui.
 */
export function NoteList({
  notes,
  today,
  currentUserId,
  currentRole,
}: NoteListProps) {
  const [filter, setFilter] = useState<NoteStatus>("active");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionState, setActionState] = useState<{
    error?: string;
    message?: string;
  }>({});
  const [isPending, startTransition] = useTransition();

  const counts = useMemo(
    () => ({
      active: notes.filter((note) => note.status === "active").length,
      archived: notes.filter((note) => note.status === "archived").length,
    }),
    [notes],
  );

  const visible = useMemo(
    () => notes.filter((note) => note.status === filter),
    [filter, notes],
  );

  /**
   * Menjalankan satu aksi catatan dengan feedback: tombol terkait disabled selama
   * berjalan, hasil (sukses/gagal) ditampilkan di dekat daftar.
   */
  function run(
    action: NoteAction,
    key: string,
    formData: FormData,
    successMessage = "Perubahan tersimpan.",
  ) {
    setActionState({});
    setBusyKey(key);

    startTransition(async () => {
      const result = await action(formData);
      setBusyKey(null);
      setActionState(
        result.error ? { error: result.error } : { message: result.message ?? successMessage },
      );
    });
  }

  const filters: { value: NoteStatus; label: string }[] = [
    { value: "active", label: "Aktif" },
    { value: "archived", label: "Arsip" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex gap-2" role="group" aria-label="Filter status catatan">
        {filters.map((item) => (
          <Button
            key={item.value}
            type="button"
            size="sm"
            variant={filter === item.value ? "secondary" : "ghost"}
            aria-pressed={filter === item.value}
            disabled={isPending}
            onClick={() => setFilter(item.value)}
            className="flex-1"
          >
            {`${item.label} (${counts[item.value]})`}
          </Button>
        ))}
      </div>

      {actionState.error ? (
        <Alert variant="destructive" role="alert">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Catatan tidak dapat diperbarui</AlertTitle>
          <AlertDescription>{actionState.error}</AlertDescription>
        </Alert>
      ) : null}

      {actionState.message ? (
        <p className="text-sm font-medium text-success" role="status">
          {actionState.message}
        </p>
      ) : null}

      {notes.length === 0 ? (
        <Card className="p-5 text-center">
          <FileText className="mx-auto mb-3 text-muted-foreground" aria-hidden="true" />
          <p className="font-display text-lg font-semibold">Belum ada catatan rumah</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Tulis pengingat bersama: jadwal petugas gedung, iuran bulanan, atau barang
            yang perlu diperhatikan.
          </p>
        </Card>
      ) : visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          {filter === "active"
            ? "Tidak ada catatan aktif. Cek filter Arsip atau tulis catatan baru."
            : "Belum ada catatan yang diarsipkan."}
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((note) => (
            <li key={note.id}>
              <NoteCard
                note={note}
                today={today}
                canEdit={
                  note.created_by === currentUserId ||
                  note.updated_by === currentUserId ||
                  currentRole === "owner"
                }
                canDelete={note.created_by === currentUserId || currentRole === "owner"}
                isBusy={busyKey?.startsWith(`${note.id}:`) ?? false}
                run={run}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Kartu satu catatan, termasuk mode ubah in-place. */
function NoteCard({
  note,
  today,
  canEdit,
  canDelete,
  isBusy,
  run,
}: NoteCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const isLong = note.content.length > CONTENT_PREVIEW_LIMIT;

  if (isEditing) {
    return (
      <Card className="border-border bg-card p-5 shadow-lg shadow-foreground/5">
        <p className="eyebrow mb-3 text-[11px]">Ubah catatan</p>
        <NoteEditForm note={note} onCancel={() => setIsEditing(false)} />
      </Card>
    );
  }

  function handleTogglePin() {
    const formData = new FormData();
    formData.set("noteId", note.id);
    run(toggleHouseNotePin, `${note.id}:pin`, formData);
  }

  function handleToggleStatus() {
    const formData = new FormData();
    formData.set("noteId", note.id);
    formData.set("status", note.status === "active" ? "archived" : "active");
    run(setHouseNoteStatus, `${note.id}:status`, formData);
  }

  function handleDelete() {
    // Aksi destruktif: konfirmasi menyebut objek yang dihapus.
    if (
      !window.confirm(
        `Hapus catatan "${note.title}"? Tindakan ini tidak bisa dibatalkan.`,
      )
    ) {
      return;
    }

    const formData = new FormData();
    formData.set("noteId", note.id);
    run(deleteHouseNote, `${note.id}:delete`, formData, "Catatan dihapus.");
  }

  return (
    <Card className="space-y-3 border-border bg-card p-5 shadow-lg shadow-foreground/5">
      {note.is_pinned || note.status === "archived" ? (
        <div className="flex flex-wrap items-center gap-2">
          {note.is_pinned ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning">
              <Pin className="size-3.5" aria-hidden="true" />
              Penting
            </span>
          ) : null}
          {note.status === "archived" ? (
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-semibold",
                noteStatusStyles[note.status],
              )}
            >
              {noteStatusLabels[note.status]}
            </span>
          ) : null}
        </div>
      ) : null}

      <h3 className="font-display text-base font-bold leading-6">{note.title}</h3>

      <p
        className={cn(
          "text-sm leading-6 whitespace-pre-line text-card-foreground",
          isLong && !isExpanded ? "line-clamp-3" : "",
        )}
      >
        {note.content}
      </p>

      {isLong ? (
        <Button
          variant="link"
          type="button"
          className="h-auto p-0 text-xs font-semibold"
          onClick={() => setIsExpanded((current) => !current)}
          aria-expanded={isExpanded}
        >
          {isExpanded ? "Tutup" : "Baca selengkapnya"}
        </Button>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Diperbarui {note.editor?.display_name ?? note.creator?.display_name ?? "penghuni"} ·{" "}
        {formatRelativeDayLabel(tokyoDateFromIso(note.updated_at), today)}
      </p>

      {canEdit || canDelete ? (
        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          {canEdit ? (
            <>
              <Button
                variant="outline"
                size="sm"
                type="button"
                disabled={isBusy}
                onClick={() => setIsEditing(true)}
              >
                <Pencil aria-hidden="true" />
                Ubah
              </Button>
              <Button
                variant="outline"
                size="sm"
                type="button"
                disabled={isBusy}
                onClick={handleTogglePin}
              >
                {isBusy ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : note.is_pinned ? (
                  <PinOff aria-hidden="true" />
                ) : (
                  <Pin aria-hidden="true" />
                )}
                {note.is_pinned ? "Lepas sematan" : "Sematkan"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                type="button"
                disabled={isBusy}
                onClick={handleToggleStatus}
              >
                {note.status === "active" ? (
                  <Archive aria-hidden="true" />
                ) : (
                  <ArchiveRestore aria-hidden="true" />
                )}
                {note.status === "active" ? "Arsipkan" : "Pulihkan"}
              </Button>
            </>
          ) : null}

          {canDelete ? (
            <Button
              variant="outline"
              size="sm"
              type="button"
              className="text-destructive"
              disabled={isBusy}
              onClick={handleDelete}
            >
              <Trash2 aria-hidden="true" />
              Hapus
            </Button>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
