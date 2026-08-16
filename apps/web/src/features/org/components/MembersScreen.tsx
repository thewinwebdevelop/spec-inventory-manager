"use client";

/**
 * S6 — สมาชิก (ux-wireframe §7). One screen, two sections: outstanding
 * invitations on top because they are unfinished work, members below.
 *
 * Every action offered here comes from `memberActionsFor`, which is a pure
 * function precisely because §7's table has three axes and the cells that
 * matter are the ones that are easy to reverse. Hiding an action is UX; the
 * server refuses regardless, and each hidden action still has an error path.
 */
import { useMemo, useState } from "react";
import { useMembers, useInvitations, useRoles } from "../api/use-members";
import {
  useCancelInvitation,
  useReissueInvitationLink,
} from "../api/use-member-mutations";
import { memberActionsFor, isOwner } from "../member-actions";
import { closeInviteLink, openInviteLink, type InviteLinkState } from "../invite-link";
import { INVITE_LINK_CLOSED } from "../invite-link";
import { formatExpiry } from "../expiry";
import { invitationConfirmTh, membersTh, roleLabel } from "../i18n";
import { errorsTh } from "../../../i18n/errors";
import { useActiveOrg } from "../../../lib/org/org-context";
import { toApiFailure, failureMessage } from "../../../lib/api/error";
import { useToast } from "../../../components/providers/ToastProvider";
import { Button } from "../../../components/ui/Button";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";
import { SkeletonRow } from "../../../components/ui/Skeleton";
import { CopyLinkPanel } from "./CopyLinkPanel";
import { InviteDialog } from "./InviteDialog";
import { ChangeRoleDialog } from "./ChangeRoleDialog";
import { RemoveMemberDialog } from "./RemoveMemberDialog";
import { LeaveOrgDialog } from "./LeaveOrgDialog";

