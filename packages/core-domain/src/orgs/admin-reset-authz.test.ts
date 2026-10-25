// F-002 · T-002-09 ★ — decision layer of U-API-07 (test-plan §5, 8 cases).
// The transaction/ordering half of U-API-07 lives in
// apps/api/src/auth/auth.service.test.ts; this file pins the RULE.
import { describe, it, expect } from "vitest";
import { CAPABILITY_FULL_ACCESS, CAPABILITY_MANAGE_MEMBERS } from "../auth/capabilities";
import {
  decideAdminReset,
  decideAdminResetVisible,
  mapResetAuthorityRefusal,
  type AdminResetInput,
  type AdminResetRefusal,
} from "./admin-reset-authz";
import type { MemberAuthorityResult } from "../rbac/member-authority";

const OWNER = [CAPABILITY_FULL_ACCESS];
// F-003 · T-003-B05: D-034 makes reset require target ⊊ caller. F-002's
// fixture had ADMIN = [manage_members] and STAFF = [manage_products] — two sets
// that do not contain each other, which D-034 correctly refuses. ADMIN now
// holds STAFF's capability too (as the shipped presets do), so every F-002
// case below still tests what it was written for; the ⊊ rule has its own
// cases at the bottom (U-RB-14).
const ADMIN = [CAPABILITY_MANAGE_MEMBERS, "manage_products"];
const STAFF = ["manage_products"];

function input(over: Partial<AdminResetInput> = {}): AdminResetInput {
  return {
    caller: { status: "active", capabilities: ADMIN },
    target: { status: "active", capabilities: STAFF },
    targetActiveMembershipsInOtherOrgs: 0,
    targetUserExists: true,
    callerIsTarget: false,
    ...over,
  };
}

