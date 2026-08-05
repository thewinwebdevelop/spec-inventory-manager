// F-002 · T-002-19 — an invitation row as the WIRE sees it (api-spec §3.10).
//
// WHY A PURE FUNCTION AND NOT A `.map()` IN THE SERVICE
//
//  1. THE ROW CARRIES SOMEBODY ELSE'S EMAIL, and — far more dangerous — the
//     table it comes from has a `tokenHash` column. A spread of the Prisma row
//     would compile, pass every test, and put the hash on the wire the day
//     somebody widens a `select`. Structural typing strips nothing at runtime;
//     this is the same lesson `toMyOrganizationItem` (M-10) cost us. So the
//     projection is written FIELD BY FIELD from named inputs, and there is no
//     input here that could carry the hash even by accident.
//
//  2. `acceptedUserCreatedAfterInvite` IS A FORENSIC SIGNAL WITH A SUBTLE
//     DEFINITION (NEW-9, amend #4). It compares the accepting account's
//     creation time against `invitation.createdAt` — when the invitation was
//     FIRST made — and NOT against `tokenIssuedAt`, which "reissue link"
//     overwrites with `now`. Comparing against `tokenIssuedAt` meant merely
//     pressing reissue flipped the flag to false and erased the only signal we
//     have in Phase 0 that a leaked link may have been redeemed by somebody who
//     signed up to claim it. Email ownership cannot be verified until F-081
//     (architecture §7.6), so this flag is all there is.
//
//     It is deliberately reported, never enforced: the UI shows a soft warning,
//     not an accusation. Plenty of legitimate invitees create their account
//     after being invited — that is the normal flow.
//
// Dates leave as ISO-8601 UTC strings (api-spec §1), converted here so no call
// site can emit a `Date` that serializes differently per client.
import type { ResolvedInvitationStatus } from "./invitation-status";

/** The invitation columns the row is built from. NOTE: no `tokenHash`. */
export interface InvitationRowSource {
  readonly id: string;
  readonly email: string;
  readonly roleId: string;
  readonly status: ResolvedInvitationStatus;
  /**
   * Non-null on EVERY row, including accepted/cancelled ones (ux Q14): the UI
   * renders "expires in about N hours" from this value and must never have to
   * guess when it is absent.
   */
  readonly expiresAt: Date;
  readonly tokenIssuedAt: Date;
  readonly invitedByUserId: string;
  readonly createdAt: Date;
  readonly acceptedAt: Date | null;
  readonly acceptedByUserId: string | null;
  /** `User.createdAt` of whoever accepted — null until somebody does. */
  readonly acceptedUserCreatedAt: Date | null;
}

/** Display-only role fields. `key` translates the name on screen, nothing more. */
export interface InvitationRowRole {
  readonly name: string;
  readonly key: string | null;
}

export interface InvitationRow {
  readonly id: string;
  readonly email: string;
  readonly roleId: string;
  readonly roleName: string;
  readonly roleKey: string | null;
  readonly status: ResolvedInvitationStatus;
  readonly expiresAt: string;
  readonly tokenIssuedAt: string;
  readonly invitedByUserId: string;
  readonly createdAt: string;
  readonly acceptedAt: string | null;
  readonly acceptedByUserId: string | null;
  readonly acceptedUserCreatedAfterInvite: boolean | null;
}

/**
 * Was the accepting account created AFTER this invitation first existed?
 *
 * `null` until somebody accepts — "we do not know yet" is a different answer
 * from "no", and a UI that renders `false` as "account predates the invite"
 * would be asserting something we have not observed.
 */
export function acceptedUserCreatedAfterInvite(source: {
  readonly createdAt: Date;
  readonly acceptedUserCreatedAt: Date | null;
}): boolean | null {
  if (source.acceptedUserCreatedAt === null) return null;
  return source.acceptedUserCreatedAt.getTime() > source.createdAt.getTime();
}

/** Project one invitation for `GET /orgs/{orgId}/invitations` (§3.10). */
export function toInvitationRow(
  invitation: InvitationRowSource,
  role: InvitationRowRole,
): InvitationRow {
  return {
    id: invitation.id,
    email: invitation.email,
    roleId: invitation.roleId,
    roleName: role.name,
    roleKey: role.key,
    status: invitation.status,
    expiresAt: invitation.expiresAt.toISOString(),
    tokenIssuedAt: invitation.tokenIssuedAt.toISOString(),
    invitedByUserId: invitation.invitedByUserId,
    createdAt: invitation.createdAt.toISOString(),
    acceptedAt: invitation.acceptedAt ? invitation.acceptedAt.toISOString() : null,
    acceptedByUserId: invitation.acceptedByUserId,
    acceptedUserCreatedAfterInvite: acceptedUserCreatedAfterInvite(invitation),
  };
}

/**
 * `now + ttlHours`, as an absolute instant.
 *
 * Taking `now` as an argument rather than calling `Date.now()` is what keeps
 * this testable without fake timers — and @qa's kit forbids fake timers outright,
 * because Postgres' own `now()` is not covered by them and a suite that fakes
 * time is testing a clock the database disagrees with.
 */
export function invitationExpiryFrom(now: Date, ttlHours: number): Date {
  return new Date(now.getTime() + ttlHours * 60 * 60 * 1000);
}
