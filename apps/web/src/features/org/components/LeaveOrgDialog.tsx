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
import { can } from "../../../lib/org/capability";
import { CAPABILITY_MANAGE_MEMBERS } from "../member-actions";
import { useToast } from "../../../components/providers/ToastProvider";
import { Button } from "../../../components/ui/Button";
import { DialogShell } from "../../../components/ui/DialogShell";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";
import { membersTh } from "../i18n";

export const LEAVE_ORG_DIALOG_COPY = {
  title: (org: string) => `ออกจาก${org}?`,
  body: "คุณจะเข้าถึงข้อมูลของร้านนี้ไม่ได้อีก จนกว่าจะมีคนเชิญคุณกลับเข้ามาใหม่ · ร้านอื่นของคุณไม่ได้รับผลกระทบ",
  confirm: "ออกจากร้านนี้",
  cancel: "ยกเลิก",
  /**
   * ★ M-06 (§12.2 manual pass) — `goToMembers` used to be one link to
   * `/o/{id}/settings/members` whatever screen the dialog was opened from. On
   * the members screen — which is one of its two entry points — that is a link
   * to the page you are standing on, so pressing it does nothing at the exact
   * moment the person was told "no".
   *
   * ux answered in ux-wireframe §10.3: name the OUTCOME from elsewhere, and
   * from the members screen name the CONTROL that is already on the reader's
   * screen. Both strings are `ux`'s (`membersTh.leaveLastOwnerCta` /
   * `leaveLastOwnerHere`); this component only picks between them.
   */
  successToast: (org: string) => `คุณออกจากร้าน "${org}" แล้ว`,
} as const;

/** Which screen opened the dialog — §10.3 branches the last-Owner CTA on it. */
export type LeaveOrgOrigin = "members" | "elsewhere";

export function LeaveOrgDialog({
  onClose,
  origin = "elsewhere",
}: {
  onClose: () => void;
  /** ⛔ A PROP, not `usePathname()`. The dialog does not get to guess where it
   *  is: the caller knows, and a route-string comparison is one refactor away
   *  from silently choosing the wrong branch again. */
  origin?: LeaveOrgOrigin;
}) {
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
        // ★ `can`, not `.has` (capability.ts): this decides whether the
        // last-Owner refusal offers the members screen as the way out — and
        // the person who hits that refusal is ALWAYS an Owner, so the set
        // lookup withheld the way out from everybody who ever saw it.
        const outcome = toLeaveOrgOutcome(err, can(org.capabilities, CAPABILITY_MANAGE_MEMBERS));
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
    <DialogShell label={LEAVE_ORG_DIALOG_COPY.title(org.name)} onClose={onClose} role="alertdialog">
        <h3 className="text-heading-sm">{LEAVE_ORG_DIALOG_COPY.title(org.name)}</h3>
        <p className="text-body-sm">{LEAVE_ORG_DIALOG_COPY.body}</p>

        {message && <ErrorBanner message={message} />}
        {offerMembersLink &&
          (origin === "members" ? (
            <p className="text-body-sm">{membersTh.leaveLastOwnerHere}</p>
          ) : (
            <Link href={`/o/${org.orgId}/settings/members`}>
              {membersTh.leaveLastOwnerCta}
            </Link>
          ))}

        {/* `.dialog .acts` — one right-aligned row, `space.3` between. */}
        <div className="flex flex-wrap justify-end gap-3 pt-2">
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
    
    </DialogShell>
  );
}
