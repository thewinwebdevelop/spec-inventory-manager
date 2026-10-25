// F-003 · T-003-B05 ★ — `decideMemberAuthority` (architecture §1.1 · §13.6 ·
// D-034 · AC-5.3/5.4/5.6/5.8). test-plan U-RB-10 · U-RB-11 · U-RB-21.
//
// Every expectation below is computed from the RULE (hand-written tables or a
// set oracle written independently in this file), never by calling the fn
// under test twice — so a mutation of the fn cannot move both sides at once.
import { describe, it, expect } from "vitest";
import {
  decideMemberAuthority,
  MEMBER_AUTHORITY_OPS,
  type MemberAuthorityInput,
  type MemberAuthorityOp,
  type MemberAuthorityResult,
} from "./member-authority";
import type { RegistryLike } from "./registry";

/** Small registry with ONE implies edge (F-003 ships none — the mechanism is proven here). */
const REG: RegistryLike = [
  { key: "full_access", implies: [] },
  { key: "manage_members", implies: [] },
  { key: "manage_roles", implies: [] },
  { key: "manage_x", implies: ["view_x"] },
  { key: "view_x", implies: [] },
  { key: "y", implies: [] },
];

const TARGET_OPS = ["change_role", "remove", "reset_password", "write_held_role"] as const;
const GRANT_OPS = [
  "invite_create",
  "invite_reissue",
  "invite_cancel",
  "invite_accept_recheck",
] as const;

/** Build an input for `op` where `set` is on the axis that op is judged on. */
function onAxis(
  op: MemberAuthorityOp,
  actor: readonly string[],
  set: readonly string[],
  actorIsTarget = false,
): MemberAuthorityInput {
  switch (op) {
    case "change_role":
      // target-axis row: the new role is harmless ([] ⊆ anything).
      return {
        op,
        actorCapabilities: actor,
        actorIsTarget,
        targetCurrentCapabilities: set,
        grantCapabilities: [],
      };
    case "remove":
    case "reset_password":
    case "write_held_role":
      return { op, actorCapabilities: actor, actorIsTarget, targetCurrentCapabilities: set };
    default:
      return { op, actorCapabilities: actor, actorIsTarget: false, grantCapabilities: set };
  }
}

const decide = (i: MemberAuthorityInput) => decideMemberAuthority(i, REG);

const ADMIN = ["manage_members", "manage_x", "y"];
const OK: MemberAuthorityResult = { ok: true };
const notBelow = (relation: "equal" | "superset" | "incomparable", excess: string[]) => ({
  ok: false,
  reason: "target_not_below_actor",
  relation,
  excess,
});
const exceeds = (excess: string[]) => ({ ok: false, reason: "exceeds_actor", excess });
const OWNER_ONLY = { ok: false, reason: "owner_only", excess: ["full_access"] };
const FORBIDDEN = { ok: false, reason: "forbidden", excess: ["manage_members"] };