describe("U-API-07 · decideAdminReset — the 2 fail-closed conditions (C-2 + NEW-1)", () => {
  it("(ก) target active in THIS org only and not an Owner → allowed (F-001 behaviour survives)", () => {
    expect(decideAdminReset(input())).toEqual({ allowed: true, refusals: [] });
  });

  it("(ข) C-2 · target is active in another org too → refused", () => {
    const d = decideAdminReset(input({ targetActiveMembershipsInOtherOrgs: 1 }));
    expect(d.allowed).toBe(false);
    expect(d.refusals).toEqual(["target_active_in_other_org"]);
  });

  it("(ค) target's membership elsewhere is NOT active (invited/revoked) → allowed", () => {
    // The count only ever carries `active` rows; 0 means "nothing to cross".
    expect(decideAdminReset(input({ targetActiveMembershipsInOtherOrgs: 0 })).allowed).toBe(true);
  });

  it("(ง) caller lacks manage_members → refused, and ONLY for that reason", () => {
    const d = decideAdminReset(
      input({
        caller: { status: "active", capabilities: STAFF },
        target: { status: "active", capabilities: OWNER },
        targetActiveMembershipsInOtherOrgs: 3,
      }),
    );
    expect(d.allowed).toBe(false);
    // No owner-target / multi-org refusal ⇒ no audit event: a stranger with a
    // token cannot make the audit log say someone attacked the Owner.
    expect(d.refusals).toEqual(["caller_not_authorized"]);
  });

  it("(ง²) caller's membership is revoked / missing → refused", () => {
    expect(
      decideAdminReset(input({ caller: { status: "revoked", capabilities: ADMIN } })).refusals,
    ).toEqual(["caller_not_authorized"]);
    expect(
      decideAdminReset(input({ caller: { status: null, capabilities: [] } })).refusals,
    ).toEqual(["caller_not_authorized"]);
    expect(
      decideAdminReset(input({ caller: { status: "invited", capabilities: ADMIN } })).refusals,
    ).toEqual(["caller_not_authorized"]);
  });

  it("target is not an active member here → refused before any other check", () => {
    for (const status of ["invited", "revoked", null] as const) {
      const d = decideAdminReset(
        input({
          target: { status, capabilities: OWNER },
          targetActiveMembershipsInOtherOrgs: 2,
        }),
      );
      expect(d.refusals).toEqual(["target_not_active_member"]);
    }
  });

  it("target User row was not locked (does not exist) → refused", () => {
    expect(decideAdminReset(input({ targetUserExists: false })).refusals).toEqual([
      "target_not_active_member",
    ]);
  });

  it("(ฉ) NEW-1 · target is an Owner and caller only has manage_members → refused", () => {
    const d = decideAdminReset(input({ target: { status: "active", capabilities: OWNER } }));
    expect(d.allowed).toBe(false);
    expect(d.refusals).toEqual(["target_is_owner"]);
  });

  it("(ฉ²) NEW-1 · Owner-ness is read from CAPABILITIES, never a role name", () => {
    // A custom role that happens to hold full_access is an Owner (F-003 lets
    // roles be renamed; a name comparison would silently stop protecting it).
    const d = decideAdminReset(
      input({
        target: { status: "active", capabilities: ["manage_products", CAPABILITY_FULL_ACCESS] },
      }),
    );
    expect(d.refusals).toEqual(["target_is_owner"]);
  });

  it("(ช) control · target is an Owner and caller HAS full_access → allowed", () => {
    const d = decideAdminReset(
      input({
        caller: { status: "active", capabilities: OWNER },
        target: { status: "active", capabilities: OWNER },
      }),
    );
    expect(d).toEqual({ allowed: true, refusals: [] });
  });

  it("both conditions at once → BOTH refusals reported (the Owner signal is not swallowed)", () => {
    const d = decideAdminReset(
      input({
        target: { status: "active", capabilities: OWNER },
        targetActiveMembershipsInOtherOrgs: 1,
      }),
    );
    expect(d.allowed).toBe(false);
    expect(d.refusals).toEqual(["target_active_in_other_org", "target_is_owner"]);
  });

  it("an Owner caller is still blocked by C-2 (the two rules are independent)", () => {
    const d = decideAdminReset(
      input({
        caller: { status: "active", capabilities: OWNER },
        target: { status: "active", capabilities: OWNER },
        targetActiveMembershipsInOtherOrgs: 1,
      }),
    );
    expect(d.refusals).toEqual(["target_active_in_other_org"]);
  });

  it("is a pure decision: same input, same answer, no mutation of the input", () => {
    const i = input({ target: { status: "active", capabilities: OWNER } });
    const snapshot = JSON.parse(JSON.stringify(i));
    expect(decideAdminReset(i)).toEqual(decideAdminReset(i));
    expect(i).toEqual(snapshot);
  });

  // ── High-2 · self-reset (security review of f66451f, user decision) ───────

  it("caller resetting their OWN password → refused, however senior they are", () => {
    // The whole point: this is the case where the caller passes every other
    // check. An Owner with full_access trips nothing else at all.
    expect(decideAdminReset(input({ callerIsTarget: true }))).toEqual({
      allowed: false,
      refusals: ["caller_is_target"],
    });
    expect(
      decideAdminReset(
        input({
          caller: { status: "active", capabilities: [CAPABILITY_FULL_ACCESS] },
          target: { status: "active", capabilities: [CAPABILITY_FULL_ACCESS] },
          callerIsTarget: true,
        }),
      ),
    ).toEqual({ allowed: false, refusals: ["caller_is_target"] });
  });

  it("self-reset is reported ALONGSIDE the other refusals, not instead of them", () => {
    // Both must appear: an investigator reading "caller_is_target" alone would
    // conclude someone fat-fingered their own account, and miss that the same
    // request was also an attempt on a multi-org credential.
    const decision = decideAdminReset(
      input({ callerIsTarget: true, targetActiveMembershipsInOtherOrgs: 1 }),
    );
    expect(decision.allowed).toBe(false);
    expect([...decision.refusals].sort()).toEqual(
      ["caller_is_target", "target_active_in_other_org"].sort(),
    );
  });

  it("resetting SOMEBODY ELSE is untouched — the rule is about the caller, not the endpoint", () => {
    expect(decideAdminReset(input({ callerIsTarget: false }))).toEqual({
      allowed: true,
      refusals: [],
    });
  });
});

// ── F-003 · T-003-B05 — U-RB-14 (D-034 · AC-5.5 · api-spec §6) ──────────────
const active = (capabilities: readonly string[]) => ({ status: "active" as const, capabilities });

