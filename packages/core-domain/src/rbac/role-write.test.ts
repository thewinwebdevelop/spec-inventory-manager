// F-003 · T-003-B06 ★ — `decideRoleWrite` (architecture §1 row `decideRoleWrite`
// · §1.3 · §13.6 table · D-034 Addendum + Addendum 2 · AC-4.1/5.1/5.6/5.8 ·
// SR-08/SR-17). test-plan U-RB-12 · U-RB-13.
//
// Every expectation is written from the RULE (the §13.6 table by hand, plus a
// set oracle implemented independently in this file) — never by calling the
// fn under test twice, so a mutation cannot move both sides at once.
import { describe, it, expect } from "vitest";
import {
  decideRoleWrite,
  ROLE_WRITE_OPS,
  type RoleWriteInput,
  type RoleWriteResult,
} from "./role-write";
import {
  validateRoleCapabilities,
  type ValidatableRegistry,
  type ValidatedCapabilities,
} from "./role-validation";

/** Small registry with ONE implies edge, plus `w` that no non-Owner actor below holds. */
const sel = { tier: "all", selectable: true } as const;
const REG: ValidatableRegistry = [
  { key: "full_access", implies: [], tier: "full", selectable: false },
  { key: "manage_members", implies: [], ...sel },
  { key: "manage_roles", implies: [], ...sel },
  { key: "manage_x", implies: ["view_x"], ...sel },
  { key: "view_x", implies: [], ...sel },
  { key: "y", implies: [], ...sel },
  { key: "w", implies: [], ...sel },
];

/**
 * `next` is `ValidatedCapabilities` (security review L-1): build it with the
 * REAL constructor whenever the list is valid. Lists validation would refuse
 * (empty, unknown key, `full_access`) are FORGED here on purpose — they model a
 * call site that cast the brand, and the fn must still fail closed on them.
 */
function next(caps: readonly string[]): ValidatedCapabilities {
  const v = validateRoleCapabilities(caps, REG);
  return v.ok ? v.capabilities : (caps as unknown as ValidatedCapabilities);
}

const decide = (i: RoleWriteInput) => decideRoleWrite(i, REG);

// Actors (§13.6 vocabulary)
const OWNER = ["full_access"];
/** Admin A — `manage_members` + `manage_roles` + data caps. */
const A = ["manage_members", "manage_roles", "manage_x", "y"];
/** M — role designer: `manage_roles` WITHOUT `manage_members` (Addendum 2). */
const M = ["manage_roles", "manage_x", "y"];
/** M′ = M + `manage_members` (control of row 13). */
const M_PRIME = [...M, "manage_members"];

const A_MINUS_ONE = ["manage_members", "manage_roles", "manage_x"]; // A without y
const BELOW_A = ["manage_roles", "y"]; // ⊊ A
const BELOW_M = ["manage_x"]; // R_T ⊊ M
const M_MINUS_ONE = ["manage_roles", "manage_x"]; // M without y

const custom = (capabilities: readonly string[]) => ({ isSystem: false, capabilities });

const OK: RoleWriteResult = { ok: true };
const TNBA_EQUAL: RoleWriteResult = {
  ok: false,
  reason: "target_not_below_actor",
  relation: "equal",
  excess: [],
};
const REQUIRES_MM: RoleWriteResult = { ok: false, reason: "requires_manage_members" };
const LOCKED: RoleWriteResult = { ok: false, reason: "role_locked" };
const FORBIDDEN: RoleWriteResult = {
  ok: false,
  reason: "forbidden",
  excess: ["manage_roles"],
};
const exceeds = (excess: string[]): RoleWriteResult => ({
  ok: false,
  reason: "exceeds_actor",
  excess,
});

const update = (
  actorCapabilities: readonly string[],
  before: readonly string[],
  after: readonly string[] | undefined,
  otherActiveHolders: number,
): RoleWriteInput =>
  after === undefined
    ? // rename-only: the call site passes the role's CURRENT caps explicitly (review M-1)
      {
        op: "update",
        actorCapabilities,
        role: custom(before),
        next: "unchanged",
        otherActiveHolders,
      }
    : {
        op: "update",
        actorCapabilities,
        role: custom(before),
        next: next(after),
        otherActiveHolders,
      };
