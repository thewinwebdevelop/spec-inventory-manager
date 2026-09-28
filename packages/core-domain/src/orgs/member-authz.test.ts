import { describe, it, expect } from "vitest";
import { canAssignRole, isOwnerRole } from "./member-authz";
import { decideMemberAuthority, type MemberAuthorityInput } from "../rbac/member-authority";

// F-002 · T-002-08 — U-CD-02 (test-plan §3) + the 8 mandatory cases of
// data-model §6. Rule under test: only `full_access` may create or touch an
// Owner (C-1 / D-028). Capability lists mirror data-model §5.2 exactly.

const OWNER_CAPS = ["full_access"] as const;
const ADMIN_CAPS = [
  "manage_members",
  "manage_org_settings",
  "manage_products",
  "manage_stock",
  "manage_channels",
  "manage_orders",
  "view_financials",
] as const;
const STAFF_CAPS = ["manage_products", "manage_stock", "manage_orders"] as const;

describe("isOwnerRole (data-model §5.2 — 'is Owner' == has full_access)", () => {
  it("is true for the system Owner capability set", () => {
    expect(isOwnerRole(OWNER_CAPS)).toBe(true);
  });

  it("is true for a custom role that holds full_access under any name (F-003)", () => {
    expect(isOwnerRole(["view_financials", "full_access"])).toBe(true);
  });

  it("is false for Admin / Staff / empty — manage_members is NOT ownership", () => {
    expect(isOwnerRole(ADMIN_CAPS)).toBe(false);
    expect(isOwnerRole(STAFF_CAPS)).toBe(false);
    expect(isOwnerRole([])).toBe(false);
  });
});

describe("canAssignRole — 8 mandatory cases (data-model §6)", () => {
  it("① Admin changes Staff → Staff: allowed", () => {
    expect(
      canAssignRole({
        actorCapabilities: ADMIN_CAPS,
        targetIsOwner: false,
        newRoleIsOwner: false,
      }),
    ).toBe(true);
  });

  it("② Admin promotes someone else to Owner: denied", () => {
    expect(
      canAssignRole({
        actorCapabilities: ADMIN_CAPS,
        targetIsOwner: false,
        newRoleIsOwner: true,
      }),
    ).toBe(false);
  });

  it("③ Admin promotes THEMSELVES to Owner: denied (the core C-1 case)", () => {
    // Self-promotion is the same shape as ② — the fn must not need to know who
    // the target is; that is exactly why it cannot be bypassed by aiming at self.
    expect(
      canAssignRole({
        actorCapabilities: ADMIN_CAPS,
        targetIsOwner: false,
        newRoleIsOwner: true,
      }),
    ).toBe(false);
  });

  it("④ Admin demotes an Owner to Staff: denied", () => {
    expect(
      canAssignRole({
        actorCapabilities: ADMIN_CAPS,
        targetIsOwner: true,
        newRoleIsOwner: false,
      }),
    ).toBe(false);
  });

  it("⑤ Admin revokes an Owner (newRoleIsOwner=false): denied", () => {
    expect(
      canAssignRole({
        actorCapabilities: ADMIN_CAPS,
        targetIsOwner: true,
        newRoleIsOwner: false,
      }),
    ).toBe(false);
  });

  it("⑥ Owner may do ②–⑤ — every combination is allowed", () => {
    for (const targetIsOwner of [false, true]) {
      for (const newRoleIsOwner of [false, true]) {
        expect(
          canAssignRole({
            actorCapabilities: OWNER_CAPS,
            targetIsOwner,
            newRoleIsOwner,
          }),
        ).toBe(true);
      }
    }
  });

  it("⑦ actor has manage_members but not full_access + new role holds full_access: denied", () => {
    // A custom F-003 role named anything at all, holding full_access.
    expect(
      canAssignRole({
        actorCapabilities: ["manage_members"],
        targetIsOwner: false,
        newRoleIsOwner: true,
      }),
    ).toBe(false);
  });

  it("⑧ empty actorCapabilities: denied in every combination", () => {
    for (const targetIsOwner of [false, true]) {
      for (const newRoleIsOwner of [false, true]) {
        expect(
          canAssignRole({
            actorCapabilities: [],
            targetIsOwner,
            newRoleIsOwner,
          }),
        ).toBe(false);
      }
    }
  });
});

