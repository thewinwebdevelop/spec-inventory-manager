// F-002 · T-002-08b — invitation TTL + the accept decision (pure fns, golden rule #6).
// architecture §7.4/§7.5 · data-model §6 · api-spec §3.15 (D-027/D-028 · I-1/I-7/I-9/M-6).
//
// Two decisions the services must NOT re-implement:
//
// 1. HOW LONG a link lives. Phase 0 cannot verify email (architecture §7.6:
//    signup writes `verified:false` and login never checks it), so whoever holds
//    the link holds the invitation. The compensating control is time: a link
//    that grants power lives 24h, an ordinary one 7 days. Both the create and
//    the reissue path call this one function, so "rotate = new age" (D-027)
//    cannot drift between them.
//
// 2. WHETHER a link may be accepted. The order of the answers is part of the
//    contract (api-spec §3.15) — an expired link must report `expired` even when
//    the caller is also a revoked member, otherwise the UI sends the user to the
//    wrong recovery path.
//
// `now` is a parameter (never `Date.now()`): every rule here is a boundary
// comparison, and boundaries that cannot be tested to the millisecond are
// boundaries nobody has checked.

import { CAPABILITY_MANAGE_MEMBERS, hasCapability } from "../auth/capabilities";
import { resolveInvitationStatus, type StoredInvitationStatus } from "./invitation-status";
import type { MembershipStatus } from "./owner-invariant";

/** TTL for a role that holds `full_access` or `manage_members` (D-028/I-7). */
export const INVITATION_TTL_HOURS_ELEVATED = 24;
/** TTL for every other role — 7 days. */
export const INVITATION_TTL_HOURS_STANDARD = 168;

/**
 * "This role is a HIGH role" (data-model §5.2) == its capabilities hold
 * `full_access` OR `manage_members`.
 *
 * Expressed through `hasCapability`, whose `full_access` wildcard already covers
 * the first branch (pinned by U-CD-11) — one capability primitive, no second
 * interpretation of what full access means. Never compare `role.name`/`role.key`:
 * F-003 lets users rename roles and build custom ones, and a custom role holding
 * `manage_members` must get the short TTL automatically, with no code change.
 */
export function isElevatedRole(roleCapabilities: readonly string[]): boolean {
  return hasCapability(roleCapabilities, CAPABILITY_MANAGE_MEMBERS);
}

/**
 * Hours an invitation for this role stays valid — `expiresAt = now + ttl`.
 * Used by BOTH create and reissue (architecture §7.5); reissue recomputes it
 * from the CURRENT capabilities, so a role that gained power gets the short TTL
 * on its next link.
 *
 * Unknown capability names return the standard TTL instead of throwing: the
 * capability registry (docs/01 §2) is open-ended, and an unrecognised name must
 * never be able to fail an invitation.
 */
export function invitationTtlHours(
  roleCapabilities: readonly string[],
): typeof INVITATION_TTL_HOURS_ELEVATED | typeof INVITATION_TTL_HOURS_STANDARD {
  return isElevatedRole(roleCapabilities)
    ? INVITATION_TTL_HOURS_ELEVATED
    : INVITATION_TTL_HOURS_STANDARD;
}

/**
 * Every answer `canAcceptInvitation` can give. Each maps to one wire result
 * (api-spec §3.15/§4): `ok` → 200 · `expired`/`cancelled`/`already_accepted` →
 * 409 `INVITATION_EXPIRED|INVITATION_CANCELLED|INVITATION_ALREADY_ACCEPTED` ·
 * `already_member` → 409 `ALREADY_MEMBER` · `superseded` → 409
 * `INVITATION_SUPERSEDED` · `role_unavailable` → 409 `INVITATION_ROLE_UNAVAILABLE`.
 */
export type AcceptInvitationDecision =
  | "ok"
  | "expired"
  | "cancelled"
  | "already_accepted"
  | "already_member"
  | "superseded"
  | "role_unavailable";

export interface AcceptableInvitation {
  readonly status: StoredInvitationStatus;
  readonly expiresAt: Date;
  /**
   * When the CURRENT token was issued (create, or the last rotate — D-027).
   * Compared against `Membership.revokedAt`: "was this link handed out after the
   * person was removed?". Deliberately NOT `createdAt` — rotating after a
   * revocation is a conscious re-invite by someone holding `manage_members`.
   * (The forensic flag `acceptedUserCreatedAfterInvite` uses `createdAt`
   * instead — architecture §7.6/NEW-9 — because it must survive a rotate.)
   */
  readonly tokenIssuedAt: Date;
}

/** The invitee's CURRENT membership in the invitation's org, read inside the tx. */
export interface AcceptorMembership {
  readonly status: MembershipStatus;
  /** Set when `status === 'revoked'`; `null` on a row that was never revoked. */
  readonly revokedAt: Date | null;
}

export interface CanAcceptInvitationInput {
  readonly invitation: AcceptableInvitation;
  /** `null` when the user has no membership row in this org yet. */
  readonly membership: AcceptorMembership | null;
  /** Does `invitation.roleId` still exist AND still belong to this org? (M-6) */
  readonly roleExistsInOrg: boolean;
  readonly now: Date;
}

/**
 * May this invitation be accepted — and if not, why?
 *
 * Decision order (api-spec §3.15, pinned by U-CD-04):
 *   expired → cancelled/accepted → [email mismatch, at the service] →
 *   role_unavailable → already_member → superseded → ok
 *
 * The email check is intentionally absent: it needs the authenticated user, not
 * the invitation row, and it answers with 403 rather than 409. Its slot in the
 * order is fixed above so the service cannot move it.
 *
 * Returns a value instead of throwing because the caller maps each answer to a
 * different status code + Thai message, and one call site (`ALREADY_MEMBER`)
 * also has to write (mark the invitation cancelled, I-9) before responding.
 *
 * Fail-closed by construction: any membership state that is not "no row",
 * "active", or "revoked before this token existed" ends up as `superseded`
 * rather than `ok` — including the `invited` dead state (data-model #19) and a
 * revoked row whose `revokedAt` is missing.
 */
export function canAcceptInvitation({
  invitation,
  membership,
  roleExistsInOrg,
  now,
}: CanAcceptInvitationInput): AcceptInvitationDecision {
  // 1. The clock first — a dead link is dead regardless of who is holding it.
  //    Reuses the same derivation the read paths use (data-model §3.2), so the
  //    `expiresAt <= now` boundary exists in exactly one place.
  const status = resolveInvitationStatus(invitation, now);
  if (status === "expired") return "expired";
  if (status === "cancelled") return "cancelled";
  if (status === "accepted") return "already_accepted";

  // 2. The role must still be usable in this org (F-003 may delete roles).
  if (!roleExistsInOrg) return "role_unavailable";

  // 3. Existing membership.
  if (membership === null) return "ok";
  if (membership.status === "active") return "already_member"; // never re-role (I-9)
  if (membership.status === "revoked") {
    // A link issued at or before the revocation must not undo it (I-1). Equality
    // resolves to `superseded`: the safe side of a boundary we cannot order.
    if (membership.revokedAt === null) return "superseded"; // malformed row
    return membership.revokedAt.getTime() >= invitation.tokenIssuedAt.getTime()
      ? "superseded"
      : "ok";
  }
  // `invited` — a dead state with no write path in Phase 0. Treated like a
  // revocation rather than silently accepted.
  return "superseded";
}
