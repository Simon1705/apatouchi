"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { LoaderCircle, Save, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { updateHouseNote } from "@/features/notes/actions";
import {
  houseNoteSchema,
  type HouseNoteValues,
} from "@/features/notes/note-schema";
import type { HouseNoteRecord } from "@/features/notes/types";

type NoteEditFormProps = {
  note: HouseNoteRecord;
  /** Dipanggil untuk menutup form (batal setelah input diubah mengonfirmasi dulu). */
  onCancel: () => void;
};

/**
 * Form ubah catatan rumah in-place.
 *
 * @param note Catatan yang sedang diedit; nilai awal form diambil dari baris ini.
 * @param onCancel Dipanggil saat user membatalkan atau perubahan berhasil disimpan.
 *   Pembatalan setelah input berubah dikonfirmasi lebih dulu agar tidak ada data
 *   yang hilang tanpa sadar.
 */
export function NoteEditForm({ note, onCancel }: NoteEditFormProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<HouseNoteValues>({
    resolver: zodResolver(houseNoteSchema),
    defaultValues: { title: note.title, content: note.content },
  });

  const onSubmit = handleSubmit((values) => {
    setActionError(null);
    const formData = new FormData();
    formData.set("noteId", note.id);
    formData.set("title", values.title);
    formData.set("content", values.content);

    startTransition(async () => {
      const result = await updateHouseNote(formData);

      if (result.error) {
        setActionError(result.error);
        return;
      }

      onCancel();
    });
  });

  const handleCancel = () => {
    // Input yang sudah diubah tidak tersimpan, jadi dikonfirmasi lebih dulu.
    if (isDirty && !window.confirm("Perubahan pada catatan tidak disimpan. Tutup form?")) {
      return;
    }

    onCancel();
  };

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      {actionError ? (
        <Alert variant="destructive">
          <AlertTitle>Catatan gagal diubah</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={`note-edit-title-${note.id}`}>Judul catatan</Label>
        <Input
          id={`note-edit-title-${note.id}`}
          autoComplete="off"
          disabled={isPending}
          {...register("title")}
        />
        {errors.title ? (
          <p className="text-xs text-destructive">{errors.title.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`note-edit-content-${note.id}`}>Isi catatan</Label>
        <Textarea
          id={`note-edit-content-${note.id}`}
          rows={5}
          disabled={isPending}
          {...register("content")}
        />
        {errors.content ? (
          <p className="text-xs text-destructive">{errors.content.message}</p>
        ) : null}
      </div>

      <div className="flex gap-2">
        <Button className="flex-1" type="submit" disabled={isPending}>
          {isPending ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : (
            <Save aria-hidden="true" />
          )}
          {isPending ? "Menyimpan..." : "Simpan perubahan"}
        </Button>
        <Button
          variant="outline"
          type="button"
          onClick={handleCancel}
          disabled={isPending}
        >
          <X aria-hidden="true" />
          Batal
        </Button>
      </div>
    </form>
  );
}