describe("canAssignRole — qa additions (U-CD-02 ⑨⑩)", () => {
  it("⑨ actor holding full_access AND manage_members: allowed in every combination", () => {
    for (const targetIsOwner of [false, true]) {
      for (const newRoleIsOwner of [false, true]) {
        expect(
          canAssignRole({
            actorCapabilities: ["full_access", "manage_members"],
            targetIsOwner,
            newRoleIsOwner,
          }),
        ).toBe(true);
      }
    }
  });

  it("⑩ Admin moves an Owner onto another Owner-capable role: denied", () => {
    expect(
      canAssignRole({
        actorCapabilities: ADMIN_CAPS,
        targetIsOwner: true,
        newRoleIsOwner: true,
      }),
    ).toBe(false);
  });
});

describe("canAssignRole — call-site shapes (architecture §3.2 table)", () => {
  it("Staff (no manage_members) is denied even for an ordinary role change", () => {
    // Defence in depth: the CapabilityGuard already blocks this, but the pure fn
    // must not be the layer that says "yes" to a caller with no member powers.
    expect(
      canAssignRole({
        actorCapabilities: STAFF_CAPS,
        targetIsOwner: false,
        newRoleIsOwner: false,
      }),
    ).toBe(false);
  });

  it("create-invite with an Owner role: Admin denied, Owner allowed (targetIsOwner=false)", () => {
    const invite = (actorCapabilities: readonly string[]) =>
      canAssignRole({ actorCapabilities, targetIsOwner: false, newRoleIsOwner: true });
    expect(invite(ADMIN_CAPS)).toBe(false);
    expect(invite(OWNER_CAPS)).toBe(true);
  });

  it("admin-reset of an Owner (NEW-1/D-030): Admin denied, Owner allowed", () => {
    const reset = (actorCapabilities: readonly string[]) =>
      canAssignRole({ actorCapabilities, targetIsOwner: true, newRoleIsOwner: false });
    expect(reset(ADMIN_CAPS)).toBe(false);
    expect(reset(OWNER_CAPS)).toBe(true);
  });

  it("does not mutate or depend on capability order", () => {
    const caps = Object.freeze(["manage_members", "full_access"]);
    expect(
      canAssignRole({ actorCapabilities: caps, targetIsOwner: true, newRoleIsOwner: true }),
    ).toBe(true);
    expect(caps).toEqual(["manage_members", "full_access"]);
  });
});

// ── F-003 · T-003-B05 — the wrapper and the F-002 regression (U-RB-15) ──────
// `canAssignRole` has no logic of its own any more: it is
// `decideMemberAuthority(...).ok` with the Owner-ness booleans turned into
// capability sets. The F-002 formula is written out below as the ORACLE — the
// literal rule that shipped — so "every case F-002 refused is still refused,
// and still as FORBIDDEN" is checked against history, not against itself.

/** The rule F-002 shipped (F-002 architecture §3.2 + the manage_members floor). */
function f002CanAssignRole(
  actor: readonly string[],
  targetIsOwner: boolean,
  newRoleIsOwner: boolean,
): boolean {
  const owner = actor.includes("full_access");
  return targetIsOwner || newRoleIsOwner ? owner : owner || actor.includes("manage_members");
}

const ACTORS: readonly (readonly string[])[] = [
  [],
  OWNER_CAPS,
  ADMIN_CAPS,
  STAFF_CAPS,
  ["manage_members"],
  ["full_access", "manage_members"],
  ["manage_members", "mystery_key"],
  ["view_financials"],
];
const BOOLS = [false, true] as const;

