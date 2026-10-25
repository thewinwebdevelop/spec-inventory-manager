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

import {
  CAPABILITY_FULL_ACCESS,
  CAPABILITY_MANAGE_MEMBERS,
  hasCapability,
} from "../auth/capabilities";
import { CAPABILITY_MANAGE_ROLES } from "../rbac/registry";
import { decideMemberAuthority } from "../rbac/member-authority";
import { resolveInvitationStatus, type StoredInvitationStatus } from "./invitation-status";
import { invitationExpiryFrom } from "./invitation-view";
import type { MembershipStatus } from "./owner-invariant";

/** TTL for a role that holds `full_access`, `manage_members` or `manage_roles` (D-028/I-7 · F-003 AC-10.3). */
export const INVITATION_TTL_HOURS_ELEVATED = 24;
/** TTL for every other role — 7 days. */
export const INVITATION_TTL_HOURS_STANDARD = 168;

/**
 * The capabilities that make a role "HIGH" (data-model §5.2 · F-003 architecture
 * §6 / AC-10.3). `manage_roles` joined in F-003: whoever can rewrite roles can
 * rewrite one they hold into anything below Owner, so a link carrying it is as
 * powerful as one carrying `manage_members`.
 */
const ELEVATING_CAPABILITIES = Object.freeze([
  CAPABILITY_FULL_ACCESS,
  CAPABILITY_MANAGE_MEMBERS,
  CAPABILITY_MANAGE_ROLES,
] as const);

/**
 * "This role is a HIGH role" == its capabilities hold `full_access`,
 * `manage_members` OR `manage_roles`.
 *
 * Expressed through `hasCapability` (which expands `full_access` and `implies`)
 * — one capability primitive, no second interpretation of what a key grants.
 * Takes CAPABILITIES only: never compare `role.name`/`role.key` — F-003 lets
 * users rename roles and build custom ones, and a custom role holding
 * `manage_roles` must get the short TTL automatically (U-RB-16).
 */
export function isElevatedRole(roleCapabilities: readonly string[]): boolean {
  return ELEVATING_CAPABILITIES.some((key) => hasCapability(roleCapabilities, key));
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

/** The invitation's role as read LIVE inside the accept tx (org-scoped, not soft-deleted). */
export interface AcceptableInvitationRole {
  /** Its CURRENT capabilities — they drive the TTL leg (F-003 architecture §6 layer 2). */
  readonly capabilities: readonly string[];
}

/**
 * Deliberately has NO inviter field (U-RB-17): whether the person who issued
 * the link may still grant it is `decideInviterRecheck`, run only after `ok`.
 */
export interface CanAcceptInvitationInput {
  readonly invitation: AcceptableInvitation;
  /** `null` when the user has no membership row in this org yet. */
  readonly membership: AcceptorMembership | null;
  /**
   * The invitation's role if it still exists AND still belongs to this org
   * (M-6); `null` otherwise → `role_unavailable`. One field instead of a
   * boolean + capabilities, so "exists" and "its capabilities" cannot disagree.
   */
  readonly role: AcceptableInvitationRole | null;
  readonly now: Date;
}

/**
 * F-003 architecture §6 layer 2 / AC-10.4 — the expiry that binds at accept:
 * `min(stored expiresAt, tokenIssuedAt + ttl(CURRENT capabilities))`.
 * A role that became elevated after the link went out shortens it to 24h from
 * issue; a role that lost power never extends it (the stored value still binds).
 * `tokenIssuedAt + ttl` goes through `invitationExpiryFrom` — the same
 * arithmetic create/reissue store — so the two cannot drift.
 */
function effectiveExpiresAt(
  invitation: AcceptableInvitation,
  role: AcceptableInvitationRole | null,
): Date {
  if (role === null) return invitation.expiresAt; // `role_unavailable` is decided after the clock
  const byCurrentRole = invitationExpiryFrom(
    invitation.tokenIssuedAt,
    invitationTtlHours(role.capabilities),
  );
  return byCurrentRole.getTime() < invitation.expiresAt.getTime()
    ? byCurrentRole
    : invitation.expiresAt;
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
  role,
  now,
}: CanAcceptInvitationInput): AcceptInvitationDecision {
  // 1. The clock first — a dead link is dead regardless of who is holding it.
  //    Reuses the same derivation the read paths use (data-model §3.2), so the
  //    `expiresAt <= now` boundary exists in exactly one place — fed with the
  //    expiry the role's CURRENT capabilities allow (F-003 §6 layer 2).
  const status = resolveInvitationStatus(
    { status: invitation.status, expiresAt: effectiveExpiresAt(invitation, role) },
    now,
  );
  if (status === "expired") return "expired";
  if (status === "cancelled") return "cancelled";
  if (status === "accepted") return "already_accepted";

  // 2. The role must still be usable in this org (F-003 may delete roles).
  if (role === null) return "role_unavailable";

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

// ── D-035 + Addendum — the accept-time re-check of the inviter ──────────────

/**
 * Why an accept was refused because of the INVITER (architecture §6.1). Never
 * shown to the invitee (they get `409 INVITATION_CANCELLED`); carried on the
 * `org.invitation.accept_blocked_inviter` event for the Owner / F-005.
 */
export type InviterRecheckReason =
  "inviter_not_active" | "inviter_not_authorized" | "inviter_exceeds";

export type InviterRecheckDecision = "ok" | InviterRecheckReason;

export interface InviterRecheckInput {
  /**
   * The CURRENT role of `COALESCE(issuedByUserId, invitedByUserId)` through an
   * ACTIVE membership in this org, read in the accept tx under the org lock.
   * `null` = no such membership (removed, left, account deleted, or both ids
   * null on a legacy row) — all fail closed.
   */
  readonly inviter: { readonly capabilities: readonly string[] } | null;
  /** The invitation role's CURRENT capabilities (the same live read `canAcceptInvitation` got). */
  readonly invitationRoleCapabilities: readonly string[];
}

/**
 * The verdict with the keys behind it — what the accept route needs for
 * `org.invitation.accept_blocked_inviter.excessCapabilities` (T-003-B19).
 * `excess` is `decideMemberAuthority`'s own `excess` for that leg (floor →
 * `[manage_members]` · owner_only → `[full_access]` · grant ⊄ → what the role
 * holds beyond the issuer), and `[]` when there is no active issuer at all.
 */
export type InviterRecheckVerdict =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: InviterRecheckReason;
      readonly excess: readonly string[];
    };

