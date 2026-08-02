// F-002 · T-002-09 ★ — "may this admin reset this member's password?" (pure fn,
// golden rule #6). architecture §3.3 · §15 row 1 · security-review C-2 / NEW-1 ·
// D-028 / D-030. Tests: admin-reset-authz.test.ts (U-API-07 matrix, decision
// layer) + apps/api/src/auth/auth.service.test.ts (the transaction around it).
//
// WHY THIS FILE EXISTS
// `POST /orgs/{orgId}/members/{userId}/reset-password` shipped in F-001 and was
// CORRECT while a person could belong to exactly one organization. F-002 makes
// one person a member of many organizations, and `User.passwordHash` is a
// GLOBAL credential — so the same untouched code became two account-takeover
// paths:
//
//   C-2  (cross-tenant)  Admin of org B resets the password of a member who is
//                        also the Owner of org A, then logs in as them.
//   NEW-1 (same org)     the C-2 filter is INERT in the most common dogfood
//                        case — an Owner who belongs to ONE org has no "other
//                        org" to trip it — so an Admin can still take over the
//                        shop owner's account with one request, walking around
//                        the whole Owner-only rule (`canAssignRole`) because
//                        this route goes through the CREDENTIAL, not the role.
//
// The decision is pure and lives here (not in the service) for two reasons: the
// rule is the same `canAssignRole` the membership routes use — there must not be
// a second, subtly different copy of "who may touch an Owner" — and the matrix
// of 8 cases has to be testable without a database.
//
// WHAT THIS FUNCTION DOES NOT DECIDE: the wire result. Every refusal here maps
// to the SAME 404 the route already returned for "not a member" (404-never-403,
// architecture §3.3). A caller must not be able to tell "blocked" from "not
// found"; a distinguishable refusal would be a fresh oracle answering "is this
// person the Owner?".

import { CAPABILITY_MANAGE_MEMBERS, hasCapability } from "../auth/capabilities";
import { canAssignRole, isOwnerRole } from "./member-authz";
import type { MembershipStatus } from "./owner-invariant";

/**
 * Why a reset was refused. NOT a wire value — the response is always the same
 * 404. Two of these map to a security event (the service owns that mapping);
 * the other two are ordinary "you cannot see this" outcomes that F-001 already
 * produced silently, and they stay silent so anyone with a token cannot spray
 * the audit log with alerts about other people's organizations.
 */
export type AdminResetRefusal =
  /** Caller has no ACTIVE membership in this org, or the role lacks `manage_members`. */
  | "caller_not_authorized"
  /** Target is not an ACTIVE member of this org (or the user row is gone). */
  | "target_not_active_member"
  /** C-2 / D-028 — target is ACTIVE in at least one OTHER organization. */
  | "target_active_in_other_org"
  /** NEW-1 / D-030 — target is an Owner and the caller does not hold `full_access`. */
  | "target_is_owner";

/** One side's membership as read INSIDE the transaction (M-2: never a client
 *  read from before the lock). `status: null` = no membership row at all. */
export interface AdminResetMembershipFacts {
  readonly status: MembershipStatus | null;
  /** Capabilities of the role this membership currently holds ([] when none). */
  readonly capabilities: readonly string[];
}

export interface AdminResetInput {
  readonly caller: AdminResetMembershipFacts;
  readonly target: AdminResetMembershipFacts;
  /**
   * COUNT of the target's `active` memberships in organizations OTHER than this
   * one, read through the same `tx` (C-2). `invited` / `revoked` elsewhere do
   * NOT count: they grant no access, so they are not a tenant boundary to cross
   * (deliberate — security-review §H.1 row C-2).
   */
  readonly targetActiveMembershipsInOtherOrgs: number;
  /**
   * Did `SELECT … FOR UPDATE` actually return the target `User` row? A lock on
   * zero rows succeeds and locks nothing, so "row missing" must be an explicit
   * refusal rather than an assumption further down.
   */
  readonly targetUserExists: boolean;
}

export type AdminResetDecision =
  | { readonly allowed: true; readonly refusals: readonly [] }
  | { readonly allowed: false; readonly refusals: readonly AdminResetRefusal[] };

const ALLOWED: AdminResetDecision = Object.freeze({ allowed: true, refusals: Object.freeze([]) as readonly [] });

function refuse(...refusals: AdminResetRefusal[]): AdminResetDecision {
  return Object.freeze({ allowed: false, refusals: Object.freeze(refusals) });
}

/**
 * The full admin-reset gate, in the order architecture §3.3 states it.
 *
 * Order is load-bearing, not cosmetic:
 *  1. **caller** — an unauthorized caller learns nothing and generates nothing.
 *     Evaluating the target conditions for them would let anyone holding a token
 *     raise "someone tried to take over the Owner account" alerts about an org
 *     they have no relationship with.
 *  2. **target is an active member here** — the F-001 rule, unchanged.
 *  3. **C-2** — active somewhere else ⇒ this org's admin does not own that
 *     credential.
 *  4. **NEW-1** — target is an Owner ⇒ only `full_access` may reset them.
 *
 * Steps 3 and 4 are both evaluated (not short-circuited) so a target who trips
 * both produces both refusals, and therefore both audit events: "this was an
 * attempt on an Owner account" must never be swallowed by the more mundane
 * multi-org signal that happens to be listed first.
 *
 * The reads that produce `input` must ALL come from the transaction that holds
 * the `User` row lock, and the whole decision must be re-evaluated after the
 * write and before commit (NEW-5ก) — a membership created concurrently between
 * check and write must not slip through. That is the service's job; this
 * function is called twice.
 */
/**
 * Step 1 alone: may this caller perform admin resets in this org at all?
 *
 * Exposed so the service can gate the EXPENSIVE work (an argon2 hash: 19 MiB,
 * two passes, on the shared libuv threadpool) before it opens a transaction —
 * without a second, subtly different copy of "who may". `decideAdminReset` calls
 * this same function, so the two can never drift apart.
 *
 * It answers nothing about the TARGET on purpose: the target conditions are
 * re-read under the row lock, inside the transaction, where they are the ones
 * that must not go stale.
 */
export function isAdminResetCallerAuthorized(caller: AdminResetMembershipFacts): boolean {
  return caller.status === "active" && hasCapability(caller.capabilities, CAPABILITY_MANAGE_MEMBERS);
}

export function decideAdminReset(input: AdminResetInput): AdminResetDecision {
  if (!isAdminResetCallerAuthorized(input.caller)) return refuse("caller_not_authorized");

  const targetOk = input.targetUserExists && input.target.status === "active";
  if (!targetOk) return refuse("target_not_active_member");

  const refusals: AdminResetRefusal[] = [];

  // C-2 / D-028.
  if (input.targetActiveMembershipsInOtherOrgs > 0) {
    refusals.push("target_active_in_other_org");
  }

  // NEW-1 / D-030 — expressed through the SAME `canAssignRole` the membership
  // routes use (`newRoleIsOwner: false`: this route grants no role, it only
  // touches an existing Owner). Guarded by `targetIsOwner` so the refusal is
  // reported only for the reason it names — `canAssignRole` also returns false
  // for a caller without `manage_members`, which step 1 already handled.
  const targetIsOwner = isOwnerRole(input.target.capabilities);
  if (
    targetIsOwner &&
    !canAssignRole({
      actorCapabilities: input.caller.capabilities,
      targetIsOwner: true,
      newRoleIsOwner: false,
    })
  ) {
    refusals.push("target_is_owner");
  }

  return refusals.length > 0 ? refuse(...refusals) : ALLOWED;
}