describe("U-RB-15 · canAssignRole === decideMemberAuthority(...).ok (wrapper, no logic of its own)", () => {
  it("every (actor, targetIsOwner, newRoleIsOwner) — same answer as the fn it wraps", () => {
    let n = 0;
    for (const actorCapabilities of ACTORS)
      for (const targetIsOwner of BOOLS)
        for (const newRoleIsOwner of BOOLS) {
          const wrapped = decideMemberAuthority({
            op: "change_role",
            actorCapabilities,
            actorIsTarget: false,
            targetCurrentCapabilities: targetIsOwner ? ["full_access"] : [],
            grantCapabilities: newRoleIsOwner ? ["full_access"] : [],
          }).ok;
          expect(canAssignRole({ actorCapabilities, targetIsOwner, newRoleIsOwner })).toBe(wrapped);
          n++;
        }
    expect(n).toBe(ACTORS.length * 4);
  });

  it("…and it still gives F-002's answer in every one of those cases (legacy call sites keep their behaviour until B17/B18 move them)", () => {
    for (const actorCapabilities of ACTORS)
      for (const targetIsOwner of BOOLS)
        for (const newRoleIsOwner of BOOLS)
          expect(
            canAssignRole({ actorCapabilities, targetIsOwner, newRoleIsOwner }),
            `actor=${actorCapabilities} tOwner=${targetIsOwner} nOwner=${newRoleIsOwner}`,
          ).toBe(f002CanAssignRole(actorCapabilities, targetIsOwner, newRoleIsOwner));
  });
});

describe("F-002 regression (api-spec §4.3 'ลำดับ code') — every case F-002 refused is still refused as FORBIDDEN, never as a new code", () => {
  // Whatever the target/grant hold, if F-002 said no, the new rule must say
  // forbidden | owner_only (→ 403 FORBIDDEN, byte-identical) — the Owner case
  // wins over TARGET_NOT_BELOW_ACTOR / ROLE_EXCEEDS_ACTOR.
  const SETS: readonly (readonly string[])[] = [
    [],
    OWNER_CAPS,
    ADMIN_CAPS,
    STAFF_CAPS,
    ["manage_members"],
    ["manage_products", "full_access"],
    ["manage_members", "manage_roles"],
    ["mystery_key"],
  ];
  const TOUCHES_TARGET = new Set(["change_role", "remove", "reset_password"]);
  const GRANTS = new Set(["change_role", "invite_create", "invite_reissue"]);

  function inputFor(
    op: "change_role" | "remove" | "reset_password" | "invite_create" | "invite_reissue",
    actorCapabilities: readonly string[],
    t: readonly string[],
    g: readonly string[],
  ): MemberAuthorityInput {
    const base = { actorCapabilities, actorIsTarget: false };
    if (op === "change_role")
      return { ...base, op, targetCurrentCapabilities: t, grantCapabilities: g };
    if (op === "remove" || op === "reset_password")
      return { ...base, op, targetCurrentCapabilities: t };
    return { ...base, op, grantCapabilities: g };
  }

  it("holds for every op F-002 ruled on × actor × target × grant", () => {
    let refusedByF002 = 0;
    for (const op of [
      "change_role",
      "remove",
      "reset_password",
      "invite_create",
      "invite_reissue",
    ] as const)
      for (const actor of ACTORS)
        for (const t of SETS)
          for (const g of SETS) {
            const targetIsOwner = TOUCHES_TARGET.has(op) && isOwnerRole(t);
            const newRoleIsOwner = GRANTS.has(op) && isOwnerRole(g);
            if (f002CanAssignRole(actor, targetIsOwner, newRoleIsOwner)) continue;
            refusedByF002++;
            const r = decideMemberAuthority(inputFor(op, actor, t, g));
            const label = `${op} actor=${actor} t=${t} g=${g}`;
            expect(r.ok, label).toBe(false);
            if (!r.ok) expect(["forbidden", "owner_only"], label).toContain(r.reason);
          }
    expect(refusedByF002).toBeGreaterThan(500); // non-vacuity
  });
});
