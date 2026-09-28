// F-003 · T-003-B03 — U-RB-03 (expandCapabilities) + U-RB-04 (hasCapability
// runs through expand). test-plan §3 · architecture §1 · AC-7.2/7.3.
import { describe, it, expect } from "vitest";
import { expandCapabilities, hasCapability } from "./expand";
import { CAPABILITY_REGISTRY, type RegistryLike } from "./registry";
import { hasCapability as legacyHasCapability } from "../auth/capabilities";
import { canAssignRole } from "../orgs/member-authz";

/** F-003 ships no implies edge (data-model §1) — the mechanism is proven on a fixture. */
const FIXTURE: RegistryLike = [
  { key: "full_access", implies: [] },
  { key: "manage_members", implies: [] },
  { key: "manage_widgets", implies: ["view_widgets"] },
  { key: "view_widgets", implies: [] },
];

/** ⊆ after expanding both sides — the comparison every rule in F-003 uses. */
const isSubset = (
  a: readonly string[],
  b: readonly string[],
  r: RegistryLike = CAPABILITY_REGISTRY,
) => {
  const eb = new Set(expandCapabilities(b, r));
  return expandCapabilities(a, r).every((k) => eb.has(k));
};

describe("U-RB-03 · expandCapabilities", () => {
  it("full_access → every registry key, including upcoming and tier full", () => {
    const all = CAPABILITY_REGISTRY.map((c) => c.key as string).sort();
    expect(expandCapabilities(["full_access"])).toEqual(all);
    expect(expandCapabilities(["full_access"])).toContain("access_accounting");
    expect(expandCapabilities(["full_access"])).toContain("manage_billing");
  });

  it("manage_X → + view_X (fixture registry)", () => {
    expect(expandCapabilities(["manage_widgets"], FIXTURE)).toEqual([
      "manage_widgets",
      "view_widgets",
    ]);
    expect(expandCapabilities(["view_widgets"], FIXTURE)).toEqual(["view_widgets"]);
  });

  it("unknown keys are KEPT (fail-closed: they make ⊆ fail instead of vanishing — SR-11)", () => {
    expect(expandCapabilities(["manage_members", "mystery_key"])).toEqual([
      "manage_members",
      "mystery_key",
    ]);
    // control: if the unknown key were dropped, a non-Owner holding it would
    // pass ⊆ against an actor who does not hold it.
    expect(isSubset(["manage_members", "mystery_key"], ["manage_members"])).toBe(false);
    // …and full_access does not cover a key the registry does not know.
    expect(isSubset(["mystery_key"], ["full_access"])).toBe(false);
  });

  it("dedupes and returns a sorted list; expanding twice changes nothing", () => {
    const inputs: string[][] = [
      [],
      ["manage_widgets", "manage_widgets"],
      ["view_widgets", "manage_widgets", "zzz"],
      ["full_access", "zzz"],
    ];
    for (const input of inputs) {
      const once = expandCapabilities(input, FIXTURE);
      expect(expandCapabilities(once, FIXTURE)).toEqual(once);
      expect([...once].sort()).toEqual(once);
      expect(new Set(once).size).toBe(once.length);
    }
    expect(expandCapabilities([])).toEqual([]);
  });

  it("does not mutate its input", () => {
    const input = Object.freeze(["manage_widgets"]);
    expandCapabilities(input, FIXTURE);
    expect(input).toEqual(["manage_widgets"]);
  });

  it("AC-7.2: a new registry key is default-deny for Admin/Staff and automatic for Owner", () => {
    const withNewKey: RegistryLike = [
      ...CAPABILITY_REGISTRY,
      { key: "manage_brand_new", implies: [] },
    ];
    const admin = ["manage_members", "manage_org_settings", "manage_products"];
    const staff = ["manage_products", "manage_stock", "manage_orders"];
    expect(hasCapability(admin, "manage_brand_new", withNewKey)).toBe(false);
    expect(hasCapability(staff, "manage_brand_new", withNewKey)).toBe(false);
    expect(hasCapability(["full_access"], "manage_brand_new", withNewKey)).toBe(true);
    // control: the SAME Owner does not get it from the shipped registry.
    expect(hasCapability(["full_access"], "manage_brand_new")).toBe(false);
  });

  it("never expands into full_access (only Owner's role grants ownership)", () => {
    const everyOther = CAPABILITY_REGISTRY.map((c) => c.key as string).filter(
      (k) => k !== "full_access",
    );
    expect(expandCapabilities(everyOther)).not.toContain("full_access");
  });
});

describe("U-RB-04 · hasCapability runs through expandCapabilities", () => {
  it("a manage_X holder passes a view_X check (AC-7.3 at the guard)", () => {
    expect(hasCapability(["manage_widgets"], "view_widgets", FIXTURE)).toBe(true);
    expect(hasCapability(["view_widgets"], "manage_widgets", FIXTURE)).toBe(false);
  });

  it("full_access grants registry keys only — never an unregistered key (SR-11 fail-closed)", () => {
    // The pre-F-003 form `includes(full) || includes(req)` said yes to ANY string.
    expect(hasCapability(["full_access"], "legacy_key")).toBe(false);
    expect(hasCapability(["full_access"], "manage_memebers")).toBe(false);
    // …while an explicit holder of the unknown key still matches it (kept, not dropped).
    expect(hasCapability(["legacy_key"], "legacy_key")).toBe(true);
    // Non-vacuity: full_access still passes every registered key.
    for (const { key } of CAPABILITY_REGISTRY)
      expect(hasCapability(["full_access"], key)).toBe(true);
  });

  it("the signature the guard calls is unchanged: (capabilities, required) → boolean", () => {
    expect(legacyHasCapability).toBe(hasCapability);
    expect(hasCapability(["manage_members"], "manage_members")).toBe(true);
    expect(hasCapability(["manage_org_settings"], "manage_members")).toBe(false);
    expect(hasCapability(["full_access"], "manage_members")).toBe(true);
    expect(hasCapability(["full_access"], "manage_org_settings")).toBe(true);
    expect(hasCapability(["full_access"], "manage_roles")).toBe(true);
    expect(hasCapability([], "manage_members")).toBe(false);
  });

  it("F-001/F-002 call sites keep their answers (canAssignRole matrix)", () => {
    const owner = ["full_access"];
    const admin = ["manage_members", "manage_org_settings"];
    expect(
      canAssignRole({ actorCapabilities: owner, targetIsOwner: true, newRoleIsOwner: false }),
    ).toBe(true);
    expect(
      canAssignRole({ actorCapabilities: admin, targetIsOwner: true, newRoleIsOwner: false }),
    ).toBe(false);
    expect(
      canAssignRole({ actorCapabilities: admin, targetIsOwner: false, newRoleIsOwner: true }),
    ).toBe(false);
    expect(
      canAssignRole({ actorCapabilities: admin, targetIsOwner: false, newRoleIsOwner: false }),
    ).toBe(true);
    expect(
      canAssignRole({ actorCapabilities: [], targetIsOwner: false, newRoleIsOwner: false }),
    ).toBe(false);
  });
});