const del = (
  actorCapabilities: readonly string[],
  before: readonly string[],
  otherActiveHolders: number,
): RoleWriteInput => ({
  op: "delete",
  actorCapabilities,
  role: custom(before),
  otherActiveHolders,
});
const create = (actorCapabilities: readonly string[], caps: readonly string[]): RoleWriteInput => ({
  op: "create",
  actorCapabilities,
  next: next(caps),
  otherActiveHolders: 0,
});

describe("U-RB-12 · decideRoleWrite = architecture §13.6 D-034 Addendum table (rows 1–21)", () => {
  // [row, description, input, expected]
  const rows: [string, string, RoleWriteInput, RoleWriteResult][] = [
    [
      "R01",
      "Admin A · `Admin` = A → drop 1 cap · Admin B holds",
      update(A, A, A_MINUS_ONE, 1),
      TNBA_EQUAL,
    ],
    [
      "R02",
      "Admin A · `Admin` = A → drop 1 cap · A is the only holder",
      update(A, A, A_MINUS_ONE, 0),
      OK,
    ],
    [
      "R03",
      "Admin A · custom R_B = A → reduce · B holds",
      update(A, A, ["manage_roles"], 1),
      TNBA_EQUAL,
    ],
    [
      "R04",
      'Admin A · custom R_B = A → rename only (next = "unchanged" sentinel) · B holds',
      update(A, A, undefined, 1),
      TNBA_EQUAL,
    ],
    [
      "R05",
      "Admin A · custom R_B = A → same caps (no-op) · B holds",
      update(A, A, A, 1),
      TNBA_EQUAL,
    ],
    ["R06", "Admin A · R ⊊ A → raise to = A · B holds", update(A, BELOW_A, A, 1), OK],
    ["R07", "Admin A · R ⊊ A → reduce · B holds", update(A, BELOW_A, ["y"], 1), OK],
    [
      "R08a",
      "Admin A · R ⊄ A (incomparable) · B holds",
      update(A, ["y", "w"], ["y"], 1),
      exceeds(["w"]),
    ],
    [
      "R08b",
      "Admin A · R ⊄ A (incomparable) · no holder",
      update(A, ["y", "w"], ["y"], 0),
      exceeds(["w"]),
    ],
    ["R08c", "Admin A · R ⊋ A (superset) · B holds", update(A, [...A, "w"], A, 1), exceeds(["w"])],
    [
      "R08d",
      "Admin A · R ⊊ A → after ⊄ A · B holds",
      update(A, BELOW_A, ["y", "w"], 1),
      exceeds(["w"]),
    ],
    ["R09", "Admin A · DELETE R_B = A · B holds", del(A, A, 1), TNBA_EQUAL],
    [
      "R10",
      "Admin A · DELETE R ⊊ A · B holds (ROLE_IN_USE is the service's, after)",
      del(A, BELOW_A, 1),
      OK,
    ],
    ["R11", "Owner · `Admin` → reduce · many Admins hold", update(OWNER, A, A_MINUS_ONE, 5), OK],
    [
      "R12",
      "Admin A · R_B = A · B revoked / only a pending invite (counted as 0)",
      update(A, A, A_MINUS_ONE, 0),
      OK,
    ],
    ["R13", "M · R_T ⊊ M → reduce · T holds", update(M, BELOW_M, ["view_x"], 1), REQUIRES_MM],
    ["R14a", "M · R_T ⊊ M → rename only · T holds", update(M, BELOW_M, undefined, 1), REQUIRES_MM],
    ["R14b", "M · R_T ⊊ M → no-op · T holds", update(M, BELOW_M, BELOW_M, 1), REQUIRES_MM],
    ["R15", "M · DELETE R_T ⊊ M · T holds", del(M, BELOW_M, 1), REQUIRES_MM],
    [
      "R16",
      "M · R = M → reduce · T holds (floor before target)",
      update(M, M, M_MINUS_ONE, 1),
      REQUIRES_MM,
    ],
    [
      "R17",
      "M · R ⊄ M · T holds (exceeds before floor)",
      update(M, ["manage_members"], [], 1),
      exceeds(["manage_members"]),
    ],
    ["R18", "M · R ⊊ M → reduce · no other holder", update(M, BELOW_M, ["view_x"], 0), OK],
    ["R19", "M · clone R_T (create — a new role has no holder)", create(M, BELOW_M), OK],
    [
      "R20",
      "M′ = M + manage_members · R_T ⊊ M′ → reduce · T holds (control of R13)",
      update(M_PRIME, BELOW_M, ["view_x"], 1),
      OK,
    ],
    ["R21", "Owner · R_T → reduce · T holds", update(OWNER, BELOW_M, ["view_x"], 1), OK],
  ];

  it.each(rows)("%s · %s", (_row, _desc, input, expected) => {
    expect(decide(input)).toEqual(expected);
  });

  it("non-vacuity: every reason of the fn is produced by the table above", () => {
    const seen = new Set(rows.map(([, , i]) => decide(i)).map((r) => (r.ok ? "ok" : r.reason)));
    expect([...seen].sort()).toEqual(
      ["exceeds_actor", "ok", "requires_manage_members", "target_not_below_actor"].sort(),
    );
  });
});

