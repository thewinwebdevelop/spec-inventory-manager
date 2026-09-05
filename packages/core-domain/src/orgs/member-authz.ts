// F-002 · T-002-08 — Owner-only authorization (pure fn, golden rule #6).
// architecture §3.2 (C-1 / D-028) · data-model §6.
//
// The hole this closes: `manage_members` (= Admin) used to be enough to change
// anyone's role to anything, so an Admin could promote themselves to Owner and
// revoke the real owner — unrecoverable in Phase 0 (back-office is F-085).
// The same result was reachable sideways: invite your own email with the Owner
// role, then accept it.
//
// Call sites (architecture §3.2 table — 5 after amend #4): PATCH members ·
// DELETE members · create invitation · reissue invitation link (NEW-2) ·
// admin-reset password (NEW-1/D-030). All of them feed this ONE function; none
// of them re-implements the rule.

import {
  CAPABILITY_FULL_ACCESS,
  CAPABILITY_MANAGE_MEMBERS,
  hasCapability,
} from "../auth/capabilities";

export interface CanAssignRoleInput {
  /** Capabilities of the role the CALLER currently holds in this org. */
  readonly actorCapabilities: readonly string[];
  /** Does the target's CURRENT role hold `full_access`? (revoke/patch/reset) */
  readonly targetIsOwner: boolean;
  /** Does the role being granted/invited hold `full_access`? */
  readonly newRoleIsOwner: boolean;
}

/**
 * "This role is an Owner" == its capability list holds `full_access`
 * (data-model §5.2). Never compare `role.name` or `role.key`: F-003 lets users
 * rename roles and create custom ones, so a name/key comparison would silently
 * stop protecting a custom role that holds `full_access`.
 */
export function isOwnerRole(capabilities: readonly string[]): boolean {
  return capabilities.includes(CAPABILITY_FULL_ACCESS);
}

/**
 * May the actor perform this membership change?
 *
 * - Anything that TOUCHES ownership — granting `full_access` to someone, or
 *   modifying/revoking/resetting someone who currently holds it — requires the
 *   actor to hold `full_access` themselves.
 * - Everything else still requires `manage_members` (which `full_access`
 *   implies via `hasCapability`). architecture §3.2 states the rule as
 *   `(!targetIsOwner && !newRoleIsOwner) || full_access`; we additionally keep
 *   the `manage_members` floor so the mandatory matrix case ⑧ ("empty
 *   actorCapabilities → false in EVERY case", data-model §6) is literally true.
 *   This is strictly stricter than the architecture formula and never more
 *   permissive: every real call site already sits behind
 *   `@RequireCapability(manage_members)` (architecture §3.1), so no legitimate
 *   caller loses anything — but a future call site that forgets the guard fails
 *   closed here instead of silently allowing the change.
 *
 * Returning a boolean (not throwing) is deliberate: the call sites map it to
 * different wire results — `403 FORBIDDEN` for member/invitation routes, but
 * `404 NOT_FOUND` for the F-001 admin-reset route which must keep its
 * 404-never-403 shape (architecture §3.3).
 */
export function canAssignRole({
  actorCapabilities,
  targetIsOwner,
  newRoleIsOwner,
}: CanAssignRoleInput): boolean {
  if (targetIsOwner || newRoleIsOwner) {
    return hasCapability(actorCapabilities, CAPABILITY_FULL_ACCESS);
  }
  return hasCapability(actorCapabilities, CAPABILITY_MANAGE_MEMBERS);
}
