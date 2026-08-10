"use client";

/**
 * S10.3 — ออกจากร้านนี้ (ux-wireframe §10.3, D-029).
 *
 * Reachable from S4's text link as well as the members screen, because every
 * ACTIVE MEMBER may leave — including Staff, who cannot open the members
 * screen at all. That is why `DELETE /orgs/{orgId}/membership` is its own
 * endpoint with no capability requirement.
 *
 * The refusal handling lives in `toLeaveOrgOutcome`: three behaviours for four
 * outcomes, and the pairing is the part that is invisible when wrong.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLeaveOrganization } from "../api/use-member-mutations";
import { toLeaveOrgOutcome } from "../leave-org";
import { useActiveOrg } from "../../../lib/org/org-context";
import { CAPABILITY_MANAGE_MEMBERS } from "../member-actions";
import { useToast } from "../../../components/providers/ToastProvider";
import { Button } from "../../../components/ui/Button";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";
import { membersTh } from "../i18n";

export const LEAVE_ORG_DIALOG_COPY = {
  title: (org: string) => `ออกจาก${org}?`,
  body: "คุณจะเข้าถึงข้อมูลของร้านนี้ไม่ได้อีก จนกว่าจะมีคนเชิญคุณกลับเข้ามาใหม่ · ร้านอื่นของคุณไม่ได้รับผลกระทบ",
  confirm: "ออกจากร้านนี้",
  cancel: "ยกเลิก",
  goToMembers: "ไปหน้าสมาชิก",
  successToast: (org: string) => `คุณออกจากร้าน "${org}" แล้ว`,
} as const;

export function LeaveOrgDialog({ onClose }: { onClose: () => void }) {
  const org = useActiveOrg();
  const router = useRouter();
  const toast = useToast();
  const leave = useLeaveOrganization();
  const [message, setMessage] = useState<string | null>(null);
  const [offerMembersLink, setOfferMembersLink] = useState(false);

  const submit = () => {
    setMessage(null);
    setOfferMembersLink(false);
    leave.mutate(undefined, {
      onSuccess: () => {
        toast.success(LEAVE_ORG_DIALOG_COPY.successToast(org.name));
        router.replace("/select-org");
      },
      onError: (err) => {
        const outcome = toLeaveOrgOutcome(
          err,
          org.capabilities.has(CAPABILITY_MANAGE_MEMBERS),
        );
        if (outcome.kind === "already-left") {
          // Not an error to fix — they already left. Close and let `OrgGuard`
          // run §12.1 on the next request.
          onClose();
          return;
        }
        setMessage(outcome.message);
        setOfferMembersLink(outcome.kind === "blocked" && outcome.offerMembersLink);
      },
    });
  };

  return (
    <div
      role="alertdialog"
      aria-label={LEAVE_ORG_DIALOG_COPY.title(org.name)}
      className="rounded-card border border-border-default p-4"
    >
      <h3 className="text-heading-sm">{LEAVE_ORG_DIALOG_COPY.title(org.name)}</h3>
      <p className="text-body-sm">{LEAVE_ORG_DIALOG_COPY.body}</p>

      {message && <ErrorBanner message={message} />}
      {offerMembersLink && (
        <Link href={`/o/${org.orgId}/settings/members`}>{LEAVE_ORG_DIALOG_COPY.goToMembers}</Link>
      )}

      <Button variant="secondary" onClick={onClose} disabled={leave.isPending}>
        {LEAVE_ORG_DIALOG_COPY.cancel}
      </Button>
      <Button
        variant="destructive"
        onClick={submit}
        disabled={leave.isPending}
        loading={leave.isPending}
        loadingLabel={membersTh.leaveOrg}
      >
        {LEAVE_ORG_DIALOG_COPY.confirm}
      </Button>
    </div>
  );
}