describe("U-RB-12 · the 8 extra rows (floor · lock · bypass · create · holder counts)", () => {
  it("+1 floor `manage_roles` (SR-08): an actor without it is `forbidden` on every op — even with manage_members", () => {
    const noRoles = ["manage_members", "manage_x", "y"];
    expect(decide(create(noRoles, ["y"]))).toEqual(FORBIDDEN);
    expect(decide(update(noRoles, ["y"], [], 0))).toEqual(FORBIDDEN);
    expect(decide(del(noRoles, ["y"], 0))).toEqual(FORBIDDEN);
    expect(decide(create([], ["y"]))).toEqual(FORBIDDEN);
  });

  it("+2 `isSystem` role → `role_locked` on update (incl. rename-only) and delete, for Admin and Owner (AC-4.1)", () => {
    const ownerRole = { isSystem: true, capabilities: ["full_access"] };
    for (const actor of [A, OWNER]) {
      expect(
        decide({
          op: "update",
          actorCapabilities: actor,
          role: ownerRole,
          next: next(["y"]),
          otherActiveHolders: 0,
        }),
      ).toEqual(LOCKED);
      expect(
        decide({
          op: "update",
          actorCapabilities: actor,
          role: ownerRole,
          next: "unchanged",
          otherActiveHolders: 0,
        }),
      ).toEqual(LOCKED);
      expect(
        decide({ op: "delete", actorCapabilities: actor, role: ownerRole, otherActiveHolders: 3 }),
      ).toEqual(LOCKED);
    }
  });

  it("+3 a role holding `full_access` is locked even if `isSystem` was not set (data-model §5.2 literal key)", () => {
    const sneaky = { isSystem: false, capabilities: ["full_access", "y"] };
    expect(
      decide({
        op: "update",
        actorCapabilities: OWNER,
        role: sneaky,
        next: next(["y"]),
        otherActiveHolders: 0,
      }),
    ).toEqual(LOCKED);
    expect(
      decide({ op: "delete", actorCapabilities: A, role: sneaky, otherActiveHolders: 0 }),
    ).toEqual(LOCKED);
  });

  it("+4 Owner bypass (AC-5.6): passes ⊆ even for a key it does not literally hold, and with holders", () => {
    expect(decide(create(OWNER, ["w", "manage_members"]))).toEqual(OK);
    expect(decide(update(OWNER, ["w"], ["manage_x"], 2))).toEqual(OK);
    expect(decide(del(OWNER, A, 7))).toEqual(OK);
  });

  it("+5 create/clone: ⊆ on the new caps only — `exceeds_actor` when ⊄, ok when = actor", () => {
    expect(decide(create(A, A))).toEqual(OK);
    expect(decide(create(M, ["manage_members"]))).toEqual(exceeds(["manage_members"]));
    // A list validation refuses never reaches the decision on create (L-4): it throws.
    expect(() => decide(create(A, ["w", "y", "zzz_unknown"]))).toThrow(/ValidatedCapabilities/);
  });

  it("+6 otherActiveHolders = 0 / 1 / many on an equal role: only 0 passes", () => {
    expect(decide(update(A, A, A_MINUS_ONE, 0))).toEqual(OK);
    expect(decide(update(A, A, A_MINUS_ONE, 1))).toEqual(TNBA_EQUAL);
    expect(decide(update(A, A, A_MINUS_ONE, 42))).toEqual(TNBA_EQUAL);
    expect(decide(update(M, BELOW_M, [], 42))).toEqual(REQUIRES_MM);
  });

  it("+7 comparisons run on EXPANDED sets: actor `manage_x` covers a role's `view_x`; an unknown key fails closed (SR-11)", () => {
    expect(decide(update(A, ["view_x"], ["view_x", "y"], 0))).toEqual(OK);
    expect(decide(update(["manage_roles", "view_x"], ["manage_x"], [], 0))).toEqual(
      exceeds(["manage_x"]),
    );
    expect(decide(update(A, ["zzz_unknown"], [], 0))).toEqual(exceeds(["zzz_unknown"]));
  });

  it("+8 rename-only / no-op are judged like any edit (rows 4, 5, 14): no short-circuit on unchanged caps", () => {
    // Same verdict with `next` absent, equal to before, or a real change.
    for (const [actor, before, expected] of [
      [A, A, TNBA_EQUAL],
      [M, BELOW_M, REQUIRES_MM],
      [A, BELOW_A, OK],
    ] as const) {
      expect(decide(update(actor, before, undefined, 1))).toEqual(expected);
      expect(decide(update(actor, before, before, 1))).toEqual(expected);
    }
  });

  it("the op list is exactly create/update/delete", () => {
    expect([...ROLE_WRITE_OPS].sort()).toEqual(["create", "delete", "update"]);
  });
});

