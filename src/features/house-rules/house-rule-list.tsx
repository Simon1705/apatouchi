"use client";

import {
  AlertCircle,
  Archive,
  BadgeCheck,
  LoaderCircle,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Undo2,
} from "lucide-react";
import { useState, useTransition } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  activateHouseRule,
  archiveHouseRule,
  deleteHouseRule,
  retractHouseRuleVote,
  voteHouseRule,
  type HouseRuleActionState,
} from "@/features/house-rules/actions";
import {
  summarizeApprovals,
  type ApprovalSummary,
} from "@/features/house-rules/approvals";
import {
  ruleStatusLabels,
  ruleStatusStyles,
} from "@/features/house-rules/house-rule-schema";
import type {
  HouseMemberRecord,
  HouseRuleRecord,
} from "@/features/house-rules/types";
import type { HouseholdRole } from "@/lib/household";

export type HouseRuleListProps = {
  rules: HouseRuleRecord[];
  members: HouseMemberRecord[];
  currentUserId: string;
  currentRole: HouseholdRole;
};

/** Menjalankan aksi pada satu aturan; `key` membedakan tombol yang sedang sibuk. */
type ActionRunner = (
  action: (formData: FormData) => Promise<HouseRuleActionState>,
  key: string,
  fields?: Record<string, string>,
) => void;

type RuleCardProps = {
  rule: HouseRuleRecord;
  summary: ApprovalSummary;
  canManage: boolean;
  busyKey: string | null;
  onAction: ActionRunner;
};

/**
 * Baris progres persetujuan: berapa suara yang sudah masuk dan siapa yang
 * masih menunggu, agar pengguna tidak perlu mengingat status dari layar lain.
 */
function ApprovalLine({ summary }: { summary: ApprovalSummary }) {
  const details: string[] = [];

  if (summary.waitingNames.length > 0) {
    details.push(`menunggu suara: ${summary.waitingNames.join(", ")}`);
  }

  if (summary.rejectedCount > 0) {
    details.push(`${summary.rejectedCount} penghuni menolak`);
  }

  return (
    <p className="mt-3 text-xs leading-5 text-muted-foreground">
      <span className="font-bold text-foreground">
        {summary.approvedCount}/{summary.memberCount}
      </span>{" "}
      penghuni menyetujui
      {details.length > 0 ? ` · ${details.join(" · ")}` : ""}
    </p>
  );
}

