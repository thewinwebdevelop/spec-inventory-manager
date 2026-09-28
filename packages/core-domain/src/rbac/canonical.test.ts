// F-003 · T-003-B03 — U-RB-05 (canonicalizeCapabilities) + U-RB-09
// (lostCapabilities + golden vectors). test-plan §3 · api-spec §2 · AC-3.10.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalizeCapabilities, lostCapabilities } from "./canonical";
import { expandCapabilities } from "./expand";
import { CAPABILITY_REGISTRY, type RegistryLike } from "./registry";

const FIXTURE: RegistryLike = [
  { key: "full_access", implies: [] },
  { key: "manage_members", implies: [] },
  { key: "manage_widgets", implies: ["view_widgets"] },
  { key: "view_widgets", implies: [] },
];

const isSubset = (a: readonly string[], b: readonly string[], r: RegistryLike) => {
  const eb = new Set(expandCapabilities(b, r));
  return expandCapabilities(a, r).every((k) => eb.has(k));
};

/** Every subset of `universe` (the matrix for the ⊆ property). */
function powerSet(universe: readonly string[]): string[][] {
  const out: string[][] = [];
  for (let mask = 0; mask < 1 << universe.length; mask++) {
    out.push(universe.filter((_, i) => mask & (1 << i)));
  }
  return out;
}

describe("U-RB-05 · canonicalizeCapabilities", () => {
  it("dedupes and sorts by key (code-unit order, not locale)", () => {
    expect(canonicalizeCapabilities(["manage_stock", "manage_members", "manage_stock"])).toEqual([
      "manage_members",
      "manage_stock",
    ]);
    expect(canonicalizeCapabilities(["manage_org_settings", "manage_orders"])).toEqual([
      "manage_orders",
      "manage_org_settings",
    ]);
  });

  it("drops a key implied by another key in the set (fixture registry)", () => {
    expect(canonicalizeCapabilities(["view_widgets", "manage_widgets"], FIXTURE)).toEqual([
      "manage_widgets",
    ]);
    // control: the implied key alone stays.
    expect(canonicalizeCapabilities(["view_widgets"], FIXTURE)).toEqual(["view_widgets"]);
  });

  it("keeps unknown keys (the server decides — never drop silently)", () => {
    expect(canonicalizeCapabilities(["zzz", "manage_members"])).toEqual(["manage_members", "zzz"]);
  });

  it("is idempotent and does not mutate its input", () => {
    const input = Object.freeze(["view_widgets", "manage_widgets", "manage_widgets"]);
    const once = canonicalizeCapabilities(input, FIXTURE);
    expect(canonicalizeCapabilities(once, FIXTURE)).toEqual(once);
    expect(input).toEqual(["view_widgets", "manage_widgets", "manage_widgets"]);
  });

  it("property: isSubset(canon(a), x) === isSubset(a, x) and isSubset(x, canon(a)) === isSubset(x, a) for every pair", () => {
    const universe = ["full_access", "manage_members", "manage_widgets", "view_widgets", "zzz"];
    const sets = powerSet(universe);
    sets.push(["manage_widgets", "manage_widgets", "view_widgets"]); // duplicates
    let pairs = 0;
    for (const a of sets) {
      const ca = canonicalizeCapabilities(a, FIXTURE);
      expect(expandCapabilities(ca, FIXTURE)).toEqual(expandCapabilities(a, FIXTURE));
      for (const x of sets) {
        expect(isSubset(ca, x, FIXTURE), `${a} ⊆ ${x}`).toBe(isSubset(a, x, FIXTURE));
        expect(isSubset(x, ca, FIXTURE), `${x} ⊆ ${a}`).toBe(isSubset(x, a, FIXTURE));
        pairs++;
      }
    }
    expect(pairs).toBe(33 * 33); // non-vacuity: the matrix actually ran
  });
});

interface VectorFile {
  registries: Record<string, { key: string; implies: string[] }[]>;
  vectors: { name: string; registry: string; before: string[]; after: string[]; lost: string[] }[];
}
const VECTORS_FILE = join(__dirname, "fixtures", "lost-capabilities.vectors.json");
const file = JSON.parse(readFileSync(VECTORS_FILE, "utf8")) as VectorFile;

describe("U-RB-09 · lostCapabilities + golden vectors (shared with CW3-01 / CM3-01)", () => {
  it("the file's live registry is CAPABILITY_REGISTRY (clients read it — it must not drift)", () => {
    expect(file.registries.live).toEqual(
      CAPABILITY_REGISTRY.map((c) => ({ key: c.key, implies: [...c.implies] })),
    );
  });

  it("has ≥ 8 vectors covering implies, full_access and no-loss", () => {
    expect(file.vectors.length).toBeGreaterThanOrEqual(8);
    expect(
      file.vectors.some(
        (v) => v.registry === "implies_fixture" && v.lost.some((k) => k.startsWith("view_")),
      ),
    ).toBe(true);
    expect(file.vectors.some((v) => v.before.includes("full_access"))).toBe(true);
    expect(file.vectors.some((v) => v.lost.length === 0)).toBe(true);
    for (const v of file.vectors) expect(file.registries[v.registry], v.name).toBeDefined();
  });

  it.each(file.vectors.map((v) => [v.name, v] as const))("vector: %s", (_name, v) => {
    expect(lostCapabilities(v.before, v.after, file.registries[v.registry])).toEqual(v.lost);
  });

  it("defaults to the shipped registry", () => {
    expect(lostCapabilities(["manage_members", "manage_roles"], ["manage_members"])).toEqual([
      "manage_roles",
    ]);
  });

  it("equals expand(before) \\ expand(after) across the fixture matrix", () => {
    const sets = powerSet([
      "full_access",
      "manage_members",
      "manage_widgets",
      "view_widgets",
      "zzz",
    ]);
    for (const before of sets) {
      for (const after of sets) {
        const ea = new Set(expandCapabilities(after, FIXTURE));
        const expected = expandCapabilities(before, FIXTURE).filter((k) => !ea.has(k));
        expect(lostCapabilities(before, after, FIXTURE)).toEqual(expected);
      }
    }
  });
});
