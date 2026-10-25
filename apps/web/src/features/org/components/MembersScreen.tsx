"use client";

/**
 * S6 — สมาชิก (ux-wireframe §7). One screen, two sections: outstanding
 * invitations on top because they are unfinished work, members below.
 *
 * Every action offered here comes from `memberActionsFor` /
 * `invitationActionsFor`. ★ T-003-W10 (R7): when the row carries the server's
 * verdict (`viewerCanManage`) that verdict is the whole answer, both ways; the
 * F-002 rules apply only when the field is absent. Hiding an action is UX; the
 * server refuses regardless, and each hidden action still has an error path.
 *
 * R6: `?roleId=<id>` narrows both lists to one role — the way out of R5's
 * `ROLE_IN_USE` — so its counts match what R5 quoted (active members +
 * pending/expired invitations, AC-3.9).
 */
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMembers, useInvitations, useRoles } from "../api/use-members";
import { useCancelInvitation, useReissueInvitationLink } from "../api/use-member-mutations";
import {
  invitationActionsFor,
  isOwner,
  memberActionsFor,
  reinviteRoleIdFor,
} from "../member-actions";
import {
  displayRoleName,
  invitationManageBlockedReasonCopy,
  memberActionErrorMessage,
  memberManageBlockedReasonCopy,
  memberRateLimitedMessage,
} from "../role-copy";
import { closeInviteLink, openInviteLink, type InviteLinkState } from "../invite-link";
import { INVITE_LINK_CLOSED } from "../invite-link";
import { formatExpiry, invitationStatusLabel, isInvitationLinkLive } from "../expiry";
import { invitationConfirmTh, membersTh, roleFilterTh, roleLabel } from "../i18n";
import { errorsTh } from "../../../i18n/errors";
import { useActiveOrg, useCan } from "../../../lib/org/org-context";
import { CAPABILITY_MANAGE_ROLES } from "../../../lib/org/capability";
import { toApiFailure, failureMessage } from "../../../lib/api/error";
import { useToast } from "../../../components/providers/ToastProvider";
import { Button } from "../../../components/ui/Button";
import { SectionCard } from "../../../components/ui/SectionCard";
import { ListRow, Avatar } from "../../../components/ui/ListRow";
import { Badge } from "../../../components/ui/Badge";
import { Banner } from "../../../components/ui/Banner";
import { Icon } from "../../../components/ui/Icon";
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
  const router = useRouter();
  const canManageRoles = useCan(CAPABILITY_MANAGE_ROLES);
  /** R6 — empty string counts as "no filter", same as absent. */
  const roleFilter = useSearchParams().get("roleId") || undefined;
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
  const [confirming, setConfirming] = useState<{
    action: "reissue" | "cancel";
    id: string;
    email: string;
    roleName: string;
  } | null>(null);
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
  /**
   * §7's "เชิญใหม่อีกครั้ง" — the row's email always carries over; the role
   * carries over too UNLESS the row was an Owner invitation and the presser
   * is not an Owner, in which case `roleId` stays `undefined` so S7 opens with
   * no option pre-filled (⛔ never pre-fill a choice that cannot be submitted).
   */
  const [reinviting, setReinviting] = useState<{
    email: string;
    roleId?: string;
    /** Set when the original role is closed to the viewer (R8 helper line). */
    blockedRoleName?: string;
  } | null>(null);

  // R6: the filtered view is a fixed question (active members + every
  // invitation, narrowed below to the still-open ones), not the F-002 toggles.
  const members = useMembers(roleFilter ? "active" : memberStatus, roleFilter);
  const invitations = useInvitations(roleFilter ? "open" : invitationStatus, roleFilter);
  // ★ fix r1 (security review M-1) — R6's empty claims need the WHOLE list:
  // loaded, and no page left unread.
  const membersComplete = members.isSuccess && members.data.nextCursor === null;
  const invitationsComplete = invitations.isSuccess && invitations.data.nextCursor === null;
  const roles = useRoles();
  const reissue = useReissueInvitationLink();
  const cancel = useCancelInvitation();

  /**
   * Which role ids grant ownership — from the SERVER's answer, never from
   * `key === "owner"`.
   *
   * ★ B-9. `GET /orgs/{orgId}/roles` still does not publish `capabilities`
   * (§3.6, and rightly), but it now publishes one derived bit per role:
   * `grantsOwnership`. Before that, this set could only ever contain the
   * caller's OWN role — so for an Admin it was empty, §10.1's "show the Owner
   * option disabled, with the reason" was unimplementable, and S7's filter
   * filtered nothing.
   *
   * The viewer's own role stays in the set as a FALLBACK, for a client newer
   * than its server: `grantsOwnership` is optional in the contract precisely so
   * that case parses, and absent means "this server does not say" rather than
   * "no role grants ownership".
   */
  const ownerRoleIds = useMemo(() => {
    const ids = new Set<string>();
    for (const role of roles.data?.items ?? []) {
      if (role.grantsOwnership === true) ids.add(role.id);
    }
    if (isOwner(org.capabilities) && org.profile.myMembership.roleId) {
      ids.add(org.profile.myMembership.roleId);
    }
    return ids;
  }, [roles.data?.items, org.capabilities, org.profile.myMembership.roleId]);

  const pending = (invitations.data?.items ?? []).filter(
    // AC-3.9 — "ยังไม่ปิด" = pending + expired, the number R5 quoted.
    (i) => !roleFilter || i.status === "pending" || i.status === "expired",
  );
  const memberRows = members.data?.items ?? [];

  const filterRole = roleFilter ? roles.data?.items.find((r) => r.id === roleFilter) : undefined;
  const filterRoleName = filterRole
    ? displayRoleName({
        name: filterRole.name,
        roleKey: filterRole.key,
        nameCustomized: filterRole.nameCustomized,
      })
    : undefined;
  const backToRole =
    roleFilter && canManageRoles && filterRoleName ? (
      <Button
        variant="secondary"
        size="sm"
        onClick={() => router.push(`/o/${org.orgId}/settings/roles/${roleFilter}`)}
      >
        {roleFilterTh.backToRole(filterRoleName)}
      </Button>
    ) : null;
  const nobodyLeft =
    roleFilter !== undefined &&
    membersComplete &&
    invitationsComplete &&
    memberRows.length === 0 &&
    pending.length === 0;

  /**
   * R7 · §E — a refused cancel/reissue. The two codes F-003 made reachable get
   * their own sentence and a refetch (the verdict on the row is now stale);
   * everything else keeps the F-002 generic mapping.
   */
  const onInvitationError = (err: unknown, context: "reissue" | "cancel") => {
    const failure = toApiFailure(err);
    if (failure.kind === "throttled") {
      toast.error(memberRateLimitedMessage(failure.retryAfterSeconds ?? 60));
      return;
    }
    if (
      failure.kind === "forbidden" &&
      (failure.code === "ROLE_EXCEEDS_ACTOR" ||
        (failure.code === "FORBIDDEN" && context === "cancel"))
    ) {
      toast.error(memberActionErrorMessage(failure.code, context));
      void invitations.refetch();
      return;
    }
    toast.error(failureMessage(failure));
  };

  return (
    <main className="flex flex-col gap-4 p-card-padding">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="m-0 text-heading-md">{membersTh.title}</h1>
        <Button onClick={() => setInviting(true)}>{membersTh.invite}</Button>
      </div>

      {roleFilter && (
        <Banner
          tone="info"
          icon={<Icon role="info" size="sm" />}
          actions={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.replace(`/o/${org.orgId}/settings/members`)}
              >
                {roleFilterTh.showAll}
              </Button>
              {backToRole}
            </>
          }
        >
          {filterRoleName ? roleFilterTh.banner(filterRoleName) : roleFilterTh.bannerUnknownRole}
        </Banner>
      )}
      {nobodyLeft && (
        <Banner tone="success" actions={backToRole}>
          {roleFilterTh.nobodyLeft}
        </Banner>
      )}

      {/* §7: the section disappears when there is nothing OUTSTANDING — an
          empty "0 invitations" heading is clutter. But once the filter has
          been widened on purpose, hiding it is how the screen used to answer
          a deliberate question with a blank page. */}
      {(pending.length > 0 || roleFilter) && (
        <SectionCard
          title={
            roleFilter
              ? roleFilterTh.invitationsSection(pending.length)
              : invitationStatus === "all"
                ? membersTh.allInvitationsSection(pending.length)
                : membersTh.pendingSection(pending.length)
          }
          /* `p-0` so the rows reach the card's edges the way the mockup draws
             them; the header and any non-row children pay their own padding. */
          className="p-0 [&>div:first-child]:px-4 [&>div:first-child]:pt-4"
        >
          {roleFilter && invitations.isError && (
            <div className="p-4">
              <ErrorBanner
                message={membersTh.error}
                onRetry={() => void invitations.refetch()}
                retryLabel={errorsTh.retry}
              />
            </div>
          )}
          {roleFilter && invitationsComplete && pending.length === 0 && (
            <p className="m-0 px-4 pb-4 text-body-sm text-text-muted">
              {roleFilterTh.emptyInvitations}
            </p>
          )}
          <ul className="m-0 list-none p-0">
            {pending.map((invitation) => {
              const actions = invitationActionsFor(invitation);
              const expiry = isInvitationLinkLive(invitation)
                ? formatExpiry(invitation.expiresAt)
                : undefined;
              return (
                <li key={invitation.id}>
                  <ListRow
                    avatar={<Avatar>{invitation.email.trim().charAt(0).toUpperCase()}</Avatar>}
                    main={
                      <>
                        <span className="truncate">{invitation.email}</span>
                        <Badge tone="neutral">
                          {roleLabel(invitation.roleKey, invitation.roleName)}
                        </Badge>
                        {/* ★ B-15 — ux-wireframe §7: `รอตอบรับ · หมดอายุแล้ว ·
                          ยกเลิกแล้ว · รับแล้วเมื่อ {วันเวลา}`. Without it the
                          only thing separating a cancelled row from a live one
                          was the ABSENCE of two buttons. */}
                        <Badge tone={isInvitationLinkLive(invitation) ? "success" : "neutral"}>
                          {invitationStatusLabel(invitation)}
                        </Badge>
                        {/* D-028/I-7 — a soft flag, never an accusation. */}
                        {invitation.acceptedUserCreatedAfterInvite === true && (
                          <Badge tone="warning">
                            <span role="note">{membersTh.acceptedAfterInviteFlag}</span>
                          </Badge>
                        )}
                      </>
                    }
                    /* ⛔ ONLY while the link would still work. This line used
                     to render for every row, so a dead invitation advertised
                     an expiry days in the future — see `expiry.ts`. */
                    sub={
                      actions.serverBlock ? (
                        <>
                          {expiry}
                          <span className="flex items-center gap-1">
                            <Icon role="lock" size="sm" />
                            {invitationManageBlockedReasonCopy(actions.serverBlock.reason)}
                          </span>
                        </>
                      ) : (
                        expiry
                      )
                    }
                    right={
                      <>
                        {actions.reissue && (
                          <Button
                            variant="secondary"
                            size="sm"
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
                        )}
                        {actions.cancel && (
                          <Button
                            variant="secondary"
                            size="sm"
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
                        )}
                        {/* §7's table: expired/cancelled ONLY — never `accepted`,
                          where that person is already in the shop and "invite
                          again" would be a lie. */}
                        {actions.inviteAgain && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              // ⛔ Never pre-fill a role the presser cannot submit
                              // (R7): `viewerCanAssign` decides; absent ⇒ F-002's
                              // Owner-role rule.
                              const roleId = reinviteRoleIdFor(
                                invitation.roleId,
                                roles.data?.items ?? [],
                                () =>
                                  !(
                                    ownerRoleIds.has(invitation.roleId) &&
                                    !isOwner(org.capabilities)
                                  ),
                              );
                              setReinviting({
                                email: invitation.email,
                                roleId,
                                // R8: say which role was withheld, and why the choice is empty.
                                blockedRoleName:
                                  roleId === undefined
                                    ? displayRoleName({
                                        name: invitation.roleName,
                                        roleKey: invitation.roleKey,
                                        nameCustomized: invitation.roleNameCustomized,
                                      })
                                    : undefined,
                              });
                            }}
                          >
                            {membersTh.inviteAgain}
                          </Button>
                        )}
                      </>
                    }
                  />
                </li>
              );
            })}
          </ul>
        </SectionCard>
      )}

      {/* ★ A TOGGLE, both ways. This used to render only while the filter was
          `pending`, so pressing it removed the only control that could undo
          it — and with no expired or cancelled invitations to reveal, the
          section stayed hidden too and the press appeared to do nothing at
          all. Reported from the running app, 2026-09-01. */}
      {!roleFilter && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="tertiary"
            onClick={() => setInvitationStatus(invitationStatus === "pending" ? "all" : "pending")}
          >
            {invitationStatus === "pending"
              ? membersTh.showHistoricInvitations
              : membersTh.showPendingInvitationsOnly}
          </Button>
          {invitationStatus === "all" && pending.length === 0 && !invitations.isPending && (
            <span className="text-body-sm text-text-muted">
              {membersTh.emptyHistoricInvitations}
            </span>
          )}
        </div>
      )}

      <SectionCard
        title={
          roleFilter
            ? roleFilterTh.membersSection(memberRows.length)
            : memberStatus === "all"
              ? membersTh.allMembersSection(memberRows.length)
              : membersTh.membersSection(memberRows.length)
        }
        className="p-0 [&>div:first-child]:px-4 [&>div:first-child]:pt-4"
      >
        {members.isPending && (
          <div role="status" aria-label="กำลังโหลด" className="p-4">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        )}

        {members.isError && (
          <div className="p-4">
            <ErrorBanner
              message={membersTh.error}
              onRetry={() => void members.refetch()}
              retryLabel={errorsTh.retry}
            />
          </div>
        )}

        {roleFilter && membersComplete && memberRows.length === 0 && (
          <p className="m-0 px-4 pb-4 text-body-sm text-text-muted">{roleFilterTh.emptyMembers}</p>
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
              verdict: {
                viewerCanManage: member.viewerCanManage,
                manageBlockedReason: member.manageBlockedReason,
              },
            });
            return (
              <li key={member.userId}>
                <ListRow
                  dimmed={member.status !== "active"}
                  avatar={<Avatar>{member.email.trim().charAt(0).toUpperCase()}</Avatar>}
                  main={
                    <>
                      <span className="truncate">{member.email}</span>
                      {member.isMe && <Badge tone="current">{membersTh.you}</Badge>}
                      <Badge tone="neutral">{roleLabel(member.roleKey, member.roleName)}</Badge>
                      <Badge tone={member.status === "active" ? "success" : "neutral"}>
                        {member.status === "active"
                          ? membersTh.statusActive
                          : membersTh.statusRevoked}
                      </Badge>
                    </>
                  }
                  /* §7 — an Admin looking at an Owner gets the sentence, not a
                     disabled item, so they learn why rather than wonder. */
                  sub={
                    actions.serverBlock ? (
                      <span className="flex items-center gap-1">
                        <Icon role="lock" size="sm" />
                        {memberManageBlockedReasonCopy(actions.serverBlock.reason)}
                      </span>
                    ) : actions.ownerOnlyNotice ? (
                      membersTh.ownerOnlyNotice
                    ) : undefined
                  }
                  right={
                    <>
                      {/* W-17 closed. These were `<span>`s: the actions §7 offers
                    were rendered as words, so every one of S9/S10 was
                    unreachable and the five mutation hooks W5 wrote had no
                    caller. A row of text that names what you may do and does
                    not do it is worse than no row at all. */}
                      {actions.changeRole && (
                        <Button
                          variant="secondary"
                          size="sm"
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
                          size="sm"
                          onClick={() =>
                            setActing({
                              kind: "remove",
                              userId: member.userId,
                              email: member.email,
                            })
                          }
                        >
                          {membersTh.removeFromOrg}
                        </Button>
                      )}
                      {/* S10.3 entry (ข) — the same dialog S4's link opens (D-029). */}
                      {actions.leaveOrg && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setActing({ kind: "leave" })}
                        >
                          {membersTh.leaveOrg}
                        </Button>
                      )}
                    </>
                  }
                />
              </li>
            );
          })}
        </ul>
      </SectionCard>

      {!roleFilter && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="tertiary"
            onClick={() => setMemberStatus(memberStatus === "active" ? "all" : "active")}
          >
            {memberStatus === "active"
              ? membersTh.showRevokedMembers
              : membersTh.showActiveMembersOnly}
          </Button>
          {memberStatus === "all" &&
            !members.isPending &&
            memberRows.every((m) => m.status === "active") && (
              <span className="text-body-sm text-text-muted">{membersTh.emptyRevokedMembers}</span>
            )}
        </div>
      )}

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

      {/* §7's "เชิญใหม่อีกครั้ง" — same S7, pre-filled from the expired/
          cancelled row that opened it. A stale row (already a member, or a
          fresh invitation already pending) is not checked here: the server
          refuses with `ALREADY_MEMBER`/`INVITATION_PENDING`, and S7 already
          carries copy for both (`inviteFormTh.error`). */}
      {reinviting && (
        <InviteDialog
          ownerRoleIds={ownerRoleIds}
          defaultEmail={reinviting.email}
          defaultRoleId={reinviting.roleId}
          blockedOriginalRoleName={reinviting.blockedRoleName}
          onClose={() => setReinviting(null)}
          onIssued={(issued) => {
            setReinviting(null);
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

      {acting?.kind === "leave" && (
        <LeaveOrgDialog origin="members" onClose={() => setActing(null)} />
      )}

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
                onError: (err) => onInvitationError(err, "reissue"),
              });
              return;
            }
            cancel.mutate(target.id, {
              onSuccess: () => toast.success(invitationConfirmTh.cancelInvitation.doneToast),
              onError: (err) => onInvitationError(err, "cancel"),
            });
          }}
        />
      )}

      {roles.isError && <ErrorBanner message={membersTh.error} />}
    </main>
  );
}