/**
 * D-035 (+ Addendum P2/P3): may the person who issued this link still grant
 * it? Called ONLY after `canAcceptInvitation` answered `ok` (and after the
 * email binding), so no F-002 answer changes. The rule itself is
 * `decideMemberAuthority(op: invite_accept_recheck)` — this fn only maps each
 * failing leg to its own reason:
 *   no active membership                         → `inviter_not_active`
 *   `forbidden` (floor `manage_members`, P2)     → `inviter_not_authorized`
 *   `owner_only` / `exceeds_actor` (grant ⊄)     → `inviter_exceeds`
 * Any other refusal cannot happen for a grant-only op; if it ever does, throw
 * (fail loud) rather than guess a reason or let the accept through.
 */
export function judgeInviterRecheck({
  inviter,
  invitationRoleCapabilities,
}: InviterRecheckInput): InviterRecheckVerdict {
  if (inviter === null) return { ok: false, reason: "inviter_not_active", excess: [] };
  const verdict = decideMemberAuthority({
    op: "invite_accept_recheck",
    actorCapabilities: inviter.capabilities,
    actorIsTarget: false,
    grantCapabilities: invitationRoleCapabilities,
  });
  if (verdict.ok) return { ok: true };
  switch (verdict.reason) {
    case "forbidden":
      return { ok: false, reason: "inviter_not_authorized", excess: verdict.excess };
    case "owner_only":
    case "exceeds_actor":
      return { ok: false, reason: "inviter_exceeds", excess: verdict.excess };
    default:
      throw new Error(
        `decideInviterRecheck: unexpected refusal ${JSON.stringify(verdict.reason)} for a grant-only op`,
      );
  }
}

/** `judgeInviterRecheck` projected onto its reason — the shape the lemma harness proves. */
export function decideInviterRecheck(input: InviterRecheckInput): InviterRecheckDecision {
  const verdict = judgeInviterRecheck(input);
  return verdict.ok ? "ok" : verdict.reason;
}
