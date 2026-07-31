import { describe, it, expect } from "vitest";
import {
  assertOwnerRemains,
  activeOwnersAfter,
  LastOwnerError,
  type OwnerMembership,
} from "./owner-invariant";

// F-002 · T-002-08 — U-CD-01 (test-plan §3) / data-model §6.
// Invariant: an org always keeps ≥ 1 ACTIVE Owner (architecture §5).
// "Owner" == the membership's role holds `full_access` (never the role name/key).

const OWNER_CAPS = ["full_access"] as const;
const STAFF_CAPS = ["manage_products", "manage_stock", "manage_orders"] as const;
const ADMIN_CAPS = ["manage_members", "manage_org_settings"] as const;

const owner = (userId: string, status: OwnerMembership["status"] = "active"): OwnerMembership => ({
  userId,
  status,
  capabilities: OWNER_CAPS,
});

describe("assertOwnerRemains — losing the last Owner", () => {
  it("blocks the only Owner demoting themselves", () => {
    expect(() =>
      assertOwnerRemains({
        owners: [owner("u1")],
        change: { kind: "role_change", userId: "u1", newRoleCapabilities: STAFF_CAPS },
      }),
    ).toThrow(LastOwnerError);
  });

  it("blocks the only Owner being revoked", () => {
    expect(() =>
      assertOwnerRemains({
        owners: [owner("u1")],
        change: { kind: "revoke", userId: "u1" },
      }),
    ).toThrow(LastOwnerError);
  });

  it("blocks the only Owner LEAVING on their own (D-029 — same fn, no second rule)", () => {
    // leave = revoke where the actor is the target; there is deliberately no
    // separate entry point, so this is byte-identical to the revoke case.
    expect(() =>
      assertOwnerRemains({
        owners: [owner("u1")],
        change: { kind: "revoke", userId: "u1" },
      }),
    ).toThrow(LastOwnerError);
  });

  it("throws a LastOwnerError carrying the LAST_OWNER code (→ 409 at the API edge)", () => {
    try {
      assertOwnerRemains({
        owners: [owner("u1")],
        change: { kind: "revoke", userId: "u1" },
      });
      expect.unreachable("expected LastOwnerError");
    } catch (err) {
      expect(err).toBeInstanceOf(LastOwnerError);
      expect((err as LastOwnerError).code).toBe("LAST_OWNER");
    }
  });
});

describe("assertOwnerRemains — a second ACTIVE Owner keeps the org safe", () => {
  it("allows demoting one of two Owners", () => {
    expect(() =>
      assertOwnerRemains({
        owners: [owner("u1"), owner("u2")],
        change: { kind: "role_change", userId: "u1", newRoleCapabilities: STAFF_CAPS },
      }),
    ).not.toThrow();
  });

  it("allows revoking one of two Owners", () => {
    expect(() =>
      assertOwnerRemains({
        owners: [owner("u1"), owner("u2")],
        change: { kind: "revoke", userId: "u2" },
      }),
    ).not.toThrow();
  });

  it("allows one of two Owners to leave (D-029)", () => {
    expect(() =>
      assertOwnerRemains({
        owners: [owner("u1"), owner("u2")],
        change: { kind: "revoke", userId: "u1" },
      }),
    ).not.toThrow();
  });
});

describe("assertOwnerRemains — only `active` memberships count", () => {
  it("does not count a `revoked` Owner (two rows, one active → blocked)", () => {
    expect(() =>
      assertOwnerRemains({
        owners: [owner("u1"), owner("u2", "revoked")],
        change: { kind: "revoke", userId: "u1" },
      }),
    ).toThrow(LastOwnerError);
  });

  it("does not count an `invited` Owner (dead state in Phase 0)", () => {
    expect(() =>
      assertOwnerRemains({
        owners: [owner("u1"), owner("u2", "invited")],
        change: { kind: "role_change", userId: "u1", newRoleCapabilities: ADMIN_CAPS },
      }),
    ).toThrow(LastOwnerError);
  });

  it("a role change never reactivates a revoked membership", () => {
    expect(() =>
      assertOwnerRemains({
        owners: [owner("u1", "revoked")],
        change: { kind: "role_change", userId: "u1", newRoleCapabilities: OWNER_CAPS },
      }),
    ).toThrow(LastOwnerError);
  });
});

