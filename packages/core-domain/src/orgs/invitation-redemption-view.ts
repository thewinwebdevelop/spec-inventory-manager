// F-002 · T-002-20 — the two responses a STRANGER can reach (api-spec
// §3.14/§3.15). Pure projections, written field by field.
//
// WHY THESE ARE FUNCTIONS AND NOT `.map()` IN THE SERVICE
//
//  1. `POST /invitations/preview` is `@Public()`. Its input row comes from the
//     `Invitation` table, which holds `tokenHash`, the invitee's FULL email and
//     the `organizationId` — three values the endpoint must never emit
//     (api-spec §3.14: "ไม่คืน organizationId, ไม่คืน email เต็ม"). A spread of
//     the Prisma row would compile, pass, and put all three on an unauthenticated
//     response the day somebody widens a `select`. Structural typing strips
//     nothing at runtime; the only defence is a projection whose INPUTS cannot
//     carry those values in the first place, which is what the source types
//     below are.
//
//  2. The mask is applied HERE, not at the call site. `maskEmail` is the one
//     place that decides how much of an address a stranger may see (fixed width,
//     so neither the characters nor the LENGTH of the local part leak), and the
//     only way it cannot be forgotten is for the preview shape to have no field
//     that could hold an unmasked address.
//
// Dates leave as ISO-8601 UTC strings (api-spec §1), converted here so no call
// site can emit a `Date` that serializes differently per client.
import { maskEmail } from "./invitation-email";
import type { ResolvedInvitationStatus } from "./invitation-status";

// ── §3.14 preview ───────────────────────────────────────────────────────────

/**
 * What the preview is built FROM. Note what is absent and cannot be passed in:
 * `organizationId`, `invitationId`, `tokenHash`, `invitedByUserId`.
 */
export interface InvitationPreviewSource {
  /** Display name of the shop — the one thing that tells the invitee where they are being invited. */
  readonly organizationName: string;
  readonly roleName: string;
  /** `null` for a role F-003 created; clients must handle it (ux Q4). */
  readonly roleKey: string | null;
  /** The invited address, NORMALIZED. Masked below; never emitted whole. */
  readonly email: string;
  readonly expiresAt: Date;
  /** Always `pending` on a 200 — the other states answer 409 (api-spec §3.14). */
  readonly status: ResolvedInvitationStatus;
}

/** `200` of `POST /invitations/preview` — api-spec §3.14, exactly these keys. */
export interface InvitationPreview {
  readonly organizationName: string;
  readonly roleName: string;
  readonly roleKey: string | null;
  /** `u***@example.com` — enough to pick the right account, not an address. */
  readonly emailMasked: string;
  readonly expiresAt: string;
  readonly status: ResolvedInvitationStatus;
}

/**
 * Project one invitation for the PUBLIC preview.
 *
 * Throws `MaskEmailError` (from `maskEmail`) for an address it cannot parse
 * rather than falling back to a placeholder: a value we cannot mask must not be
 * rendered on a public page at all.
 */
export function toInvitationPreview(source: InvitationPreviewSource): InvitationPreview {
  return {
    organizationName: source.organizationName,
    roleName: source.roleName,
    roleKey: source.roleKey,
    emailMasked: maskEmail(source.email),
    expiresAt: source.expiresAt.toISOString(),
    status: source.status,
  };
}

// ── §3.15 accept ────────────────────────────────────────────────────────────

export interface InvitationAcceptSource {
  readonly organization: { readonly id: string; readonly name: string };
  readonly membership: {
    readonly roleId: string;
    readonly roleName: string;
    readonly roleKey: string | null;
  };
}

/**
 * `200` of `POST /invitations/accept` — api-spec §3.15.
 *
 * `status` is the literal `"active"`, not a value copied from the row: this
 * shape is only ever produced on the success path, where the membership was
 * just written active inside the transaction. Typing it as the general
 * `MembershipStatus` would invite a future call site to build this response for
 * a `revoked` row and tell the client it had joined.
 */
export interface InvitationAcceptResult {
  readonly organization: { readonly id: string; readonly name: string };
  readonly membership: {
    readonly roleId: string;
    readonly roleName: string;
    readonly roleKey: string | null;
    readonly status: "active";
  };
}

/**
 * Project the accepted membership.
 *
 * ⛔ Deliberately carries NO email, no invitation id and no token: the caller
 * already knows who they are, and the response is the last place a redeemed
 * credential could still leak (I-6).
 */
export function toInvitationAcceptResult(source: InvitationAcceptSource): InvitationAcceptResult {
  return {
    organization: { id: source.organization.id, name: source.organization.name },
    membership: {
      roleId: source.membership.roleId,
      roleName: source.membership.roleName,
      roleKey: source.membership.roleKey,
      status: "active",
    },
  };
}
