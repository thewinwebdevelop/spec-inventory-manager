// F-002 · T-002-18 — a membership row as the WIRE sees it (api-spec §3.7/§3.8).
//
// WHY THIS IS A PURE FUNCTION AND NOT A `.map()` IN THE SERVICE
//
//  1. `isOwner` IS A SECURITY-SHAPED FIELD. api-spec §3.7 uses it to hide the
//     "change role / remove" buttons from a caller who is not an Owner (C-1),
//     and the ONLY correct definition is "this row's role holds `full_access`"
//     (`isOwnerRole`) — never `role.name === "Owner"` and never
//     `role.key === "owner"`. F-003 lets people rename roles and create custom
//     ones, and @qa's I-45 flips Staff's `key` to `"owner"` in the database on
//     purpose: if this field were computed from the key, the UI would call a
//     Staff member the Owner while the server (correctly) refused them. One
//     definition, shared with `canAssignRole`, is what keeps those two answers
//     the same answer.
//
//  2. THE ROW CARRIES SOMEBODY ELSE'S EMAIL. That makes the projection itself a
//     PDPA decision, so it is written FIELD BY FIELD from named inputs. A
//     spread of a Prisma row would compile, pass every test, and put whatever
//     column is added next on the wire — structural typing strips nothing at
//     runtime (the `toMyOrganizationItem` lesson, M-10).
//
// Dates leave as ISO-8601 UTC strings (api-spec §1) — the mapper converts, so no
// call site can forget and emit a `Date` that serializes differently per client.
import { isOwnerRole } from "./member-authz";
import type { MembershipStatus } from "./owner-invariant";

/** The membership columns the row is built from. */
export interface MemberRowMembership {
  readonly userId: string;
  readonly roleId: string;
  readonly status: MembershipStatus;
  readonly activatedAt: Date | null;
  readonly revokedAt: Date | null;
  readonly createdAt: Date;
}

/** The role columns. `capabilities` decides `isOwner`; `key` is display only. */
export interface MemberRowRole {
  readonly name: string;
  readonly key: string | null;
  readonly capabilities: readonly string[];
}

/** The `User` columns — exactly what `USER_SELECT` (packages/db) allows. */
export interface MemberRowUser {
  readonly email: string;
}

export interface MemberRowSource {
  readonly membership: MemberRowMembership;
  readonly role: MemberRowRole;
  readonly user: MemberRowUser;
  /** The CALLER, so `isMe` is decided here and not by comparing ids on the wire. */
  readonly viewerUserId: string;
}

/** api-spec §3.7 — one row of `GET /orgs/{orgId}/members`, and the `200` of §3.8. */
export interface MemberRow {
  readonly userId: string;
  readonly email: string;
  readonly roleId: string;
  readonly roleName: string;
  /** `owner|admin|staff` for system roles, `null` for a custom one (ux Q4). */
  readonly roleKey: string | null;
  readonly status: MembershipStatus;
  readonly activatedAt: string | null;
  readonly revokedAt: string | null;
  readonly createdAt: string;
  /** Is this row the caller? (UI: "you", and the leave-vs-remove affordance.) */
  readonly isMe: boolean;
  /** Does this row's role hold `full_access`? Capability, never name/key. */
  readonly isOwner: boolean;
}

/** Project one membership + its role + its user into the §3.7 row. */
export function toMemberRow({ membership, role, user, viewerUserId }: MemberRowSource): MemberRow {
  return {
    userId: membership.userId,
    email: user.email,
    roleId: membership.roleId,
    roleName: role.name,
    roleKey: role.key,
    status: membership.status,
    activatedAt: toIso(membership.activatedAt),
    revokedAt: toIso(membership.revokedAt),
    createdAt: membership.createdAt.toISOString(),
    isMe: membership.userId === viewerUserId,
    // ⛔ NOT `role.key === "owner"` / `role.name === "Owner"`. See the header.
    isOwner: isOwnerRole(role.capabilities),
  };
}

function toIso(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}