describe("U-RB-14 · decideAdminReset — the target must be ⊊ the caller (via decideMemberAuthority)", () => {
  it("Admin → Admin (equal) → target_not_proper_subset", () => {
    expect(decideAdminReset(input({ target: active(ADMIN) }))).toEqual({
      allowed: false,
      refusals: ["target_not_proper_subset"],
    });
  });

  it("Admin → Staff (⊊) → allowed", () => {
    expect(decideAdminReset(input({ target: active(STAFF) }))).toEqual({
      allowed: true,
      refusals: [],
    });
  });

  it("incomparable (neither contains the other) → target_not_proper_subset", () => {
    const d = decideAdminReset(input({ target: active(["manage_orders"]) }));
    expect(d.refusals).toEqual(["target_not_proper_subset"]);
  });

  it("target holds MORE than the caller → target_not_proper_subset", () => {
    const d = decideAdminReset(input({ target: active([...ADMIN, "manage_roles"]) }));
    expect(d.refusals).toEqual(["target_not_proper_subset"]);
  });

  it("Owner → Owner → allowed (full_access bypass); Owner → anyone → allowed", () => {
    expect(decideAdminReset(input({ caller: active(OWNER), target: active(OWNER) })).allowed).toBe(
      true,
    );
    expect(
      decideAdminReset(input({ caller: active(OWNER), target: active(["mystery_key"]) })).allowed,
    ).toBe(true);
  });

  it("an Owner target maps to target_is_owner (unchanged), never to the new refusal", () => {
    expect(decideAdminReset(input({ target: active(OWNER) })).refusals).toEqual([
      "target_is_owner",
    ]);
  });

  it("refusal order unchanged: caller_is_target → target_active_in_other_org → (target_is_owner | target_not_proper_subset)", () => {
    const d = decideAdminReset(
      input({ target: active(ADMIN), targetActiveMembershipsInOtherOrgs: 1, callerIsTarget: true }),
    );
    expect(d.refusals).toEqual([
      "caller_is_target",
      "target_active_in_other_org",
      "target_not_proper_subset",
    ]);
  });

  it("caller and target steps keep their place: an unauthorized caller / missing target reports nothing about ⊊", () => {
    expect(
      decideAdminReset(input({ caller: active(STAFF), target: active(ADMIN) })).refusals,
    ).toEqual(["caller_not_authorized"]);
    expect(
      decideAdminReset(input({ target: { status: "revoked", capabilities: ADMIN } })).refusals,
    ).toEqual(["target_not_active_member"]);
  });
});

describe("U-RB-14 · decideAdminResetVisible (MemberRow.viewerCanResetPassword — api-spec §3.1)", () => {
  const viewer = (capabilities: readonly string[]) => ({ userId: "v", capabilities });
  const row = (capabilities: readonly string[], userId = "r") => ({ userId, capabilities });

  it("reason order: self → owner_only → equal_permissions → exceeds_your_permissions", () => {
    // self wins even over an Owner viewer and an equal row
    expect(decideAdminResetVisible(viewer(OWNER), row(OWNER, "v"))).toEqual({
      ok: false,
      reason: "self",
    });
    expect(decideAdminResetVisible(viewer(ADMIN), row(ADMIN, "v"))).toEqual({
      ok: false,
      reason: "self",
    });
    expect(decideAdminResetVisible(viewer(ADMIN), row(OWNER))).toEqual({
      ok: false,
      reason: "owner_only",
    });
    expect(decideAdminResetVisible(viewer(ADMIN), row([...ADMIN]))).toEqual({
      ok: false,
      reason: "equal_permissions",
    });
    expect(decideAdminResetVisible(viewer(ADMIN), row([...ADMIN, "manage_roles"]))).toEqual({
      ok: false,
      reason: "exceeds_your_permissions",
    });
    expect(decideAdminResetVisible(viewer(ADMIN), row(["manage_orders"]))).toEqual({
      ok: false,
      reason: "exceeds_your_permissions",
    });
    expect(decideAdminResetVisible(viewer(ADMIN), row(STAFF))).toEqual({ ok: true });
    expect(decideAdminResetVisible(viewer(OWNER), row(OWNER))).toEqual({ ok: true });
  });

  // "type takes NO C-2 input" is pinned at compile time in
  // admin-reset-authz.compile-test.ts (test files are outside `tsc`, so an
  // `@ts-expect-error` here would never be checked).

  it("a viewer without manage_members is a caller bug (the verdict is only computed for manage_members ∧ manage_roles) — thrown", () => {
    expect(() => decideAdminResetVisible(viewer(STAFF), row([]))).toThrow(/manage_members/);
  });

  it("★ property: visible refuses ⇒ decideAdminReset refuses — every viewer × row × self", () => {
    const KEYS = [
      "manage_members",
      "manage_roles",
      "manage_products",
      "manage_orders",
      "full_access",
      "mystery_key",
    ];
    const subsets = Array.from({ length: 1 << KEYS.length }, (_, m) =>
      KEYS.filter((_, i) => m & (1 << i)),
    );
    let refusedVisible = 0;
    let allowedVisible = 0;
    const broken: string[] = [];
    for (const v of subsets.filter(
      (s) => s.includes("manage_members") || s.includes("full_access"),
    ))
      for (const r of subsets)
        for (const self of [false, true]) {
          const visible = decideAdminResetVisible(viewer(v), row(r, self ? "v" : "r"));
          const real = decideAdminReset({
            caller: active(v),
            target: active(r),
            targetActiveMembershipsInOtherOrgs: 0,
            targetUserExists: true,
            callerIsTarget: self,
          });
          if (visible.ok) {
            allowedVisible++;
            continue;
          }
          refusedVisible++;
          if (real.allowed)
            broken.push(`viewer=${v} row=${r} self=${self} visible=${visible.reason}`);
        }
    expect(broken.slice(0, 5)).toEqual([]);
    expect(refusedVisible).toBeGreaterThan(1000); // non-vacuity: both outcomes occur
    expect(allowedVisible).toBeGreaterThan(100);
  });

  it("the new refusal is a plain AdminResetRefusal value (no wire value — the route still answers the uniform 404)", () => {
    const r: AdminResetRefusal = "target_not_proper_subset";
    expect(r).toBe("target_not_proper_subset");
  });
});