describe("U-RB-10 · decideMemberAuthority matrix (relation × 8 ops)", () => {
  it("the op list is exactly the 8 of architecture §1.1", () => {
    expect([...MEMBER_AUTHORITY_OPS].sort()).toEqual([...TARGET_OPS, ...GRANT_OPS].sort());
  });

  // relation name, actor, set on the axis, expected on TARGET ops, expected on GRANT ops
  const ROWS: [string, string[], string[], unknown, unknown][] = [
    ["⊂ proper", ADMIN, ["manage_members", "y"], OK, OK],
    ["= equal", ADMIN, ["y", "manage_x", "manage_members"], notBelow("equal", []), OK],
    [
      "⊃ superset",
      ADMIN,
      [...ADMIN, "manage_roles"],
      notBelow("superset", ["manage_roles"]),
      exceeds(["manage_roles"]),
    ],
    [
      "incomparable",
      ADMIN,
      ["manage_members", "manage_roles"],
      notBelow("incomparable", ["manage_roles"]),
      exceeds(["manage_roles"]),
    ],
    ["empty set", ADMIN, [], OK, OK],
    ["actor holds full_access", ["full_access"], [...ADMIN, "manage_roles"], OK, OK],
    // view_x is implied by the actor's manage_x ⇒ it is BELOW the actor.
    ["implied key only", ADMIN, ["view_x"], OK, OK],
    // written with the implied key spelled out — still EQUAL after expansion.
    ["= equal via implies", ADMIN, [...ADMIN, "view_x"], notBelow("equal", []), OK],
    // SR-11: an unregistered key is kept by expand ⇒ non-Owner fails closed…
    [
      "unknown key (non-Owner)",
      ADMIN,
      ["manage_members", "mystery"],
      notBelow("incomparable", ["mystery"]),
      exceeds(["mystery"]),
    ],
    // …and the Owner passes it through the explicit bypass, not by expansion.
    ["unknown key (Owner)", ["full_access"], ["manage_members", "mystery"], OK, OK],
  ];

  for (const [name, actor, set, onTarget, onGrant] of ROWS) {
    for (const op of TARGET_OPS) {
      it(`${name} · ${op}`, () => expect(decide(onAxis(op, actor, set))).toEqual(onTarget));
    }
    for (const op of GRANT_OPS) {
      it(`${name} · ${op}`, () => expect(decide(onAxis(op, actor, set))).toEqual(onGrant));
    }
  }

  it("change_role judged on the GRANT axis: new role ⊆ actor passes, ⊄ is exceeds_actor", () => {
    const i = (grant: string[]): MemberAuthorityInput => ({
      op: "change_role",
      actorCapabilities: ADMIN,
      actorIsTarget: false,
      targetCurrentCapabilities: ["y"],
      grantCapabilities: grant,
    });
    expect(decide(i(ADMIN))).toEqual(OK);
    expect(decide(i(["manage_x", "view_x"]))).toEqual(OK);
    expect(decide(i(["y", "manage_roles"]))).toEqual(exceeds(["manage_roles"]));
  });

  describe("Owner-only (D-030) — target or granted role holds full_access", () => {
    for (const op of ["change_role", "remove", "reset_password"] as const) {
      it(`${op}: Admin on an Owner target → owner_only · Owner → ok`, () => {
        expect(decide(onAxis(op, ADMIN, ["full_access"]))).toEqual(OWNER_ONLY);
        expect(decide(onAxis(op, ["full_access"], ["full_access"]))).toEqual(OK);
      });
    }
    for (const op of GRANT_OPS) {
      it(`${op}: Admin with an Owner role → owner_only · Owner → ok`, () => {
        expect(decide(onAxis(op, ADMIN, ["full_access"]))).toEqual(OWNER_ONLY);
        expect(decide(onAxis(op, ["full_access"], ["full_access"]))).toEqual(OK);
      });
    }
    it("change_role granting an Owner role → owner_only", () => {
      expect(
        decide({
          op: "change_role",
          actorCapabilities: ADMIN,
          actorIsTarget: false,
          targetCurrentCapabilities: ["y"],
          grantCapabilities: ["full_access"],
        }),
      ).toEqual(OWNER_ONLY);
    });
    it("write_held_role has no owner_only step (role_locked comes first in decideRoleWrite) — the target axis refuses", () => {
      expect(decide(onAxis("write_held_role", ADMIN, ["full_access"]))).toEqual(
        notBelow("superset", ["full_access", "manage_roles"]),
      );
    });
  });

  describe("floor manage_members on EVERY op (incl. invite_accept_recheck — D-035 P2 · write_held_role — Addendum 2)", () => {
    const noMembers = ["manage_roles", "manage_x", "y"];
    for (const op of MEMBER_AUTHORITY_OPS) {
      it(`${op}: actor without manage_members → forbidden even for a set far below them`, () => {
        expect(decide(onAxis(op, noMembers, ["y"]))).toEqual(FORBIDDEN);
        expect(decide(onAxis(op, [], []))).toEqual(FORBIDDEN);
      });
      it(`${op}: control — same set with manage_members added → ok`, () => {
        expect(decide(onAxis(op, [...noMembers, "manage_members"], ["y"]))).toEqual(OK);
      });
    }
  });

  describe("acting on yourself (architecture §1.1 — PATCH/DELETE own membership only)", () => {
    it("change_role on self: target axis skipped — grant ⊆ passes (demote yourself)", () => {
      expect(
        decide({
          op: "change_role",
          actorCapabilities: ADMIN,
          actorIsTarget: true,
          targetCurrentCapabilities: ADMIN,
          grantCapabilities: ["y"],
        }),
      ).toEqual(OK);
    });
    it("change_role on self: grant ⊄ is still refused (no self-promotion)", () => {
      expect(
        decide({
          op: "change_role",
          actorCapabilities: ADMIN,
          actorIsTarget: true,
          targetCurrentCapabilities: ADMIN,
          grantCapabilities: [...ADMIN, "manage_roles"],
        }),
      ).toEqual(exceeds(["manage_roles"]));
    });
    it("remove self: target axis skipped → ok", () => {
      expect(decide(onAxis("remove", ADMIN, ADMIN, true))).toEqual(OK);
    });
    it("reset_password on self: NOT relaxed → target_not_below_actor (equal)", () => {
      expect(decide(onAxis("reset_password", ADMIN, ADMIN, true))).toEqual(notBelow("equal", []));
    });
    it("write_held_role: actorIsTarget does not relax it either", () => {
      expect(decide(onAxis("write_held_role", ADMIN, ADMIN, true))).toEqual(notBelow("equal", []));
    });
    it("the floor still applies to yourself", () => {
      expect(decide(onAxis("remove", ["y"], ["y"], true))).toEqual(FORBIDDEN);
    });
  });

  it("a missing axis input is a programming error — thrown, never read as 'nothing to check'", () => {
    const broken = {
      op: "remove",
      actorCapabilities: ADMIN,
      actorIsTarget: false,
    } as unknown as MemberAuthorityInput;
    expect(() => decide(broken)).toThrow(/targetCurrentCapabilities/);
    const noGrant = {
      op: "invite_create",
      actorCapabilities: ADMIN,
      actorIsTarget: false,
    } as unknown as MemberAuthorityInput;
    expect(() => decide(noGrant)).toThrow(/grantCapabilities/);
    const unknownOp = {
      op: "promote",
      actorCapabilities: ADMIN,
      actorIsTarget: false,
    } as unknown as MemberAuthorityInput;
    expect(() => decide(unknownOp)).toThrow(/op/);
  });

  it("uses the shipped registry by default (Admin preset ⊋ Staff preset)", () => {
    const admin = [
      "manage_members",
      "manage_roles",
      "manage_products",
      "manage_stock",
      "manage_orders",
    ];
    const staff = ["manage_products", "manage_stock", "manage_orders"];
    expect(
      decideMemberAuthority({
        op: "remove",
        actorCapabilities: admin,
        actorIsTarget: false,
        targetCurrentCapabilities: staff,
      }),
    ).toEqual(OK);
    expect(
      decideMemberAuthority({
        op: "remove",
        actorCapabilities: admin,
        actorIsTarget: false,
        targetCurrentCapabilities: admin,
      }),
    ).toEqual(notBelow("equal", []));
  });

  it("does not mutate its input", () => {
    const actor = Object.freeze([...ADMIN]);
    const target = Object.freeze(["y", "view_x"]);
    const i = Object.freeze({
      op: "change_role" as const,
      actorCapabilities: actor,
      actorIsTarget: false,
      targetCurrentCapabilities: target,
      grantCapabilities: target,
    });
    expect(decide(i)).toEqual(OK);
    expect(target).toEqual(["y", "view_x"]);
  });
});

