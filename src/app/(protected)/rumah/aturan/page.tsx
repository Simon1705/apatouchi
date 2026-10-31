import { ScrollText } from "lucide-react";
import { connection } from "next/server";

import {
  HouseholdNotReadyNotice,
  LoadErrorNotice,
  SupabaseSetupNotice,
} from "@/components/layout/household-notices";
import { SubpageHeader } from "@/components/layout/subpage-header";
import { HouseRuleForm } from "@/features/house-rules/house-rule-form";
import { HouseRuleList } from "@/features/house-rules/house-rule-list";
import {
  fetchHouseholdMembers,
  fetchHouseRules,
} from "@/features/house-rules/queries";
import { getPublicEnvironment } from "@/lib/env";
import { getHouseholdContext } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";

const header = {
  title: "Aturan rumah",
  description:
    "Kesepakatan ditulis dan disetujui bersama, supaya tidak hanya diingat satu orang.",
};

export default async function HouseRulesPage() {
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

  const [rulesResult, membersResult] = await Promise.all([
    fetchHouseRules(supabase, context.householdId),
    fetchHouseholdMembers(supabase),
  ]);

  const rules = rulesResult.rules;
  const members = membersResult.members;
  const activeCount = rules.filter((rule) => rule.status === "active").length;
  const pendingCount = rules.filter(
    (rule) => rule.status === "draft" || rule.status === "pending_approval",
  ).length;

  return (
    <div className="space-y-6">
      <SubpageHeader {...header} />

      <LoadErrorNotice
        messages={[rulesResult.error, membersResult.error].filter(
          (message): message is string => Boolean(message),
        )}
      />

      <section
        className="rounded-[20px] bg-charcoal p-5 text-white shadow-sm"
        aria-labelledby="house-rule-summary-title"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p
              id="house-rule-summary-title"
              className="text-xs font-extrabold uppercase tracking-[0.12em] text-white/60"
            >
              Aturan berlaku
            </p>
            <p className="display-title mt-1 text-4xl">{activeCount}</p>
            <p className="mt-1 text-xs text-white/60">
              {pendingCount > 0
                ? `${pendingCount} usulan menunggu persetujuan`
                : `${members.length} penghuni rumah`}
            </p>
          </div>
          <ScrollText className="size-8 text-white/60" aria-hidden="true" />
        </div>
      </section>

      <section aria-labelledby="house-rule-list-title" className="space-y-3">
        <h2 id="house-rule-list-title" className="text-lg font-extrabold">
          Daftar aturan
        </h2>
        <HouseRuleList
          rules={rules}
          members={members}
          currentUserId={context.userId}
          currentRole={context.role}
        />
      </section>

      <section aria-labelledby="house-rule-form-title" className="space-y-3">
        <h2 id="house-rule-form-title" className="text-lg font-extrabold">
          Usulkan aturan
        </h2>
        <div className="rounded-[20px] border border-border bg-card p-4 shadow-sm">
          <HouseRuleForm />
        </div>
      </section>
    </div>
  );
}