export function MembersScreen() {
  const org = useActiveOrg();
  const toast = useToast();
  const [memberStatus, setMemberStatus] = useState<"active" | "all">("active");
  const [invitationStatus, setInvitationStatus] = useState<"pending" | "all">("pending");
  const [inviting, setInviting] = useState(false);
  const [link, setLink] = useState<InviteLinkState>(INVITE_LINK_CLOSED);
  /**
   * ★ T-002-Q7 · §9.2/§9.3 — the confirmation both actions were missing.
   *
   * Held as the row being acted on rather than a boolean, because the dialog
   * names the invitee and the role: a confirmation that says "are you sure"
   * without saying about whom is one people learn to press through.
   */
  const [confirming, setConfirming] = useState<
    { action: "reissue" | "cancel"; id: string; email: string; roleName: string } | null
  >(null);
  /**
   * W-17 — which member dialog is open, and about whom.
   *
   * One piece of state rather than three booleans: the three actions are
   * mutually exclusive by construction (`memberActionsFor` never offers
   * "remove" and "leave" on the same row), and three flags would let a future
   * edit open two at once.
   */
  const [acting, setActing] = useState<
    | { kind: "change-role"; userId: string; email: string; roleId: string; isOwner: boolean }
    | { kind: "remove"; userId: string; email: string }
    | { kind: "leave" }
    | null
  >(null);

  const members = useMembers(memberStatus);
  const invitations = useInvitations(invitationStatus);
  const roles = useRoles();
  const reissue = useReissueInvitationLink();
  const cancel = useCancelInvitation();

  /**
   * Which role ids grant ownership — derived from CAPABILITIES, never from
   * `key === "owner"`. `GET /orgs/{orgId}/roles` deliberately does not publish
   * `capabilities` (§3.6), so the only role we can classify for certain is the
   * caller's own. Everything else is decided server-side, which is why the
   * invite dialog's filter is UX and the API's `canAssignRole` is the rule.
   */
  const ownerRoleIds = useMemo(() => {
    const ids = new Set<string>();
    if (isOwner(org.capabilities) && org.profile.myMembership.roleId) {
      ids.add(org.profile.myMembership.roleId);
    }
    return ids;
  }, [org.capabilities, org.profile.myMembership.roleId]);

  const pending = invitations.data?.items ?? [];
  const memberRows = members.data?.items ?? [];

  return (
    <main className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-heading-md">{membersTh.title}</h1>
        <Button onClick={() => setInviting(true)}>{membersTh.invite}</Button>
      </div>

      {/* §7: the whole section disappears when there is nothing outstanding —
          an empty "0 invitations" heading is clutter, not information. */}
      {pending.length > 0 && (
        <section className="mb-6">
          <h2 className="text-heading-sm">{membersTh.pendingSection(pending.length)}</h2>
          <ul className="list-none p-0">
            {pending.map((invitation) => (
              <li key={invitation.id} className="rounded-card border border-border-default p-3">
                <span>{invitation.email}</span>{" "}
                <span className="text-body-sm">
                  {roleLabel(invitation.roleKey, invitation.roleName)}
                </span>
                <p className="text-body-sm">{formatExpiry(invitation.expiresAt)}</p>

                {/* D-028/I-7 — a soft flag, never an accusation. */}
                {invitation.acceptedUserCreatedAfterInvite === true && (
                  <p role="note" className="text-body-sm text-warning-text">
                    {membersTh.acceptedAfterInviteFlag}
                  </p>
                )}

                {invitation.status === "pending" && (
                  <>
                    <Button
                      variant="secondary"
                      disabled={reissue.isPending}
                      onClick={() =>
                        setConfirming({
                          action: "reissue",
                          id: invitation.id,
                          email: invitation.email,
                          roleName: roleLabel(invitation.roleKey, invitation.roleName),
                        })
                      }
                    >
                      {membersTh.reissue}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={cancel.isPending}
                      onClick={() =>
                        setConfirming({
                          action: "cancel",
                          id: invitation.id,
                          email: invitation.email,
                          roleName: roleLabel(invitation.roleKey, invitation.roleName),
                        })
                      }
                    >
                      {membersTh.cancelInvitation}
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {invitationStatus === "pending" && (
        <button type="button" className="underline" onClick={() => setInvitationStatus("all")}>
          {membersTh.showHistoricInvitations}
        </button>
      )}

      <section className="mt-6">
        <h2 className="text-heading-sm">{membersTh.membersSection(memberRows.length)}</h2>

        {members.isPending && (
          <div role="status" aria-label="กำลังโหลด">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        )}

        {members.isError && (
          <ErrorBanner
            message={membersTh.error}
            onRetry={() => void members.refetch()}
            retryLabel={errorsTh.retry}
          />
        )}

        <ul className="list-none p-0">
          {memberRows.map((member) => {
            // `isMe`/`isOwner` are decided SERVER-side (api-spec §3.7): the
            // list does not publish colleagues' capabilities, so the client
            // never recomputes "is this an Owner" from data it should not have.
            const actions = memberActionsFor({
              myCapabilities: org.capabilities,
              targetIsOwner: member.isOwner,
              isSelf: member.isMe,
              targetStatus: member.status,
            });
            return (
              <li
                key={member.userId}
                className={`rounded-card border border-border-default p-3 ${
                  member.status === "active" ? "" : "opacity-60"
                }`}
              >
                <span>{member.email}</span>
                {member.isMe && <span className="ml-1">{membersTh.you}</span>}{" "}
                <span className="text-body-sm">{roleLabel(member.roleKey, member.roleName)}</span>{" "}
                <span className="text-body-sm">
                  {member.status === "active" ? membersTh.statusActive : membersTh.statusRevoked}
                </span>

                {/* §7 — an Admin looking at an Owner gets the sentence, not a
                    disabled item, so they learn why rather than wonder. */}
                {actions.ownerOnlyNotice && (
                  <p className="text-body-sm opacity-70">{membersTh.ownerOnlyNotice}</p>
                )}
                {/* W-17 closed. These were `<span>`s: the actions §7 offers
                    were rendered as words, so every one of S9/S10 was
                    unreachable and the five mutation hooks W5 wrote had no
                    caller. A row of text that names what you may do and does
                    not do it is worse than no row at all. */}
                {actions.changeRole && (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setActing({
                        kind: "change-role",
                        userId: member.userId,
                        email: member.email,
                        roleId: member.roleId,
                        isOwner: member.isOwner,
                      })
                    }
                  >
                    {membersTh.changeRole}
                  </Button>
                )}
                {actions.removeFromOrg && (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setActing({ kind: "remove", userId: member.userId, email: member.email })
                    }
                  >
                    {membersTh.removeFromOrg}
                  </Button>
                )}
                {/* S10.3 entry (ข) — the same dialog S4's link opens (D-029). */}
                {actions.leaveOrg && (
                  <Button variant="secondary" onClick={() => setActing({ kind: "leave" })}>
                    {membersTh.leaveOrg}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>

        {memberStatus === "active" && (
          <button type="button" className="underline" onClick={() => setMemberStatus("all")}>
            {membersTh.showRevokedMembers}
          </button>
        )}
      </section>

      {inviting && (
        <InviteDialog
          ownerRoleIds={ownerRoleIds}
          onClose={() => setInviting(false)}
          onIssued={(issued) => {
            setInviting(false);
            setLink(openInviteLink(issued));
          }}
        />
      )}

      {acting?.kind === "change-role" && (
        <ChangeRoleDialog
          member={acting}
          ownerRoleIds={ownerRoleIds}
          onClose={() => setActing(null)}
        />
      )}

      {acting?.kind === "remove" && (
        <RemoveMemberDialog member={acting} onClose={() => setActing(null)} />
      )}

      {acting?.kind === "leave" && <LeaveOrgDialog onClose={() => setActing(null)} />}

      {link.status === "open" && (
        <CopyLinkPanel
          state={link}
          onStateChange={setLink}
          onClose={() => {
            setLink(closeInviteLink());
            void invitations.refetch();
          }}
        />
      )}

      {/* ★ T-002-Q7 · §9.2/§9.3. Both confirmations use the SAME dialog and
          both default focus to the harmless button — for `cancel` that is
          "ไม่ยกเลิก", worded so that reading only the buttons cannot pick the
          wrong one. Reissue is `default`, not `destructive`: nothing is
          destroyed, a link is replaced, and dressing every consequential action
          in red is how people stop reading red. */}
      {confirming !== null && (
        <ConfirmDialog
          open
          title={
            confirming.action === "reissue"
              ? invitationConfirmTh.reissue.title
              : invitationConfirmTh.cancelInvitation.title
          }
          body={
            confirming.action === "reissue"
              ? invitationConfirmTh.reissue.body(confirming.email, confirming.roleName)
              : invitationConfirmTh.cancelInvitation.body(confirming.email, confirming.roleName)
          }
          cancelLabel={
            confirming.action === "reissue"
              ? invitationConfirmTh.reissue.cancel
              : invitationConfirmTh.cancelInvitation.cancel
          }
          confirmLabel={
            confirming.action === "reissue"
              ? invitationConfirmTh.reissue.confirm
              : invitationConfirmTh.cancelInvitation.confirm
          }
          variant={confirming.action === "cancel" ? "destructive" : "default"}
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            const target = confirming;
            setConfirming(null);
            if (target.action === "reissue") {
              reissue.mutate(target.id, {
                onSuccess: (issued) => {
                  toast.success(invitationConfirmTh.reissue.doneToast);
                  setLink(
                    openInviteLink({
                      inviteUrl: issued.inviteUrl,
                      email: target.email,
                      expiresAt: issued.expiresAt,
                    }),
                  );
                },
                onError: (err) => toast.error(failureMessage(toApiFailure(err))),
              });
              return;
            }
            cancel.mutate(target.id, {
              onSuccess: () => toast.success(invitationConfirmTh.cancelInvitation.doneToast),
              onError: (err) => toast.error(failureMessage(toApiFailure(err))),
            });
          }}
        />
      )}

      {roles.isError && <ErrorBanner message={membersTh.error} />}
    </main>
  );
}