describe("U-RB-11 · fixed order: floor → owner_only → full_access bypass → target → grant", () => {
  it("floor before owner_only", () => {
    expect(decide(onAxis("change_role", ["y"], ["full_access"]))).toEqual(FORBIDDEN);
  });
  it("owner_only before the target axis", () => {
    expect(decide(onAxis("remove", ADMIN, ["full_access", "mystery"]))).toEqual(OWNER_ONLY);
  });
  it("owner_only on the granted role before the target axis", () => {
    expect(
      decide({
        op: "change_role",
        actorCapabilities: ADMIN,
        actorIsTarget: false,
        targetCurrentCapabilities: ADMIN,
        grantCapabilities: ["full_access"],
      }),
    ).toEqual(OWNER_ONLY);
  });
  it("full_access bypass before target/grant (a stale unknown key does not lock the Owner out — SR-11)", () => {
    expect(
      decide({
        op: "change_role",
        actorCapabilities: ["full_access"],
        actorIsTarget: false,
        targetCurrentCapabilities: ["mystery"],
        grantCapabilities: ["other_mystery"],
      }),
    ).toEqual(OK);
  });
  it("target before grant: wrong on BOTH axes → the target reason", () => {
    expect(
      decide({
        op: "change_role",
        actorCapabilities: ADMIN,
        actorIsTarget: false,
        targetCurrentCapabilities: ADMIN,
        grantCapabilities: [...ADMIN, "manage_roles"],
      }),
    ).toEqual(notBelow("equal", []));
  });
  it("relation + excess: excess = expand(target) \\ expand(actor), sorted; empty when equal", () => {
    expect(
      decide(onAxis("remove", ["manage_members", "view_x"], ["manage_x", "y", "manage_members"])),
    ).toEqual(notBelow("superset", ["manage_x", "y"]));
    expect(decide(onAxis("remove", ["manage_members", "y"], ["manage_x"]))).toEqual(
      notBelow("incomparable", ["manage_x", "view_x"]),
    );
    expect(decide(onAxis("remove", ADMIN, [...ADMIN]))).toEqual(notBelow("equal", []));
  });
  it("grant excess = expand(grant) \\ expand(actor), sorted", () => {
    expect(decide(onAxis("invite_create", ["manage_members"], ["y", "manage_x"]))).toEqual(
      exceeds(["manage_x", "view_x", "y"]),
    );
  });
});

