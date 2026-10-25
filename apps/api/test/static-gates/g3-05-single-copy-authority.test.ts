// F-003 · T-003-B05 — G3-05 (test-plan §5.2 · architecture §1 table, §13.5
// "single-copy gate" · AC-5.3).
//
// "Is the target strictly below the actor?" has ONE answer: the module-private
// `isProperSubset` inside `rbac/member-authority.ts`, reached only through
// `decideMemberAuthority`. A second copy — even a correct one today — is how
// the two drift: one path starts honouring `implies`, the other does not, and
// the Admin-resets-Admin hole (D-034) reopens on the path nobody updated.
//
// Rules:
//   1. `isProperSubset` is referenced (called, defined, imported, aliased)
//      nowhere but `rbac/member-authority.ts` — production code of the API,
//      its workspace packages, and the web client.
//   2. `member-authority.ts` does not export it (module-private).
//   3. The F-002 wrappers `orgs/member-authz.ts` and `orgs/admin-reset-authz.ts`
//      hold no ⊆/⊊ logic of their own (no expansion, no set comparison, no
//      per-key loop). `admin-reset-authz.ts` DOES call `decideMemberAuthority`;
//      `member-authz.ts` no longer has to — T-003-B17 deleted its wrapper
//      (`canAssignRole`), leaving only `isOwnerRole`.
//
// ⚠️ Heuristic, not a proof: a hand-rolled comparison under another name in
// some third file is not caught by rule 1 — the behavioural guard for that is
// U-RB-10/21 plus the verdict property tests.
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, it, expect } from "vitest";
import {
  REPO,
  fixture,
  fixtureNames,
  lineOf,
  productionFiles,
  readCode,
  type Violation,
} from "./scan";

const ALLOWED = "packages/core-domain/src/rbac/member-authority.ts";
const WRAPPERS = [
  "packages/core-domain/src/orgs/member-authz.ts",
  "packages/core-domain/src/orgs/admin-reset-authz.ts",
] as const;
/** Wrappers that must still delegate (member-authz.ts lost its wrapper in T-003-B17). */
const DELEGATING: readonly string[] = ["packages/core-domain/src/orgs/admin-reset-authz.ts"];

const REFERENCE = /\bisProperSubset\b/g;
const CALL = /(?<!function\s+)\bisProperSubset\s*\(/g;
const EXPORTED =
  /\bexport\s+(?:async\s+)?(?:function\s+isProperSubset\b|(?:const|let|var)\s+isProperSubset\b)|\bexport\s*\{[^}]*\bisProperSubset\b[^}]*\}/g;
/** Anything that computes a set relation by hand. `.includes(` stays legal (Owner-ness). */
const OWN_SET_LOGIC =
  /\b(?:expandCapabilities|isSubset|isProperSubset|missingFrom|canonicalizeCapabilities|lostCapabilities)\b|\.\s*(?:every|some|filter)\s*\(|\bnew\s+Set\s*\(/g;
const DELEGATES = /\bdecideMemberAuthority\s*\(/g;

function g305(file: string, code: string): Violation[] {
  const out: Violation[] = [];
  const hit = (rule: string, index: number, snippet: string) =>
    out.push({
      gate: "G3-05",
      rule,
      file,
      line: lineOf(code, index),
      snippet: snippet.slice(0, 120),
    });

  if (file !== ALLOWED) {
    for (const m of code.matchAll(REFERENCE))
      hit("reference-outside-member-authority", m.index!, m[0]);
  } else {
    for (const m of code.matchAll(EXPORTED)) hit("exported", m.index!, m[0]);
  }
  if ((WRAPPERS as readonly string[]).includes(file)) {
    for (const m of code.matchAll(OWN_SET_LOGIC)) hit("wrapper-own-set-logic", m.index!, m[0]);
    if (DELEGATING.includes(file) && [...code.matchAll(DELEGATES)].length === 0)
      hit("wrapper-does-not-delegate", 0, file);
  }
  return out;
}

/** The web client is not in PRODUCTION_ROOTS (it is not what the API runs) — scanned here too. */
function webFiles(): string[] {
  const root = join(REPO, "apps/web/src");
  if (!existsSync(root)) throw new Error("apps/web/src is gone — update G3-05, do not skip it");
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry !== "node_modules" && entry !== ".next") walk(full);
      } else if (
        /\.(?:ts|tsx|mts|js|mjs)$/.test(entry) &&
        !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(entry)
      ) {
        out.push(relative(REPO, full).split(sep).join("/"));
      }
    }
  };
  walk(root);
  return out.sort();
}

