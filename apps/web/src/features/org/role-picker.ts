/**
 * T-003-W11 · R8 — the single verdict behind every role option in
 * `InviteDialog` and `ChangeRoleDialog`.
 *
 * `RoleRow.viewerCanAssign` / `assignBlockedReason` are the server's answer and
 * the ONLY input when present (both directions). The client never derives
 * assignability from a role key or from capabilities it cannot see. Absent
 * (viewer lacks `manage_members`, or an older server) => the F-002 rule: an
 * ownership-granting role is closed unless the viewer is an Owner.
 */
import { assignBlockedReasonCopy } from "./role-copy";
import { isOwner } from "./member-actions";

export interface RoleOptionState {
  readonly closed: boolean;
  /** Thai copy shown under a closed option; `undefined` when open. */
  readonly reason: string | undefined;
}

export function roleOptionState(
  role: {
    readonly id: string;
    readonly viewerCanAssign?: boolean;
    readonly assignBlockedReason?: string | null;
  },
  myCapabilities: ReadonlySet<string>,
  ownerRoleIds: ReadonlySet<string>,
): RoleOptionState {
  if (typeof role.viewerCanAssign === "boolean") {
    return role.viewerCanAssign
      ? { closed: false, reason: undefined }
      : { closed: true, reason: assignBlockedReasonCopy(role.assignBlockedReason) };
  }
  const closed = ownerRoleIds.has(role.id) && !isOwner(myCapabilities);
  return { closed, reason: closed ? assignBlockedReasonCopy("owner_only") : undefined };
}