// ── U-RB-21 property — independent set oracle over every subset pair ───────
const KEYS = ["manage_members", "manage_roles", "manage_x", "view_x", "y"] as const;
const SUBSETS: string[][] = Array.from({ length: 1 << KEYS.length }, (_, m) =>
  KEYS.filter((_, i) => m & (1 << i)),
);
/** Expansion written independently of the fn under test (REG has one edge). */
const ex = (s: readonly string[]) => new Set(s.includes("manage_x") ? [...s, "view_x"] : s);
const below = (t: readonly string[], a: readonly string[]) => {
  const et = ex(t);
  const ea = ex(a);
  return [...et].every((k) => ea.has(k)) && et.size < ea.size;
};

describe("U-RB-21 · property: ¬(T ⊊ A) ∧ A ∌ full_access ∧ ¬actorIsTarget ⇒ touch-person ops refused for EVERY grant", () => {
  it("holds over every (actor, target, grant) subset triple of the fixture registry", () => {
    let refusedChecked = 0;
    let passedControl = 0;
    const leaks: string[] = [];
    for (const a of SUBSETS) {
      for (const t of SUBSETS) {
        if (below(t, a)) {
          // control half: a target strictly below a manage_members actor is reachable.
          if (a.includes("manage_members") && decide(onAxis("remove", a, t)).ok) passedControl++;
          continue;
        }
        for (const op of ["remove", "reset_password"] as const) {
          refusedChecked++;
          if (decide(onAxis(op, a, t)).ok) leaks.push(`${op} A=${a} T=${t}`);
        }
        for (const g of SUBSETS) {
          refusedChecked++;
          const r = decide({
            op: "change_role",
            actorCapabilities: a,
            actorIsTarget: false,
            targetCurrentCapabilities: t,
            grantCapabilities: g,
          });
          if (r.ok) leaks.push(`change_role A=${a} T=${t} G=${g}`);
        }
      }
    }
    expect(leaks.slice(0, 5)).toEqual([]);
    // non-vacuity: both halves of the space were actually exercised.
    expect(refusedChecked).toBeGreaterThan(10_000);
    expect(passedControl).toBeGreaterThan(20);
  });
});
