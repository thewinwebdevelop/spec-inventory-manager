// F-002 · T-002-08 — "an org always keeps ≥ 1 active Owner" (pure fn, golden rule #6).
// architecture §5 (US-6) · data-model §3.1 / §6.
//
// The DB cannot express this invariant: it is a cross-row aggregate
// (COUNT(active owners) ≥ 1), so no unique index or CHECK can hold it. The
// runtime protection is `SELECT … FOR UPDATE` on the Organization row plus THIS
// decision function, evaluated on rows read through the SAME `tx` (M-2).
//
// Every operation that can shrink ownership funnels through this one function —
// PATCH member role, DELETE member, and leaving on your own (D-029). There is
// deliberately no second rule for `leave`: leaving is a revoke whose target is
// the actor, so it must be decided by the same code (test-plan U-CD-01 ⑨).

import { isOwnerRole } from "./member-authz";

/** Membership lifecycle states (F-000 schema). Only `active` counts as an owner. */
export type MembershipStatus = "active" | "invited" | "revoked";

export interface OwnerMembership {
  readonly userId: string;
  /**
   * The role this membership CURRENTLY holds. Required (F-003 · T-003-B07):
   * shapes 3/4 find the memberships a role edit/delete reaches by this id —
   * a row without it would silently fall outside the change (U-OI-12).
   */
  readonly roleId: string;
  readonly status: MembershipStatus;
  /** Capabilities of the role this membership CURRENTLY holds. */
  readonly capabilities: readonly string[];
}

/**
 * The change being attempted.
 * - `role_change` — PATCH /orgs/{orgId}/members/{userId}
 * - `revoke` — DELETE /orgs/{orgId}/members/{userId} and DELETE /orgs/{orgId}/membership (leave, D-029)
 * - `role_capabilities_change` — PATCH /orgs/{orgId}/roles/{roleId} (F-003 · architecture §2 shape 3):
 *   every membership holding `roleId` is evaluated with `newCapabilities`
 * - `role_delete` — DELETE /orgs/{orgId}/roles/{roleId} (soft, shape 4): every membership
 *   holding `roleId` stops counting as an Owner
 *
 * Shapes 3/4 change NO membership row — the org can still lose its last Owner,
 * which is why they need their own shapes (forward-commitment L283).
 */
export type OwnerChange =
  | {
      readonly kind: "role_change";
      readonly userId: string;
      readonly newRoleCapabilities: readonly string[];
    }
  | { readonly kind: "revoke"; readonly userId: string }
  | {
      readonly kind: "role_capabilities_change";
      readonly roleId: string;
      readonly newCapabilities: readonly string[];
    }
  | { readonly kind: "role_delete"; readonly roleId: string };

export interface OwnerInvariantInput {
  /**
   * Every membership of the org whose CURRENT role holds `full_access`,
   * in ANY status — read through the `tx` that holds the org lock.
   * For shapes 3/4 it must ALSO contain every membership of `change.roleId`
   * (architecture §2 "input contract") — an omitted holder is invisible to
   * the decision.
   * Passing extra non-owner rows is harmless (they are filtered out), but
   * omitting an active owner is not: the caller must not pre-filter by status.
   *
   * The change target may be absent from this list; that means "an active
   * member who is not an owner today" (the service only ever issues these
   * changes against `active` memberships — architecture §5.1 re-validates
   * status inside the tx).
   */
  readonly owners: readonly OwnerMembership[];
  readonly change: OwnerChange;
}

/** Thrown when a change would leave the org with zero active Owners → `409 LAST_OWNER`. */
export class LastOwnerError extends Error {
  readonly code = "LAST_OWNER";

  constructor(message = "This change would leave the organization without an active Owner") {
    super(message);
    this.name = "LastOwnerError";
  }
}

/**
 * The user ids that would still be ACTIVE Owners after applying `change`.
 * Order follows the input; duplicates are collapsed. Pure — no input mutation.
 */
export function activeOwnersAfter({ owners, change }: OwnerInvariantInput): readonly string[] {
  const remaining: string[] = [];
  const seen = new Set<string>();
  const isUserChange = change.kind === "role_change" || change.kind === "revoke";
  const targetIsKnownOwnerRow = isUserChange && owners.some((m) => m.userId === change.userId);

  for (const membership of owners) {
    if (membership.status !== "active") continue; // revoked / invited are not owners
    const capabilitiesAfter = capabilitiesAfterChange(membership, change);
    if (capabilitiesAfter === null) continue; // loses the membership / the role
    if (!isOwnerRole(capabilitiesAfter)) continue; // capability, never name/key
    if (seen.has(membership.userId)) continue;
    seen.add(membership.userId);
    remaining.push(membership.userId);
  }

  // Promoting someone who is not an owner today. A role change never
  // reactivates a membership, so a target that IS in the list but not `active`
  // (handled above) stays out.
  if (
    change.kind === "role_change" &&
    !targetIsKnownOwnerRow &&
    isOwnerRole(change.newRoleCapabilities) &&
    !seen.has(change.userId)
  ) {
    remaining.push(change.userId);
  }

  return remaining;
}

/**
 * The capabilities `membership` holds once `change` is applied, or `null` when
 * it no longer holds any role in the org (revoked / its role deleted).
 * Shapes 1/2 match by `userId`; shapes 3/4 by `roleId` — a userId-shaped change
 * never reaches a role-mate, a role-shaped change reaches every holder.
 */
function capabilitiesAfterChange(
  membership: OwnerMembership,
  change: OwnerChange,
): readonly string[] | null {
  switch (change.kind) {
    case "role_change":
      // F-002 behaviour kept byte-for-byte (U-OI-11): a target row that is not
      // an Owner today is not promoted by this loop — only demotion is read here.
      return membership.userId === change.userId && isOwnerRole(membership.capabilities)
        ? change.newRoleCapabilities
        : membership.capabilities;
    case "revoke":
      return membership.userId === change.userId ? null : membership.capabilities;
    case "role_capabilities_change":
      return membership.roleId === change.roleId ? change.newCapabilities : membership.capabilities;
    case "role_delete":
      return membership.roleId === change.roleId ? null : membership.capabilities;
    default: {
      // Fail loud: an unknown shape must not be read as "changes nothing".
      const unknown: never = change;
      throw new Error(`activeOwnersAfter: unknown change ${JSON.stringify(unknown)}`);
    }
  }
}

/**
 * Fail-closed guard: throws `LastOwnerError` when the change would leave zero
 * active Owners. Assertion (not a boolean) on purpose — a forgotten `if` on a
 * returned boolean is exactly the "forget it and nothing breaks, but it leaks"
 * failure mode architecture §3.1 bans; a throw cannot be forgotten, and it
 * rolls the surrounding transaction back for free.
 *
 * Note it also throws when the org ALREADY has zero active owners: that state
 * is impossible by construction, and if it ever happens, refusing further
 * membership writes is the safe direction.
 */
export function assertOwnerRemains(input: OwnerInvariantInput): void {
  if (activeOwnersAfter(input).length === 0) {
    throw new LastOwnerError();
  }
}