/** Satu kartu aturan dengan progres persetujuan, suara, dan aksi kelola. */
function RuleCard({ rule, summary, canManage, busyKey, onAction }: RuleCardProps) {
  const isOpen = rule.status === "draft" || rule.status === "pending_approval";
  const ruleId = rule.id;
  const isBusy = (key: string) => busyKey === `${ruleId}:${key}`;
  const anyBusy = busyKey?.startsWith(`${ruleId}:`) ?? false;

  function handleArchive() {
    // Aksi yang mengubah keadaan bersama: konfirmasi menyebut aturannya.
    if (!window.confirm(`Arsipkan aturan "${rule.title}"?`)) {
      return;
    }

    onAction(archiveHouseRule, "archive");
  }

  function handleDelete() {
    if (
      !window.confirm(
        `Hapus aturan "${rule.title}" beserta catatan persetujuannya?`,
      )
    ) {
      return;
    }

    onAction(deleteHouseRule, "delete");
  }

  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-extrabold leading-5">{rule.title}</h3>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-wide ${ruleStatusStyles[rule.status]}`}
        >
          {ruleStatusLabels[rule.status]}
        </span>
      </div>

      <p className="mt-2 text-sm leading-6 whitespace-pre-line text-muted-foreground">
        {rule.content}
      </p>

      {rule.creator ? (
        <p className="mt-2 text-xs text-muted-foreground">
          diusulkan {rule.creator.display_name}
        </p>
      ) : null}

      <ApprovalLine summary={summary} />

      {/* Aksi hanya ditawarkan pada aturan yang masih dibuka, atau oleh pihak
          yang memang punya hak kelola menurut RLS. */}
      {isOpen || canManage ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {isOpen ? (
            <>
              <Button
                type="button"
                size="sm"
                variant={summary.myVote === "yes" ? "secondary" : "outline"}
                aria-pressed={summary.myVote === "yes"}
                disabled={anyBusy}
                onClick={() => onAction(voteHouseRule, "yes", { vote: "yes" })}
                className="h-9 gap-1.5 px-3 font-bold"
              >
                {isBusy("yes") ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : (
                  <ThumbsUp aria-hidden="true" />
                )}
                Setujui
              </Button>
              <Button
                type="button"
                size="sm"
                variant={summary.myVote === "no" ? "secondary" : "outline"}
                aria-pressed={summary.myVote === "no"}
                disabled={anyBusy}
                onClick={() => onAction(voteHouseRule, "no", { vote: "no" })}
                className="h-9 gap-1.5 px-3 font-bold"
              >
                {isBusy("no") ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : (
                  <ThumbsDown aria-hidden="true" />
                )}
                Tolak
              </Button>
              {summary.myVote ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={anyBusy}
                  onClick={() => onAction(retractHouseRuleVote, "retract")}
                  className="h-9 gap-1.5 px-3"
                >
                  {isBusy("retract") ? (
                    <LoaderCircle className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Undo2 aria-hidden="true" />
                  )}
                  Cabut suara
                </Button>
              ) : null}
            </>
          ) : null}

          {isOpen && summary.isReady ? (
            canManage ? (
              <Button
                type="button"
                size="sm"
                disabled={anyBusy}
                onClick={() => onAction(activateHouseRule, "activate")}
                className="h-9 gap-1.5 px-3 font-bold"
              >
                {isBusy("activate") ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : (
                  <BadgeCheck aria-hidden="true" />
                )}
                Sahkan aturan
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                Siap disahkan — menunggu {rule.creator?.display_name ?? "pengusul"}{" "}
                atau pemilik rumah.
              </p>
            )
          ) : null}

          {canManage ? (
            <span className="flex flex-wrap gap-1">
              {rule.status !== "archived" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  title="Arsipkan"
                  aria-label={`Arsipkan ${rule.title}`}
                  disabled={anyBusy}
                  onClick={handleArchive}
                  className="text-muted-foreground"
                >
                  {isBusy("archive") ? (
                    <LoaderCircle className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Archive aria-hidden="true" />
                  )}
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                title="Hapus"
                aria-label={`Hapus ${rule.title}`}
                disabled={anyBusy}
                onClick={handleDelete}
                className="text-muted-foreground hover:text-destructive"
              >
                {isBusy("delete") ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 aria-hidden="true" />
                )}
              </Button>
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

/** Kelompok kartu aturan berdasarkan statusnya. */
export function HouseRuleList({
  rules,
  members,
  currentUserId,
  currentRole,
}: HouseRuleListProps) {
  const [actionState, setActionState] = useState<HouseRuleActionState>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(
    action: (formData: FormData) => Promise<HouseRuleActionState>,
    ruleId: string,
    key: string,
    fields?: Record<string, string>,
  ) {
    setActionState({});
    setBusyKey(`${ruleId}:${key}`);
    const formData = new FormData();
    formData.set("ruleId", ruleId);

    Object.entries(fields ?? {}).forEach(([name, value]) =>
      formData.set(name, value),
    );

    startTransition(async () => {
      const state = await action(formData);
      setActionState(state);
      setBusyKey(null);
    });
  }

  const grouped = rules.map((rule) => ({
    rule,
    summary: summarizeApprovals(rule, members, currentUserId),
    canManage: rule.created_by === currentUserId || currentRole === "owner",
  }));

  const pending = grouped.filter(
    (entry) => entry.rule.status === "draft" || entry.rule.status === "pending_approval",
  );
  const active = grouped.filter((entry) => entry.rule.status === "active");
  const archived = grouped.filter((entry) => entry.rule.status === "archived");

  if (rules.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
        Belum ada aturan rumah. Usulkan lewat form di bawah.
      </p>
    );
  }

  const sections: { key: string; title: string; entries: typeof grouped }[] = [
    { key: "pending", title: "Menunggu persetujuan", entries: pending },
    { key: "active", title: "Sudah berlaku", entries: active },
    { key: "archived", title: "Arsip", entries: archived },
  ];

  return (
    <div className="space-y-5">
      {actionState.error ? (
        <Alert variant="destructive" role="alert">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Tidak dapat memperbarui aturan</AlertTitle>
          <AlertDescription>{actionState.error}</AlertDescription>
        </Alert>
      ) : null}

      {actionState.ok ? (
        <p className="text-sm font-medium text-success" role="status">
          Perubahan tersimpan.
        </p>
      ) : null}

      {sections
        .filter((section) => section.entries.length > 0)
        .map((section) => (
          <section key={section.key} className="space-y-3" aria-label={section.title}>
            <h3 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
              {section.title}
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[0.65rem]">
                {section.entries.length}
              </span>
            </h3>
            <div className="space-y-3">
              {section.entries.map(({ rule, summary, canManage }) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  summary={summary}
                  canManage={canManage}
                  busyKey={isPending ? busyKey : null}
                  onAction={(action, key, fields) =>
                    run(action, rule.id, key, fields)
                  }
                />
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}
