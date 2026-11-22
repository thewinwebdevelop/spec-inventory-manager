// F-003 · T-003-B24 — U-API3-04 (the pure half): the clamp a role edit applies to
// the role's pending invitations (architecture §6 layer 1 · AC-10.3/10.4).
//
//   !elevated(before) ∧ elevated(after) ⇒ expiresAt = min(expiresAt, tokenIssuedAt + 24h)
//   anything else                       ⇒ unchanged (never extended — not even on a demotion)
import { describe, it, expect } from "vitest";
import { INVITATION_TTL_HOURS_ELEVATED, clampedInvitationExpiry } from "./invitation-policy";

const HOUR = 3_600_000;
const ISSUED = new Date("2026-11-01T00:00:00.000Z");
const SEVEN_DAYS = new Date(ISSUED.getTime() + 168 * HOUR);
const STAFF = ["manage_orders"];
const MEMBERS = ["manage_members", "manage_orders"];
const ROLES = ["manage_roles", "manage_orders"];

describe("clampedInvitationExpiry (U-API3-04 · architecture §6 layer 1)", () => {
  it("not elevated → elevated (manage_members): a 7-day link is cut to tokenIssuedAt + 24h", () => {
    expect(
      clampedInvitationExpiry({
        before: STAFF,
        after: MEMBERS,
        invitation: { tokenIssuedAt: ISSUED, expiresAt: SEVEN_DAYS },
      }),
    ).toEqual(new Date(ISSUED.getTime() + INVITATION_TTL_HOURS_ELEVATED * HOUR));
  });

  it("manage_roles counts as elevated too (AC-10.3)", () => {
    expect(
      clampedInvitationExpiry({
        before: STAFF,
        after: ROLES,
        invitation: { tokenIssuedAt: ISSUED, expiresAt: SEVEN_DAYS },
      }),
    ).toEqual(new Date(ISSUED.getTime() + 24 * HOUR));
  });

  it("a link already shorter than issue + 24h is left alone (LEAST — never extended)", () => {
    for (const expiresAt of [
      new Date(ISSUED.getTime() + 2 * HOUR),
      new Date(ISSUED.getTime() + 24 * HOUR), // equal ⇒ nothing to write
    ]) {
      expect(
        clampedInvitationExpiry({
          before: STAFF,
          after: MEMBERS,
          invitation: { tokenIssuedAt: ISSUED, expiresAt },
        }),
        expiresAt.toISOString(),
      ).toBeNull();
    }
  });

  it("issued long ago: the clamp may land in the past (the link is simply expired now)", () => {
    const old = new Date(ISSUED.getTime() - 30 * HOUR);
    expect(
      clampedInvitationExpiry({
        before: STAFF,
        after: MEMBERS,
        invitation: { tokenIssuedAt: old, expiresAt: SEVEN_DAYS },
      }),
    ).toEqual(new Date(old.getTime() + 24 * HOUR));
  });

  it("no change of tier ⇒ null: staff→staff, elevated→elevated, and elevated→staff (a demotion never extends)", () => {
    for (const [before, after] of [
      [STAFF, ["manage_orders", "manage_products"]],
      [MEMBERS, ROLES],
      [MEMBERS, STAFF],
    ] as const) {
      expect(
        clampedInvitationExpiry({
          before,
          after,
          invitation: { tokenIssuedAt: ISSUED, expiresAt: SEVEN_DAYS },
        }),
        `${before.join(",")} → ${after.join(",")}`,
      ).toBeNull();
    }
  });

  it("is pure: the inputs are not mutated", () => {
    const invitation = Object.freeze({ tokenIssuedAt: ISSUED, expiresAt: SEVEN_DAYS });
    const before = Object.freeze([...STAFF]);
    const after = Object.freeze([...MEMBERS]);
    clampedInvitationExpiry({ before, after, invitation });
    expect(invitation.expiresAt).toBe(SEVEN_DAYS);
  });
});
