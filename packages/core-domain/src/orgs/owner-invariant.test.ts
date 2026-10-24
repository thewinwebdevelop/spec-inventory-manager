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

const OWNER_ROLE_ID = "rol_owner";

const owner = (
  userId: string,
  status: OwnerMembership["status"] = "active",
  roleId: string = OWNER_ROLE_ID,
): OwnerMembership => ({
  userId,
  roleId,
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
      roleId: "rol_custom",
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
    const staff: OwnerMembership = {
      userId: "u2",
      roleId: "rol_staff",
      status: "active",
      capabilities: STAFF_CAPS,
    };
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

// ---------------------------------------------------------------------------
// F-003 · T-003-B07 ★ — `OwnerChange` shapes 3/4 (architecture §2 · §13.1 ·
// test-plan §2.2 U-OI-01..12 · AC-4.3). Editing / deleting a ROLE can leave the
// org with zero Owners without touching a single membership, so the invariant
// has to see the change at the role level.
// ---------------------------------------------------------------------------

const ADMIN_ROLE_ID = "rol_admin";
const CUSTOM_OWNER_ROLE_ID = "rol_owner_b";
const STAFF_ROLE_ID = "rol_staff";

const member = (
  userId: string,
  roleId: string,
  capabilities: readonly string[],
  status: OwnerMembership["status"] = "active",
): OwnerMembership => ({ userId, roleId, status, capabilities });

describe("U-OI · shape 3 `role_capabilities_change`", () => {
  it("U-OI-01 throws when the only Owner's role loses full_access", () => {
    expect(() =>
      assertOwnerRemains({
        owners: [owner("u1")],
        change: {
          kind: "role_capabilities_change",
          roleId: OWNER_ROLE_ID,
          newCapabilities: ADMIN_CAPS,
        },
      }),
    ).toThrow(LastOwnerError);
  });

  it("U-OI-02 throws when TWO Owners share the role and the whole role loses full_access", () => {
    const input = {
      owners: [owner("u1"), owner("u2")],
      change: {
        kind: "role_capabilities_change",
        roleId: OWNER_ROLE_ID,
        newCapabilities: STAFF_CAPS,
      },
    } as const;
    expect(activeOwnersAfter(input)).toEqual([]);
    expect(() => assertOwnerRemains(input)).toThrow(LastOwnerError);
  });

  it("U-OI-03 passes when two Owners hold DIFFERENT roles and one role loses full_access", () => {
    const input = {
      owners: [owner("u1"), owner("u2", "active", CUSTOM_OWNER_ROLE_ID)],
      change: {
        kind: "role_capabilities_change",
        roleId: OWNER_ROLE_ID,
        newCapabilities: ADMIN_CAPS,
      },
    } as const;
    expect(activeOwnersAfter(input)).toEqual(["u2"]);
    expect(() => assertOwnerRemains(input)).not.toThrow();
  });

  it("U-OI-04 passes when no Owner holds the edited role", () => {
    const input = {
      owners: [owner("u1"), member("u2", STAFF_ROLE_ID, STAFF_CAPS)],
      change: {
        kind: "role_capabilities_change",
        roleId: STAFF_ROLE_ID,
        newCapabilities: ["manage_products"],
      },
    } as const;
    expect(activeOwnersAfter(input)).toEqual(["u1"]);
    expect(() => assertOwnerRemains(input)).not.toThrow();
  });

  it("U-OI-05 throws when the org already has 0 active Owners", () => {
    expect(() =>
      assertOwnerRemains({
        owners: [owner("u1", "revoked"), member("u2", STAFF_ROLE_ID, STAFF_CAPS)],
        change: {
          kind: "role_capabilities_change",
          roleId: STAFF_ROLE_ID,
          newCapabilities: ["manage_products"],
        },
      }),
    ).toThrow(LastOwnerError);
  });

  it("control for U-OI-01: an edit that keeps full_access keeps the Owner", () => {
    expect(() =>
      assertOwnerRemains({
        owners: [owner("u1")],
        change: {
          kind: "role_capabilities_change",
          roleId: OWNER_ROLE_ID,
          newCapabilities: ["full_access", "view_financials"],
        },
      }),
    ).not.toThrow();
  });
});

describe("U-OI · shape 4 `role_delete`", () => {
  it("U-OI-06 passes when nobody holds the deleted role", () => {
    const input = {
      owners: [owner("u1")],
      change: { kind: "role_delete", roleId: STAFF_ROLE_ID },
    } as const;
    expect(activeOwnersAfter(input)).toEqual(["u1"]);
    expect(() => assertOwnerRemains(input)).not.toThrow();
  });

  it("U-OI-07 throws when the only Owner holds the deleted role", () => {
    expect(() =>
      assertOwnerRemains({
        owners: [owner("u1")],
        change: { kind: "role_delete", roleId: OWNER_ROLE_ID },
      }),
    ).toThrow(LastOwnerError);
  });

  it("U-OI-08 passes when another Owner holds a different role", () => {
    const input = {
      owners: [owner("u1"), owner("u2", "active", CUSTOM_OWNER_ROLE_ID)],
      change: { kind: "role_delete", roleId: OWNER_ROLE_ID },
    } as const;
    expect(activeOwnersAfter(input)).toEqual(["u2"]);
    expect(() => assertOwnerRemains(input)).not.toThrow();
  });

  it("U-OI-09 throws when the org already has 0 active Owners", () => {
    expect(() =>
      assertOwnerRemains({
        owners: [owner("u1", "revoked")],
        change: { kind: "role_delete", roleId: STAFF_ROLE_ID },
      }),
    ).toThrow(LastOwnerError);
  });

  it("U-OI-10 passes when the deleted role is held only by a REVOKED former Owner (active only counts)", () => {
    const input = {
      owners: [owner("u1"), owner("u2", "revoked", CUSTOM_OWNER_ROLE_ID)],
      change: { kind: "role_delete", roleId: CUSTOM_OWNER_ROLE_ID },
    } as const;
    expect(activeOwnersAfter(input)).toEqual(["u1"]);
    expect(() => assertOwnerRemains(input)).not.toThrow();
  });
});

describe("U-OI-11 · F-002 shapes 1/2 are untouched by roleId", () => {
  // The whole F-002 matrix above still runs unchanged (regression). This adds
  // the one thing roleId could break: a userId-shaped change must hit ONLY
  // that user, never the other holders of the same role.
  it("role_change of one Owner does not demote a role-mate", () => {
    const input = {
      owners: [owner("u1"), owner("u2")],
      change: { kind: "role_change", userId: "u1", newRoleCapabilities: STAFF_CAPS },
    } as const;
    expect(activeOwnersAfter(input)).toEqual(["u2"]);
  });

  it("revoke of one Owner does not remove a role-mate", () => {
    const input = {
      owners: [owner("u1"), owner("u2")],
      change: { kind: "revoke", userId: "u2" },
    } as const;
    expect(activeOwnersAfter(input)).toEqual(["u1"]);
  });
});

describe("U-OI-12 · input contract non-vacuity (type half: owner-invariant.compile-test.ts)", () => {
  it("U-OI-02 depends on the role's memberships being in the input WITH their roleId", () => {
    // The same two Owners, but the fixture "forgot" that u2 holds the edited
    // role (mislabelled roleId). U-OI-02's `toThrow` would go red on this
    // input — the decision really is driven by `roleId`, not by the fixture.
    const forgotten = {
      owners: [owner("u1"), owner("u2", "active", "rol_wrong")],
      change: {
        kind: "role_capabilities_change",
        roleId: OWNER_ROLE_ID,
        newCapabilities: STAFF_CAPS,
      },
    } as const;
    expect(activeOwnersAfter(forgotten)).toEqual(["u2"]);
    expect(() => assertOwnerRemains(forgotten)).not.toThrow();
  });

  it("members of the edited role are read with the NEW capabilities, not their stale ones", () => {
    // Input contract (architecture §2): owners ∪ every membership of the edited
    // role. A non-Owner row of that role is evaluated with `newCapabilities` —
    // the count follows the edit, not the pre-edit snapshot. (Granting
    // full_access is refused upstream by FULL_ACCESS_RESERVED; this pins the
    // pure fn's arithmetic only.)
    const input = {
      owners: [owner("u1"), member("u2", ADMIN_ROLE_ID, ADMIN_CAPS)],
      change: {
        kind: "role_capabilities_change",
        roleId: ADMIN_ROLE_ID,
        newCapabilities: ["full_access"],
      },
    } as const;
    expect(activeOwnersAfter(input)).toEqual(["u1", "u2"]);
  });
});