const files = [...productionFiles(), ...webFiles()];

describe("G3-05 · one copy of the ⊊ rule (isProperSubset lives in member-authority.ts only)", () => {
  it("non-vacuity: the scan reached the rule, the wrappers and the web client; the rule really calls isProperSubset", () => {
    expect(files).toContain(ALLOWED);
    for (const w of WRAPPERS) expect(files).toContain(w);
    expect(files.some((f) => f.startsWith("apps/web/src/"))).toBe(true);
    expect(files.length).toBeGreaterThan(100);
    const calls = [...readCode(ALLOWED).matchAll(CALL)];
    expect(
      calls.length,
      "member-authority.ts no longer calls isProperSubset — the gate guards nothing",
    ).toBeGreaterThanOrEqual(1);
    for (const w of DELEGATING) {
      expect(
        [...readCode(w).matchAll(DELEGATES)].length,
        `${w} does not call decideMemberAuthority`,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it("★ production + web code: no violations", () => {
    expect(files.flatMap((f) => g305(f, readCode(f)))).toEqual([]);
  });

  it.each([
    [
      "g3-05-call-elsewhere.fixture",
      "packages/core-domain/src/rbac/role-write.ts",
      "reference-outside-member-authority",
    ],
    [
      "g3-05-own-subset-logic.fixture",
      "packages/core-domain/src/orgs/member-authz.ts",
      "wrapper-own-set-logic",
    ],
    [
      "g3-05-own-subset-logic.fixture",
      "packages/core-domain/src/orgs/admin-reset-authz.ts",
      "wrapper-does-not-delegate",
    ],
    ["g3-05-exported.fixture", ALLOWED, "exported"],
  ])("FIXTURE %s as %s turns the gate red (%s)", (name, asFile, rule) => {
    expect(g305(asFile, fixture(name)).map((v) => v.rule)).toContain(rule);
  });

  it("every g3-05 fixture on disk is exercised above", () => {
    expect(fixtureNames("g3-05-")).toEqual([
      "g3-05-call-elsewhere.fixture",
      "g3-05-exported.fixture",
      "g3-05-own-subset-logic.fixture",
    ]);
  });

  it("SELF-CHECK: flags the shapes, clears the legitimate ones", () => {
    const elsewhere = "apps/web/src/features/org/member-actions.ts";
    const red: [string, string][] = [
      [elsewhere, "if (isProperSubset(a, b)) return true;"],
      [elsewhere, "import { isProperSubset } from '@omnistock/core-domain';"],
      [elsewhere, "const below = isProperSubset;"],
      ["apps/api/src/orgs/members.service.ts", "function isProperSubset(a, b) { return false }"],
      [ALLOWED, "export function isProperSubset(a, b) {}"],
      [ALLOWED, "export { decideMemberAuthority, isProperSubset };"],
      [WRAPPERS[0], "decideMemberAuthority(x); const s = new Set(actor);"],
      [WRAPPERS[0], "decideMemberAuthority(x); role.some((k) => !hasCapability(actor, k))"],
      [WRAPPERS[1], "decideMemberAuthority(x); expandCapabilities(caps)"],
      [WRAPPERS[1], "decideMemberAuthority(x); t.filter((k) => a.includes(k))"],
      [WRAPPERS[1], "return hasCapability(caller, 'manage_members');"],
    ];
    for (const [file, code] of red)
      expect(g305(file, code).length, `NOT FLAGGED: ${file}: ${code}`).toBeGreaterThan(0);

    const green: [string, string][] = [
      [
        ALLOWED,
        "function isProperSubset(a, b, r) { return isSubset(a, b, r) && !isSubset(b, a, r); }",
      ],
      [ALLOWED, "if (!isProperSubset(target, actor, registry)) return refuse();"],
      [WRAPPERS[0], "return decideMemberAuthority({ op }).ok;"],
      [
        WRAPPERS[0],
        "decideMemberAuthority(i); return capabilities.includes(CAPABILITY_FULL_ACCESS);",
      ],
      [
        WRAPPERS[1],
        "decideMemberAuthority(i); return hasCapability(caller.capabilities, CAPABILITY_MANAGE_MEMBERS);",
      ],
      [elsewhere, "const r = decideMemberAuthority(input);"],
      [elsewhere, "const isProperSubsetLike = 1;"],
    ];
    for (const [file, code] of green)
      expect(g305(file, code), `FALSE POSITIVE: ${file}: ${code}`).toEqual([]);
  });
});
