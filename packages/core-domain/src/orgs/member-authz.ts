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
//
// F-003 · T-003-B05 (architecture §1 table · D-034): the rule itself moved to
// `rbac/member-authority.ts` (`decideMemberAuthority`, two axes). What is left
// here is a COMPAT WRAPPER for the F-002 call sites that still pass Owner-ness
// booleans; it has no logic of its own (U-RB-15) and is deleted in the PR that
// moves the last call site (B17/B18). Because it hands `decideMemberAuthority`
// only Owner-marker sets (`[full_access]` or `[]`), its answers are exactly
// F-002's — the D-034 target/grant axes take effect where a call site passes
// the real capability sets to `decideMemberAuthority` directly.

import { CAPABILITY_FULL_ACCESS } from "../auth/capabilities";
import { decideMemberAuthority } from "../rbac/member-authority";

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
 * May the actor perform this membership change? (F-002 semantics — compat.)
 *
 * - Anything that TOUCHES ownership — granting `full_access` to someone, or
 *   modifying/revoking/resetting someone who currently holds it — requires the
 *   actor to hold `full_access` themselves (`owner_only`).
 * - Everything else still requires `manage_members` — the floor of
 *   `decideMemberAuthority` (`full_access` grants it through expansion), so
 *   the mandatory matrix case ⑧ ("empty actorCapabilities → false in EVERY
 *   case", data-model §6) is literally true and a call site that forgets the
 *   guard fails closed.
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
  return decideMemberAuthority({
    op: "change_role",
    actorCapabilities,
    actorIsTarget: false,
    targetCurrentCapabilities: targetIsOwner ? [CAPABILITY_FULL_ACCESS] : [],
    grantCapabilities: newRoleIsOwner ? [CAPABILITY_FULL_ACCESS] : [],
  }).ok;
}