describe("assertOwnerRemains — changes that do not reduce ownership", () => {
  it("allows promoting a non-Owner to Owner (target absent from `owners`)", () => {
    expect(() =>
      assertOwnerRemains({
        owners: [owner("u1")],
        change: { kind: "role_change", userId: "u2", newRoleCapabilities: OWNER_CAPS },
      }),
    ).not.toThrow();
    expect(
      activeOwnersAfter({
        owners: [owner("u1")],
        change: { kind: "role_change", userId: "u2", newRoleCapabilities: OWNER_CAPS },
      }),
    ).toEqual(["u1", "u2"]);
  });

  it("allows changing the role of a non-Owner (Staff → Admin)", () => {
    expect(() =>
      assertOwnerRemains({
        owners: [owner("u1")],
        change: { kind: "role_change", userId: "u9", newRoleCapabilities: ADMIN_CAPS },
      }),
    ).not.toThrow();
  });

  it("allows revoking a non-Owner, and allows a Staff member to leave", () => {
    expect(() =>
      assertOwnerRemains({
        owners: [owner("u1")],
        change: { kind: "revoke", userId: "u9" },
      }),
    ).not.toThrow();
  });

  it("allows moving an Owner onto another full_access role (count unchanged)", () => {
    expect(() =>
      assertOwnerRemains({
        owners: [owner("u1")],
        change: {
          kind: "role_change",
          userId: "u1",
          newRoleCapabilities: ["full_access", "view_financials"],
        },
      }),
    ).not.toThrow();
  });

  it("recognises ownership by capability, never by role name (custom F-003 role)", () => {
    const custom: OwnerMembership = {
      userId: "u2",
      status: "active",
      capabilities: ["view_financials", "full_access"],
    };
    expect(() =>
      assertOwnerRemains({
        owners: [owner("u1"), custom],
        change: { kind: "revoke", userId: "u1" },
      }),
    ).not.toThrow();
  });
});

describe("assertOwnerRemains — fail-closed + purity", () => {
  it("blocks every change when the org already has 0 active Owners (broken state)", () => {
    expect(() =>
      assertOwnerRemains({
        owners: [],
        change: { kind: "revoke", userId: "u9" },
      }),
    ).toThrow(LastOwnerError);
  });

  it("ignores rows in `owners` whose role does not hold full_access", () => {
    // Defensive: if a caller passes the whole membership list instead of just
    // owners, non-owner rows must not be counted as owners.
    const staff: OwnerMembership = { userId: "u2", status: "active", capabilities: STAFF_CAPS };
    expect(() =>
      assertOwnerRemains({
        owners: [owner("u1"), staff],
        change: { kind: "revoke", userId: "u1" },
      }),
    ).toThrow(LastOwnerError);
  });

  it("does not mutate its input", () => {
    const owners = Object.freeze([owner("u1"), owner("u2")]);
    const change = Object.freeze({ kind: "revoke", userId: "u2" } as const);
    activeOwnersAfter({ owners, change });
    expect(owners.map((o) => o.userId)).toEqual(["u1", "u2"]);
    expect(owners[1].status).toBe("active");
  });

  it("activeOwnersAfter is deterministic and duplicate-free", () => {
    const input = {
      owners: [owner("u1"), owner("u1")],
      change: { kind: "role_change", userId: "u1", newRoleCapabilities: OWNER_CAPS },
    } as const;
    expect(activeOwnersAfter(input)).toEqual(["u1"]);
    expect(activeOwnersAfter(input)).toEqual(activeOwnersAfter(input));
  });
});