describe("U-RB-12 · set oracle — every (actor, before, after, holders) over the fixture registry", () => {
  // Independent oracle: written from §1.3 with plain sets, NOT via decideMemberAuthority.
  const KEYS = ["manage_members", "manage_roles", "manage_x", "view_x", "y"] as const;
  const expand = (s: readonly string[]) => {
    const out = new Set(s);
    if (out.has("manage_x")) out.add("view_x");
    return out;
  };
  const sub = (a: readonly string[], b: readonly string[]) => {
    const eb = expand(b);
    return [...expand(a)].every((k) => eb.has(k));
  };
  const oracle = (
    op: "update" | "delete",
    actor: string[],
    before: string[],
    after: string[],
    holders: number,
  ) => {
    if (!expand(actor).has("manage_roles")) return "forbidden";
    if (!sub(before, actor) || (op === "update" && !sub(after, actor))) return "exceeds_actor";
    if (holders > 0) {
      if (!expand(actor).has("manage_members")) return "requires_manage_members";
      if (sub(actor, before)) return "target_not_below_actor"; // before ⊆ actor ∧ actor ⊆ before ⇒ equal
    }
    return "ok";
  };
  const subsets: string[][] = [];
  for (let mask = 0; mask < 1 << KEYS.length; mask++) {
    subsets.push(KEYS.filter((_, i) => mask & (1 << i)));
  }

  /** `after` only feeds the ⊆ axis — a representative spread keeps the run fast (incl. implied + unknown keys). */
  const AFTERS: string[][] = [
    [],
    ["view_x"],
    ["manage_x"],
    ["y"],
    ["manage_members"],
    ["manage_roles"],
    ["manage_roles", "manage_x", "y"],
    [...KEYS],
    ["w"],
  ];

  it(
    "matches the oracle on every actor × before × holders(0/1) × 9 afters, update + delete (non-vacuity: every reason seen)",
    { timeout: 30_000 },
    () => {
      const counts: Record<string, number> = {};
      for (const actor of subsets)
        for (const before of subsets)
          for (const holders of [0, 1]) {
            for (const after of AFTERS) {
              const got = decide(update(actor, before, after, holders));
              const want = oracle("update", actor, before, after, holders);
              const reason = got.ok ? "ok" : got.reason;
              if (reason !== want) {
                throw new Error(
                  `update actor=${actor} before=${before} after=${after} holders=${holders}: got ${reason}, want ${want}`,
                );
              }
              counts[reason] = (counts[reason] ?? 0) + 1;
            }
            const got = decide(del(actor, before, holders));
            const reason = got.ok ? "ok" : got.reason;
            expect(reason).toBe(oracle("delete", actor, before, [], holders));
          }
      for (const r of [
        "ok",
        "forbidden",
        "exceeds_actor",
        "requires_manage_members",
        "target_not_below_actor",
      ]) {
        expect(counts[r], r).toBeGreaterThan(0);
      }
    },
  );
});

