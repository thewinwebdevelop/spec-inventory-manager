// T-002-W5 ★ — the `⋯` menu rules (ux-wireframe §7) and the one-time link
// state (§9.1). Both are client-side UX over server-enforced rules, and both
// have a cell that is easy to get backwards.
import { describe, it, expect } from "vitest";
import {
  assignableRoles,
  isOwner,
  memberActionsFor,
  CAPABILITY_FULL_ACCESS,
} from "./member-actions";
import {
  closeButtonVariant,
  closeInviteLink,
  markCopied,
  openInviteLink,
  visibleInviteUrl,
  INVITE_LINK_CLOSED,
} from "./invite-link";

const owner = new Set([CAPABILITY_FULL_ACCESS, "manage_members"]);
const admin = new Set(["manage_members"]);

function actions(over: Partial<Parameters<typeof memberActionsFor>[0]> = {}) {
  return memberActionsFor({
    myCapabilities: admin,
    targetIsOwner: false,
    isSelf: false,
    targetStatus: "active",
    ...over,
  });
}

describe("memberActionsFor — §7's table", () => {
  it("★ an Admin gets NO menu on an Owner, plus the explaining line (C-1)", () => {
    const a = actions({ myCapabilities: admin, targetIsOwner: true });
    expect(a.changeRole).toBe(false);
    expect(a.removeFromOrg).toBe(false);
    // §7 asks for the sentence rather than a disabled item, so the user learns
    // why instead of wondering what they did wrong.
    expect(a.ownerOnlyNotice).toBe(true);
  });

  it("an Owner may act on another Owner", () => {
    const a = actions({ myCapabilities: owner, targetIsOwner: true });
    expect(a.changeRole).toBe(true);
    expect(a.removeFromOrg).toBe(true);
    expect(a.ownerOnlyNotice).toBe(false);
  });

  it("an Admin may act on an ordinary member", () => {
    const a = actions({ myCapabilities: admin, targetIsOwner: false });
    expect(a).toMatchObject({ changeRole: true, removeFromOrg: true, ownerOnlyNotice: false });
  });

  it("★ your own row offers LEAVE, never remove — and to every member", () => {
    // D-029: leaving needs no `manage_members`, which is why the same
    // affordance also appears on S4 where Staff can reach it. Offering
    // "remove" on yourself would be a different endpoint with a different
    // meaning (§3.8 vs §3.17).
    const staff = actions({ myCapabilities: new Set(["view_products"]), isSelf: true });
    expect(staff.leaveOrg).toBe(true);
    expect(staff.removeFromOrg).toBe(false);
    expect(staff.changeRole).toBe(true);
  });

  it("★ a removed row has no actions at all", () => {
    // §7 dims it and drops the menu: it is a record of a person who left, not
    // somebody you can act on.
    for (const status of ["revoked", "invited"]) {
      expect(actions({ targetStatus: status, myCapabilities: owner })).toEqual({
        changeRole: false,
        removeFromOrg: false,
        leaveOrg: false,
        ownerOnlyNotice: false,
      });
    }
  });

  it("★ ownership is read from capabilities, never from a role name or key", () => {
    // @qa's I-45 flips a Staff role's `key` to "owner" in the database to
    // prove nothing reads it. There is no name or key anywhere in this input.
    expect(isOwner(["full_access"])).toBe(true);
    expect(isOwner(["manage_members", "view_products"])).toBe(false);
    expect(isOwner([])).toBe(false);
  });
});

describe("assignableRoles — the other half of C-1", () => {
  const roles = [
    { id: "rol_owner", key: "owner" },
    { id: "rol_admin", key: "admin" },
    { id: "rol_staff", key: "staff" },
  ];
  const ownerRoleIds = new Set(["rol_owner"]);

  it("★ an Admin cannot offer the Owner role — granting full_access IS granting ownership", () => {
    expect(assignableRoles(roles, admin, ownerRoleIds).map((r) => r.id)).toEqual([
      "rol_admin",
      "rol_staff",
    ]);
  });

  it("an Owner may offer every role", () => {
    expect(assignableRoles(roles, owner, ownerRoleIds)).toHaveLength(3);
  });

  it("★ the Owner role is identified by id, resolved from capabilities upstream", () => {
    // Not by `key === "owner"`. A shop whose Owner role carries a custom key
    // (F-003) must still be un-offerable to an Admin.
    const custom = [{ id: "rol_boss", key: null }];
    expect(assignableRoles(custom, admin, new Set(["rol_boss"]))).toEqual([]);
  });
});

describe("invite link — one shot, and the exit gets prominent only when it is safe", () => {
  const open = openInviteLink({
    inviteUrl: "https://app.omnistock.co/invite?token=9f2b",
    email: "malee@shop.com",
    expiresAt: "2026-08-09T07:30:00.000Z",
  });

  it("★ closing DISCARDS the token — `closed` has nowhere to keep it", () => {
    // The server stores only the hash (D-018), so this panel is the only place
    // the raw token exists. A `{ visible: false, token }` shape would keep a
    // live membership credential in memory for the life of the screen while
    // passing any render-level assertion.
    const closed = closeInviteLink();
    expect(closed).toEqual({ status: "closed" });
    expect(JSON.stringify(closed)).not.toContain("9f2b");
    expect(visibleInviteUrl(closed)).toBeNull();
    expect(visibleInviteUrl(INVITE_LINK_CLOSED)).toBeNull();
  });

  it("★ the close button is secondary until the link is copied, then primary", () => {
    // §9.1 settled on ONE guard rail: no confirm dialog, but the exit is not
    // made prominent until it is safe to take. That decision lives entirely in
    // this function, so it is asserted directly.
    expect(closeButtonVariant(open)).toBe("secondary");
    expect(closeButtonVariant(markCopied(open))).toBe("primary");
    expect(closeButtonVariant(INVITE_LINK_CLOSED)).toBe("secondary");
  });

  it("the expiry travels as data, so no screen can hard-code a duration", () => {
    // D-027 forbids printing "7 days": the TTL depends on the ROLE and is
    // recomputed server-side on every reissue.
    expect(open.status === "open" && open.expiresAt).toBe("2026-08-09T07:30:00.000Z");
  });

  it("marking a closed panel copied does nothing (no resurrection)", () => {
    expect(markCopied(INVITE_LINK_CLOSED)).toEqual({ status: "closed" });
  });
});
