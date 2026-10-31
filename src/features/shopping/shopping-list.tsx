"use client";

import {
  AlertCircle,
  CheckCircle2,
  Circle,
  LoaderCircle,
  Trash2,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  deleteShoppingItem,
  markItemNeeded,
  markItemPurchased,
  type ShoppingActionState,
} from "@/features/shopping/actions";
import {
  shoppingPriorityLabels,
  shoppingPriorityStyles,
} from "@/features/shopping/shopping-schema";
import type { ShoppingItemRecord } from "@/features/shopping/types";
import type { HouseholdRole } from "@/lib/household";

export type ShoppingListProps = {
  items: ShoppingItemRecord[];
  currentUserId: string;
  currentRole: HouseholdRole;
};

type FilterKey = "all" | "needed" | "purchased";

const filters: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "needed", label: "Perlu dibeli" },
  { key: "purchased", label: "Sudah dibeli" },
];

/**
 * Menyatukan baris barang menjadi teks pendukung singkat: jumlah, lalu siapa yang
 * menambahkan atau siapa yang sudah membeli.
 */
function itemMeta(item: ShoppingItemRecord) {
  const parts = [item.quantity > 1 ? `jumlah ×${item.quantity}` : null];

  if (item.status === "purchased") {
    parts.push(item.buyer ? `dibeli ${item.buyer.display_name}` : "sudah dibeli");
  } else if (item.creator) {
    parts.push(`diajukan ${item.creator.display_name}`);
  }

  return parts.filter(Boolean).join(" · ");
}

/** Daftar belanja bersama dengan centang beli, pembatalan, dan hapus. */
export function ShoppingList({
  items,
  currentUserId,
  currentRole,
}: ShoppingListProps) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [actionState, setActionState] = useState<ShoppingActionState>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const counts = useMemo(
    () => ({
      all: items.length,
      needed: items.filter((item) => item.status === "needed").length,
      purchased: items.filter((item) => item.status === "purchased").length,
    }),
    [items],
  );

  const visible = useMemo(
    () => (filter === "all" ? items : items.filter((item) => item.status === filter)),
    [filter, items],
  );

  function run(
    action: (formData: FormData) => Promise<ShoppingActionState>,
    itemId: string,
  ) {
    setActionState({});
    setPendingId(itemId);
    const formData = new FormData();
    formData.set("itemId", itemId);

    startTransition(async () => {
      const state = await action(formData);
      setActionState(state);
      setPendingId(null);
    });
  }

  function handleDelete(item: ShoppingItemRecord) {
    // Aksi destruktif: konfirmasi menyebut objek yang dihapus.
    const confirmed = window.confirm(
      `Hapus "${item.name}" dari daftar belanja rumah?`,
    );

    if (!confirmed) {
      return;
    }

    run(deleteShoppingItem, item.id);
  }

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
        Belum ada barang di daftar. Tambahkan lewat form di bawah.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2" role="group" aria-label="Filter status barang">
        {filters.map((item) => (
          <Button
            key={item.key}
            type="button"
            size="sm"
            variant={filter === item.key ? "secondary" : "ghost"}
            aria-pressed={filter === item.key}
            onClick={() => setFilter(item.key)}
            className="flex-1"
          >
            {`${item.label} (${counts[item.key]})`}
          </Button>
        ))}
      </div>

      {actionState.error ? (
        <Alert variant="destructive" role="alert">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Tidak dapat memperbarui daftar</AlertTitle>
          <AlertDescription>{actionState.error}</AlertDescription>
        </Alert>
      ) : null}

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          Tidak ada barang pada filter ini.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-border bg-card">
          {visible.map((item) => {
            const isPurchased = item.status === "purchased";
            // Kebijakan RLS membatalkan pembelian hanya untuk pembuat barang,
            // pembeli, atau owner; menghapus hanya untuk pembuat atau owner.
            const canToggle =
              !isPurchased ||
              item.created_by === currentUserId ||
              item.purchased_by === currentUserId ||
              currentRole === "owner";
            const canDelete =
              item.created_by === currentUserId || currentRole === "owner";
            const rowBody = (
              <>
                {pendingId === item.id ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : isPurchased ? (
                  <CheckCircle2 className="text-success" aria-hidden="true" />
                ) : (
                  <Circle className="text-muted-foreground" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate text-sm font-bold ${
                      isPurchased ? "text-muted-foreground line-through" : ""
                    }`}
                  >
                    {item.name}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {itemMeta(item)}
                  </span>
                </span>
                {!isPurchased && item.priority !== "normal" ? (
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-wide ${shoppingPriorityStyles[item.priority]}`}
                  >
                    {shoppingPriorityLabels[item.priority]}
                  </span>
                ) : null}
              </>
            );

            return (
              <li
                key={item.id}
                className="flex items-center gap-1 border-border px-2 not-last:border-b"
              >
                {canToggle ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={isPending}
                    aria-label={
                      isPurchased
                        ? `Batalkan pembelian ${item.name}`
                        : `Tandai ${item.name} sudah dibeli`
                    }
                    onClick={() =>
                      run(isPurchased ? markItemNeeded : markItemPurchased, item.id)
                    }
                    className="h-auto min-w-0 flex-1 justify-start gap-3 whitespace-normal py-3 text-left"
                  >
                    {rowBody}
                  </Button>
                ) : (
                  /* Baris tanpa affordance klik: pengguna tidak ditawari aksi yang
                     pasti ditolak RLS. Info pembeli tetap terbaca di meta. */
                  <div className="flex min-w-0 flex-1 items-center gap-3 px-2 py-3">
                    {rowBody}
                  </div>
                )}
                {canDelete ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    title="Hapus"
                    aria-label={`Hapus ${item.name}`}
                    disabled={isPending}
                    onClick={() => handleDelete(item)}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
