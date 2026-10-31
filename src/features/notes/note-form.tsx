"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { LoaderCircle, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { createHouseNote } from "@/features/notes/actions";
import {
  houseNoteSchema,
  type HouseNoteValues,
} from "@/features/notes/note-schema";

/** Form default kosong untuk catatan baru. */
const emptyNote: HouseNoteValues = { title: "", content: "" };

/**
 * Form pembuatan catatan rumah.
 * Catatan baru langsung aktif dan tidak disemat; sematan diatur dari daftar.
 */
export function NoteForm() {
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<HouseNoteValues>({
    resolver: zodResolver(houseNoteSchema),
    defaultValues: emptyNote,
  });

  const onSubmit = handleSubmit((values) => {
    setActionError(null);
    const formData = new FormData();
    formData.set("title", values.title);
    formData.set("content", values.content);

    startTransition(async () => {
      const result = await createHouseNote(formData);

      if (result.error) {
        setActionError(result.error);
        return;
      }

      reset(emptyNote);
    });
  });

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      {actionError ? (
        <Alert variant="destructive">
          <AlertTitle>Catatan gagal dibuat</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="note-title">Judul catatan</Label>
        <Input
          id="note-title"
          autoComplete="off"
          placeholder="Pemeriksaan alarm kebakaran"
          disabled={isPending}
          {...register("title")}
        />
        {errors.title ? (
          <p className="text-xs text-destructive">{errors.title.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="note-content">Isi catatan</Label>
        <Textarea
          id="note-content"
          rows={5}
          placeholder="Petugas gedung datang Selasa pukul 10.00. Pastikan akses ke detektor tidak terhalang."
          disabled={isPending}
          {...register("content")}
        />
        {errors.content ? (
          <p className="text-xs text-destructive">{errors.content.message}</p>
        ) : null}
      </div>

      <Button className="w-full" size="lg" type="submit" disabled={isPending}>
        {isPending ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <Plus aria-hidden="true" />
        )}
        {isPending ? "Menyimpan..." : "Simpan catatan"}
      </Button>
    </form>
  );
}