// ── T-003-B20 ★ (review of B05): the mapper must never turn a refusal into a 500 ──
//
// Once step 1 has passed, `decideMemberAuthority(reset_password)` can only
// answer `ok`, `owner_only` or `target_not_below_actor` (same `manage_members`
// floor, no grant axis). Any other answer means the two copies of "who may"
// drifted. The old mapper THREW, which reached the wire as a 500: a status that
// stands out against this endpoint's uniform 404, and so an oracle of its own.
// Fail-closed now means refusing with `authority_rule_drift`, which maps to the
// same 404. The service logs it at error level, so the drift is still loud.
describe("T-003-B20 · mapResetAuthorityRefusal — fail closed, never throw", () => {
  const cases: Array<[string, MemberAuthorityResult, AdminResetRefusal | null]> = [
    ["ok", { ok: true }, null],
    [
      "owner_only",
      { ok: false, reason: "owner_only", excess: [CAPABILITY_FULL_ACCESS] },
      "target_is_owner",
    ],
    [
      "target_not_below_actor / equal",
      { ok: false, reason: "target_not_below_actor", relation: "equal", excess: [] },
      "target_not_proper_subset",
    ],
    [
      "target_not_below_actor / superset",
      { ok: false, reason: "target_not_below_actor", relation: "superset", excess: ["x"] },
      "target_not_proper_subset",
    ],
    [
      "target_not_below_actor / incomparable",
      { ok: false, reason: "target_not_below_actor", relation: "incomparable", excess: ["x"] },
      "target_not_proper_subset",
    ],
    [
      "forbidden (step 1 drifted)",
      { ok: false, reason: "forbidden", excess: [CAPABILITY_MANAGE_MEMBERS] },
      "authority_rule_drift",
    ],
    [
      "exceeds_actor (reset has no grant axis — drift)",
      { ok: false, reason: "exceeds_actor", excess: ["x"] },
      "authority_rule_drift",
    ],
  ];

  for (const [label, result, expected] of cases) {
    it(`${label} → ${String(expected)}`, () => {
      expect(() => mapResetAuthorityRefusal(result)).not.toThrow();
      expect(mapResetAuthorityRefusal(result)).toBe(expected);
    });
  }

  it("a reason this file has never heard of → authority_rule_drift (refused): no throw, never allowed", () => {
    const future = {
      ok: false,
      reason: "some_future_reason",
      excess: [],
    } as unknown as MemberAuthorityResult;
    expect(() => mapResetAuthorityRefusal(future)).not.toThrow();
    expect(mapResetAuthorityRefusal(future)).toBe("authority_rule_drift");
  });

  it("decideAdminReset never throws over every caller × target pair of a small universe; every refusal is a known value", () => {
    const keys = [
      CAPABILITY_MANAGE_MEMBERS,
      "manage_products",
      "manage_orders",
      "view_orders",
      "mystery_key",
    ];
    const sets: string[][] = [[CAPABILITY_FULL_ACCESS]];
    for (let mask = 0; mask < 1 << keys.length; mask++) {
      sets.push(keys.filter((_, i) => mask & (1 << i)));
    }
    const known = new Set<AdminResetRefusal>([
      "caller_not_authorized",
      "target_not_active_member",
      "target_active_in_other_org",
      "target_is_owner",
      "target_not_proper_subset",
      "caller_is_target",
      "authority_rule_drift",
    ]);
    let refusedOnSubset = 0;
    let evaluated = 0;
    for (const c of sets)
      for (const t of sets) {
        const d = decideAdminReset(input({ caller: active(c), target: active(t) }));
        evaluated += 1;
        for (const r of d.refusals) expect(known.has(r), r).toBe(true);
        // Reached through the real authority fn, the drift refusal never fires.
        expect(d.refusals).not.toContain("authority_rule_drift");
        if (d.refusals.includes("target_not_proper_subset")) refusedOnSubset += 1;
      }
    expect(evaluated).toBe(sets.length * sets.length);
    expect(refusedOnSubset).toBeGreaterThan(100); // non-vacuity
  });
});