describe("U-RB-13 · reason order: floor → role_locked → bypass → exceeds_actor → requires_manage_members → target_not_below_actor", () => {
  const ownerRole = { isSystem: true, capabilities: ["full_access"] };

  it("floor before role_locked: no `manage_roles` on the Owner role → `forbidden`", () => {
    expect(
      decide({
        op: "delete",
        actorCapabilities: ["manage_members"],
        role: ownerRole,
        otherActiveHolders: 0,
      }),
    ).toEqual(FORBIDDEN);
  });

  it("role_locked before bypass: the Owner editing the Owner role is still locked", () => {
    expect(
      decide({
        op: "update",
        actorCapabilities: OWNER,
        role: ownerRole,
        next: "unchanged",
        otherActiveHolders: 0,
      }),
    ).toEqual(LOCKED);
  });

  it("role_locked before ⊆: Admin on the Owner role gets `role_locked`, not `exceeds_actor`", () => {
    expect(
      decide({ op: "delete", actorCapabilities: A, role: ownerRole, otherActiveHolders: 1 }),
    ).toEqual(LOCKED);
  });

  it("bypass before ⊆ and before the held-role checks: Owner + unknown key + holders → ok", () => {
    expect(decide(update(OWNER, ["zzz_unknown"], ["zzz_unknown"], 3))).toEqual(OK);
  });

  it("exceeds_actor before requires_manage_members (row 17) and before target_not_below_actor", () => {
    expect(decide(update(M, ["manage_members"], [], 1))).toEqual(exceeds(["manage_members"]));
    // A, role ⊋ A with a holder: the ⊆ refusal wins over the (also failing) target axis.
    expect(decide(update(A, [...A, "w"], A, 1))).toEqual(exceeds(["w"]));
    // after ⊄ on a role equal to the actor with a holder: still exceeds_actor first.
    expect(decide(update(A, A, [...A, "w"], 1))).toEqual(exceeds(["w"]));
  });

  it("requires_manage_members before target_not_below_actor (row 16: role = M, M lacks manage_members)", () => {
    expect(decide(update(M, M, M_MINUS_ONE, 1))).toEqual(REQUIRES_MM);
    expect(decide(del(M, M, 1))).toEqual(REQUIRES_MM);
  });

  it("`exceeds_actor.excess` is the union of what before and after hold beyond the actor, sorted", () => {
    expect(decide(update(M, ["w"], ["manage_members"], 0))).toEqual(
      exceeds(["manage_members", "w"]),
    );
  });

  it("`otherActiveHolders` is REQUIRED (no default 0) — type half in role-write.compile-test.ts; runtime half here", () => {
    // The type refusal is pinned by `role-write.compile-test.ts` (compiled by
    // `typecheck`; *.test.ts is not). Here: a call site that bypassed the type
    // fails loud — the missing count is never read as 0.
    const u = { op: "update", actorCapabilities: A, role: custom(A) } as unknown as RoleWriteInput;
    const d = { op: "delete", actorCapabilities: A, role: custom(A) } as unknown as RoleWriteInput;
    const r = {
      op: "update",
      actorCapabilities: A,
      otherActiveHolders: 0,
    } as unknown as RoleWriteInput;
    expect(() => decide(u)).toThrow(/otherActiveHolders/);
    expect(() => decide(d)).toThrow(/otherActiveHolders/);
    expect(() => decide(r)).toThrow(/role/);
  });

  it("`next` is REQUIRED on update (security review M-1) — omitting it throws, it never skips the after-⊆ check", () => {
    // The review's escalation: Admin A is the ONLY holder of R_A (= A), the call
    // site forgets `next` and then writes `A + w`. Omission must not decide `ok`.
    const forgot = {
      op: "update",
      actorCapabilities: A,
      role: custom(A),
      otherActiveHolders: 0,
    } as unknown as RoleWriteInput;
    expect(() => decide(forgot)).toThrow(/next is required/);
    // Same for M widening an unheld role, and for a non-array `next`.
    const forgotM = {
      op: "update",
      actorCapabilities: M,
      role: custom(BELOW_M),
      otherActiveHolders: 0,
    };
    expect(() => decide(forgotM as unknown as RoleWriteInput)).toThrow(/next is required/);
    const notArray = { ...forgotM, next: "y" };
    expect(() => decide(notArray as unknown as RoleWriteInput)).toThrow(/next is required/);
    // control: the same call WITH the escalating `next` is refused by ⊆, and the
    // explicit rename-only form passes.
    expect(decide(update(A, A, [...A, "w"], 0))).toEqual(exceeds(["w"]));
    expect(decide(update(A, A, undefined, 0))).toEqual(OK);
  });

  it('rename-only `next: "unchanged"` resolves to role.capabilities and runs EVERY check (review L-3)', () => {
    const rename = (actor: readonly string[], before: readonly string[], holders: number) =>
      decide({
        op: "update",
        actorCapabilities: actor,
        role: custom(before),
        next: "unchanged",
        otherActiveHolders: holders,
      });
    // floor
    expect(rename(["manage_members", "y"], ["y"], 0)).toEqual(FORBIDDEN);
    // role_locked (Owner role, Owner actor)
    expect(
      decide({
        op: "update",
        actorCapabilities: OWNER,
        role: { isSystem: true, capabilities: ["full_access"] },
        next: "unchanged",
        otherActiveHolders: 0,
      }),
    ).toEqual(LOCKED);
    // ⊆ — before (= after) ⊄ actor
    expect(rename(A, [...A, "w"], 0)).toEqual(exceeds(["w"]));
    // held role, actor lacks manage_members → requires_manage_members
    expect(rename(M, BELOW_M, 1)).toEqual(REQUIRES_MM);
    // held role equal to the actor → target_not_below_actor (the ⊊ leg)
    expect(rename(A, A, 1)).toEqual(TNBA_EQUAL);
    // controls: ⊊ with a holder, and equal with no holder → ok
    expect(rename(A, BELOW_A, 1)).toEqual(OK);
    expect(rename(A, A, 0)).toEqual(OK);
  });

  it('`"unchanged"` is update-only: on create it throws (type half in the compile-test)', () => {
    const c = { op: "create", actorCapabilities: A, next: "unchanged", otherActiveHolders: 0 };
    expect(() => decide(c as unknown as RoleWriteInput)).toThrow(/ValidatedCapabilities/);
    // and any other string on update is not a sentinel
    const u = {
      op: "update",
      actorCapabilities: A,
      role: custom(A),
      next: "same",
      otherActiveHolders: 0,
    };
    expect(() => decide(u as unknown as RoleWriteInput)).toThrow(/next is required/);
  });

  it("create throws on a `next` that is not validateRoleCapabilities output (review L-4)", () => {
    const forged = (caps: readonly string[]) =>
      ({
        op: "create",
        actorCapabilities: OWNER,
        next: caps,
        otherActiveHolders: 0,
      }) as unknown as RoleWriteInput;
    // Owner would pass ⊆ on all of these — the guard is what refuses them.
    expect(() => decide(forged(["y"]))).toThrow(/ValidatedCapabilities/); // not frozen
    expect(() => decide(forged(Object.freeze([])))).toThrow(/ValidatedCapabilities/); // empty
    expect(() => decide(forged(Object.freeze(["full_access"])))).toThrow(/ValidatedCapabilities/);
    expect(() => decide(forged(Object.freeze(["zzz_unknown"])))).toThrow(/ValidatedCapabilities/);
    expect(() => decide(forged(Object.freeze(["y", "manage_x"])))).toThrow(/ValidatedCapabilities/); // not canonical (order)
    expect(() => decide(forged(Object.freeze(["manage_x", "view_x"])))).toThrow(
      /ValidatedCapabilities/,
    ); // not canonical (implied kept)
    expect(() => decide(forged("y" as unknown as string[]))).toThrow(/ValidatedCapabilities/);
    // control: the real constructor's output passes
    expect(decide(create(OWNER, ["y", "manage_x", "view_x"]))).toEqual(OK);
  });

  it("fails loud on a nonsensical count, an unknown op, or a create that claims holders", () => {
    expect(() => decide(update(A, BELOW_A, [], -1))).toThrow(/otherActiveHolders/);
    expect(() => decide(update(A, BELOW_A, [], 0.5))).toThrow(/otherActiveHolders/);
    expect(() => decide(update(A, BELOW_A, [], Number.NaN))).toThrow(/otherActiveHolders/);
    const rename = { op: "rename", actorCapabilities: A, role: custom(A), otherActiveHolders: 0 };
    expect(() => decide(rename as unknown as RoleWriteInput)).toThrow(/unknown op/);
    const heldCreate = { op: "create", actorCapabilities: A, next: ["y"], otherActiveHolders: 1 };
    expect(() => decide(heldCreate as unknown as RoleWriteInput)).toThrow(/otherActiveHolders/);
  });
});
