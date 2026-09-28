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
// rule is the same one the membership routes use (F-002: `canAssignRole`,
// F-003: `decideMemberAuthority`) — there must not be
// a second, subtly different copy of "who may touch an Owner" — and the matrix
// of 8 cases has to be testable without a database.
//
// WHAT THIS FUNCTION DOES NOT DECIDE: the wire result. Every refusal here maps
// to the SAME 404 the route already returned for "not a member" (404-never-403,
// architecture §3.3). A caller must not be able to tell "blocked" from "not
// found"; a distinguishable refusal would be a fresh oracle answering "is this
// person the Owner?".

//
// F-003 · T-003-B05 (architecture §1 table · D-034 · api-spec §6): the
// Owner-only step now goes through `decideMemberAuthority({op:"reset_password"})`
// — the SAME two-axis rule as PATCH/DELETE member — which also refuses a target
// that is not strictly below the caller (`target_not_proper_subset`). This file
// does no ⊆/⊊ comparison of its own (gate G3-05).

import { CAPABILITY_MANAGE_MEMBERS, hasCapability } from "../auth/capabilities";
import { decideMemberAuthority, type MemberAuthorityResult } from "../rbac/member-authority";
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
  | "target_is_owner"
  /**
   * D-034 · AC-5.5 — the target's role is not STRICTLY below the caller's
   * (equal, more, or incomparable). Without it: Admin A demotes/equals Admin B,
   * resets B's password, and is B. Same uniform 404 as every other refusal.
   */
  | "target_not_proper_subset"
  /**
   * High-2 (security review of f66451f, user decision 2026-08-03) — the caller
   * is the target.
   *
   * Admin-reset sets a password WITHOUT proving knowledge of the current one;
   * that is exactly what makes it useful for helping a locked-out colleague, and
   * exactly what makes it dangerous pointed at yourself. Steal a
   * `manage_members` holder's short-lived ACCESS token and self-reset: you own
   * the account permanently, and `revokeAllForUser` throws the real owner off
   * every device on the way out. `/auth/change-password` requires
   * `currentPassword` to prevent precisely this, so allowing it here was a
   * documented bypass of that control for the highest-value accounts.
   *
   * Nothing legitimate is lost: someone who knows their password uses
   * change-password, and someone who does not needs the F-081 recovery flow —
   * which D-030 already made the only route to an Owner account.
   */
  | "caller_is_target";

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
  /** Is the caller resetting their OWN password? (High-2 — see the refusal.) */
  readonly callerIsTarget: boolean;
}

export type AdminResetDecision =
  | { readonly allowed: true; readonly refusals: readonly [] }
  | { readonly allowed: false; readonly refusals: readonly AdminResetRefusal[] };

const ALLOWED: AdminResetDecision = Object.freeze({
  allowed: true,
  refusals: Object.freeze([]) as readonly [],
});

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
 *  4. **NEW-1 + D-034** — `decideMemberAuthority(reset_password)`: an Owner
 *     target ⇒ only `full_access` may reset them (`target_is_owner`); any other
 *     target must be strictly below the caller (`target_not_proper_subset`).
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
  return (
    caller.status === "active" && hasCapability(caller.capabilities, CAPABILITY_MANAGE_MEMBERS)
  );
}

export function decideAdminReset(input: AdminResetInput): AdminResetDecision {
  if (!isAdminResetCallerAuthorized(input.caller)) return refuse("caller_not_authorized");

  const targetOk = input.targetUserExists && input.target.status === "active";
  if (!targetOk) return refuse("target_not_active_member");

  const refusals: AdminResetRefusal[] = [];

  // High-2 — refuse self-reset. Checked here rather than short-circuiting so a
  // caller who trips this AND another rule reports both.
  if (input.callerIsTarget) {
    refusals.push("caller_is_target");
  }

  // C-2 / D-028.
  if (input.targetActiveMembershipsInOtherOrgs > 0) {
    refusals.push("target_active_in_other_org");
  }

  // NEW-1 / D-030 + D-034 — one call to the rule the membership routes use.
  // `actorIsTarget` is passed truthfully: `reset_password` is never relaxed for
  // yourself (High-2 is refused above as well; the rule does not rely on it).
  const authority = decideMemberAuthority({
    op: "reset_password",
    actorCapabilities: input.caller.capabilities,
    actorIsTarget: input.callerIsTarget,
    targetCurrentCapabilities: input.target.capabilities,
  });
  const refusal = mapAuthorityRefusal(authority);
  if (refusal !== null) refusals.push(refusal);

  return refusals.length > 0 ? refuse(...refusals) : ALLOWED;
}

/** `decideMemberAuthority(reset_password)` → this route's refusal names (architecture §1 table). */
function mapAuthorityRefusal(result: MemberAuthorityResult): AdminResetRefusal | null {
  if (result.ok) return null;
  switch (result.reason) {
    case "owner_only":
      return "target_is_owner";
    case "target_not_below_actor":
      return "target_not_proper_subset";
    default:
      // `forbidden` is step 1's job (same `manage_members` check) and
      // `reset_password` has no grant axis — reaching here means the two
      // copies of "who may" drifted. Fail loud, never map to "allowed".
      throw new Error(`decideAdminReset: unexpected authority refusal ${result.reason}`);
  }
}

// ── MemberRow.viewerCanResetPassword (api-spec §3.1 (3) · architecture §1.2) ──

/** Who is looking — read from the request's org context. */
export interface AdminResetVisibleViewer {
  readonly userId: string;
  readonly capabilities: readonly string[];
}

/**
 * The member row being looked at. Deliberately NO C-2 input (the target's
 * memberships elsewhere) and no `User` state: those are facts about other
 * organizations and must never shape a read verdict. So `ok: true` means "no
 * rule you can see blocks this" — the write may still answer the uniform 404.
 */
export interface AdminResetVisibleRow {
  readonly userId: string;
  readonly capabilities: readonly string[];
}

export type AdminResetVisibleVerdict =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: "self" | "owner_only" | "equal_permissions" | "exceeds_your_permissions";
    };

/**
 * The part of `decideAdminReset` the viewer can already see, in the wire's
 * reason order: `self` → `owner_only` → `equal_permissions` →
 * `exceeds_your_permissions`. Same `decideMemberAuthority` call as the write,
 * so "visible refuses ⇒ write refuses" holds by construction (U-RB-14
 * property).
 *
 * Only for viewers holding `manage_members` ∧ `manage_roles` (the route's
 * audience rule, AC-6.4); a viewer without `manage_members` is a caller bug
 * and throws rather than inventing a reason.
 */
export function decideAdminResetVisible(
  viewer: AdminResetVisibleViewer,
  row: AdminResetVisibleRow,
): AdminResetVisibleVerdict {
  if (viewer.userId === row.userId) return { ok: false, reason: "self" };
  const result = decideMemberAuthority({
    op: "reset_password",
    actorCapabilities: viewer.capabilities,
    actorIsTarget: false,
    targetCurrentCapabilities: row.capabilities,
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
        `decideAdminResetVisible: viewer lacks manage_members (${result.reason}) — apply the audience rule first`,
      );
  }
}
