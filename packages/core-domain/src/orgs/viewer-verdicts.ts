// F-003 · T-003-B22 ★ — the viewer verdicts on routes F-002 shipped
// (api-spec §3.1, §4.1–§4.2b · architecture §1.2 · AC-2.2/5.2/6.4).
//
// A verdict is a UX input ("enable the button? why not?"), never enforcement —
// but it must be the SAME answer the write would give, or the client ends up
// inventing permissions. So every verdict here is `decideMemberAuthority`
// called exactly the way the write route calls it, plus a reason mapping. No
// subset logic lives in this file (gate G3-05).
//
// WHO SEES WHAT (architecture §1.2): a viewer with `manage_members` but not
// `manage_roles` already learns `role ⊆ me` from `viewerCanAssign`. Giving that
// viewer the member-row (⊊) verdict too would leak "this role equals mine
// exactly" = its capabilities. So member-row verdicts go only to viewers that
// hold BOTH (they can read every role's capabilities anyway).
import { CAPABILITY_MANAGE_MEMBERS } from "../auth/capabilities";
import { hasCapability } from "../rbac/expand";
import { decideMemberAuthority, type MemberAuthorityResult } from "../rbac/member-authority";
import { CAPABILITY_MANAGE_ROLES } from "../rbac/registry";

/** api-spec §4.1 — the AC-1.5 display bit: `key === null || Role.nameCustomized`. */
export function isRoleNameCustomized(role: {
  readonly key: string | null;
  readonly nameCustomized: boolean;
}): boolean {
  return role.key === null || role.nameCustomized;
}

export interface ViewerVerdictAudience {
  /** `RoleRow.viewerCanAssign` / `assignBlockedReason` — holder of `manage_members`. */
  readonly assign: boolean;
  /** `MemberRow.viewerCanManage` / `viewerCanResetPassword` — `manage_members` ∧ `manage_roles`. */
  readonly memberRows: boolean;
  /** `Invitation.viewerCanManage` — holder of `manage_members`. */
  readonly invitations: boolean;
}

/** Which verdict fields this viewer receives. Expanded (`full_access` holds both). */
export function viewerVerdictAudience(
  viewerCapabilities: readonly string[],
): ViewerVerdictAudience {
  const mm = hasCapability(viewerCapabilities, CAPABILITY_MANAGE_MEMBERS);
  const mr = hasCapability(viewerCapabilities, CAPABILITY_MANAGE_ROLES);
  return { assign: mm, memberRows: mm && mr, invitations: mm };
}

export type GrantBlockedReason = "owner_only" | "exceeds_your_permissions";

export interface GrantVerdict {
  readonly allowed: boolean;
  /** `null` when allowed. Open set on the wire. */
  readonly reason: GrantBlockedReason | null;
}

function grantVerdict(result: MemberAuthorityResult, what: string): GrantVerdict {
  if (result.ok) return { allowed: true, reason: null };
  switch (result.reason) {
    case "owner_only":
      return { allowed: false, reason: "owner_only" };
    case "exceeds_actor":
      return { allowed: false, reason: "exceeds_your_permissions" };
    default:
      // `forbidden` = viewer lacks manage_members: the audience rule was skipped.
      // `target_not_below_actor` cannot come from a grant-only op.
      throw new Error(
        `${what}: unexpected ${result.reason} — apply viewerVerdictAudience first (manage_members)`,
      );
  }
}

/**
 * `RoleRow.viewerCanAssign` — may this viewer hand out this role? Grant axis
 * (⊆), as invite create/reissue and the grant half of PATCH member judge it.
 */
export function decideRoleAssignVisible(
  viewerCapabilities: readonly string[],
  roleCapabilities: readonly string[],
): GrantVerdict {
  return grantVerdict(
    decideMemberAuthority({
      op: "invite_create",
      actorCapabilities: viewerCapabilities,
      actorIsTarget: false,
      grantCapabilities: roleCapabilities,
    }),
    "decideRoleAssignVisible",
  );
}

/**
 * `Invitation.viewerCanManage` — cancel / reissue this pending invitation.
 * `invite_cancel` (⊆, D-034 unchanged): same information as `viewerCanAssign`
 * for the same role, so no new bit leaks (api-spec §3.1).
 */
export function decideInvitationManageVisible(
  viewerCapabilities: readonly string[],
  invitationRoleCapabilities: readonly string[],
): GrantVerdict {
  return grantVerdict(
    decideMemberAuthority({
      op: "invite_cancel",
      actorCapabilities: viewerCapabilities,
      actorIsTarget: false,
      grantCapabilities: invitationRoleCapabilities,
    }),
    "decideInvitationManageVisible",
  );
}

export type MemberManageVisibleVerdict =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: "owner_only" | "equal_permissions" | "exceeds_your_permissions";
    };

/**
 * `MemberRow.viewerCanManage` — "may I change this person's role / remove
 * them?". Target axis only (api-spec §3.1(3)): `change_role` with the grant set
 * to the role the member ALREADY holds — the PATCH-to-same-role request, which
 * the route evaluates in full (SR-19, no short-circuit). That grant can never
 * be the refusing axis (target ⊊ viewer ⇒ target ⊆ viewer; own row ⇒ own ⊆
 * own), so the answer is the target axis alone — and equal to `remove`'s.
 * Own row ⇒ `ok` (self-exempt, D-029); `LAST_OWNER` is shop state, not a verdict.
 */
export function decideMemberManageVisible(
  viewer: { readonly userId: string; readonly capabilities: readonly string[] },
  row: { readonly userId: string; readonly capabilities: readonly string[] },
): MemberManageVisibleVerdict {
  const result = decideMemberAuthority({
    op: "change_role",
    actorCapabilities: viewer.capabilities,
    actorIsTarget: viewer.userId === row.userId,
    targetCurrentCapabilities: row.capabilities,
    grantCapabilities: row.capabilities,
  });
  if (result.ok) return { ok: true };
  switch (result.reason) {
    case "owner_only":
      return { ok: false, reason: "owner_only" };
    case "target_not_below_actor":
      return {
        ok: false,
        reason: result.relation === "equal" ? "equal_permissions" : "exceeds_your_permissions",
      };
    default:
      throw new Error(
        `decideMemberManageVisible: unexpected ${result.reason} — apply viewerVerdictAudience first (manage_members)`,
      );
  }
}
