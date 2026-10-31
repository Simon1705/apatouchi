"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { MoneyDuesForm } from "@/features/money/money-dues-form";
import { MoneyExpenseForm } from "@/features/money/money-expense-form";
import type { MoneyCategoryRecord, MoneyMemberRecord } from "@/features/money/types";

export type MoneyCapturePanelProps = {
  members: MoneyMemberRecord[];
  categories: MoneyCategoryRecord[];
  currentUserId: string;
  today: string;
  defaultAmountJpy: number;
};

type CaptureMode = "dues" | "expense";

const modes: { value: CaptureMode; label: string }[] = [
  { value: "dues", label: "Tambah uang" },
  { value: "expense", label: "Catat pengeluaran" },
];

/**
 * Wadah dua form pencatatan uang.
 *
 * Kedua aksi tidak pernah dilakukan bersamaan, jadi satu form tampil pada satu waktu
 * agar layar ponsel tetap pendek; tombolnya memakai `aria-pressed` supaya pembaca
 * layar tahu mode mana yang aktif.
 */
export function MoneyCapturePanel({
  members,
  categories,
  currentUserId,
  today,
  defaultAmountJpy,
}: MoneyCapturePanelProps) {
  const [mode, setMode] = useState<CaptureMode>("dues");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Jenis pencatatan">
        {modes.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant={mode === option.value ? "default" : "outline"}
            aria-pressed={mode === option.value}
            onClick={() => setMode(option.value)}
            className="w-full"
          >
            {option.label}
          </Button>
        ))}
      </div>

      {mode === "dues" ? (
        <MoneyDuesForm
          members={members}
          currentUserId={currentUserId}
          today={today}
          defaultAmountJpy={defaultAmountJpy}
        />
      ) : (
        <MoneyExpenseForm
          members={members}
          categories={categories}
          currentUserId={currentUserId}
          today={today}
        />
      )}
    </div>
  );
}
