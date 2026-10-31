import { ShoppingBag } from "lucide-react";
import { connection } from "next/server";

import {
  HouseholdNotReadyNotice,
  LoadErrorNotice,
  SupabaseSetupNotice,
} from "@/components/layout/household-notices";
import { ShoppingForm } from "@/features/shopping/shopping-form";
import { ShoppingList } from "@/features/shopping/shopping-list";
import { fetchShoppingItems } from "@/features/shopping/queries";
import { getPublicEnvironment } from "@/lib/env";
import { getHouseholdContext } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";

function PageHeader() {
  return (
    <header>
      <p className="eyebrow">Kebutuhan bersama</p>
      <h1 className="display-title text-[2.65rem] leading-none">Belanja</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Catat kebutuhan rumah agar tidak ada barang penting yang terlewat.
      </p>
    </header>
  );
}

export default async function ShoppingPage() {
  await connection();

  const environment = getPublicEnvironment();

  if (!environment.isSupabaseConfigured) {
    return (
      <div className="space-y-6">
        <PageHeader />
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
        <PageHeader />
        <HouseholdNotReadyNotice />
      </div>
    );
  }

  const { items, error } = await fetchShoppingItems(supabase, context.householdId);
  const neededItems = items.filter((item) => item.status === "needed");
  const urgentCount = neededItems.filter((item) => item.priority === "high").length;

  return (
    <div className="space-y-6">
      <PageHeader />

      <LoadErrorNotice messages={error ? [error] : []} />

      <section
        className="rounded-[20px] bg-charcoal p-5 text-white shadow-sm"
        aria-labelledby="shopping-summary-title"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p
              id="shopping-summary-title"
              className="text-xs font-extrabold uppercase tracking-[0.12em] text-white/60"
            >
              Perlu dibeli
            </p>
            <p className="display-title mt-1 text-4xl">{neededItems.length}</p>
            <p className="mt-1 text-xs text-white/60">
              {urgentCount > 0
                ? `${urgentCount} barang bertanda mendesak`
                : "tidak ada yang mendesak"}
            </p>
          </div>
          <ShoppingBag className="size-8 text-white/60" aria-hidden="true" />
        </div>
      </section>

      <section aria-labelledby="shopping-list-title" className="space-y-3">
        <h2 id="shopping-list-title" className="text-lg font-extrabold">
          Daftar rumah
        </h2>
        <ShoppingList
          items={items}
          currentUserId={context.userId}
          currentRole={context.role}
        />
      </section>

      <section aria-labelledby="shopping-form-title" className="space-y-3">
        <h2 id="shopping-form-title" className="text-lg font-extrabold">
          Tambah barang
        </h2>
        <div className="rounded-[20px] border border-border bg-card p-4 shadow-sm">
          <ShoppingForm />
        </div>
      </section>
    </div>
  );
}
