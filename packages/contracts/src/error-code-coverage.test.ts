// ★ Error codes are contract, and these ones were never written down.
//
// The `contract-evolution` skill states it plainly: "Error codes are contract
// too — clients branch on them. Add freely; changing/removing an existing code
// = breaking." Both clients do exactly that — `err.code === "EMAIL_TAKEN"` on
// web, `case 'PASSWORD_TOO_SHORT'` on mobile — to choose which Thai sentence a
// person reads.
//
// Five of those codes appear NOWHERE in the OpenAPI document. They exist in the
// server's source and in two `switch` statements, and in no agreement between
// them. Rename one and `oasdiff` reports nothing, `contracts-drift` reports
// nothing, both apps quietly fall back to a generic message for a case they
// have specific copy for, and every test stays green because each side is
// consistent with itself.
//
// Found by audit, 2026-08-22 — the same sweep that found a client inventing a
// capability set and a `default:` that made an optional request field
// mandatory. Same shape every time: a fact one layer relies on and no layer
// states.
//
// CLOSED 2026-09-05 by backend-api: all five are now named in the `description`
// of the response that answers them (`openapi/paths/auth-signup.yaml`,
// `auth-login.yaml`, `auth-change-password.yaml`,
// `org-member-reset-password.yaml`). Nothing about the server changed — this was
// documentation of responses that already shipped.
//
// The debt list below is therefore EMPTY, and that is the state to keep it in:
// what remains is a plain guard, and the next undocumented code fails the build.
//
// ⚠️ This guard watches ONE direction — client branches ⊆ contract. The other
// direction (a code the SERVER can answer that the contract never publishes) is
// `apps/api/test/error-code-contract.test.ts`, which walks the production
// `ERROR_CODES` registry against this same bundle. Both are needed: this one
// alone stays green if the server renames a code AND the clients are updated
// with it, while the contract still says the old value.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { describe, it, expect } from "vitest";

const PACKAGE_ROOT = (() => {
  let dir = resolve(process.cwd());
  for (;;) {
    if (existsSync(join(dir, "openapi", "root.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`error-code-coverage: no openapi/root.yaml above ${dir}`);
    dir = parent;
  }
})();

const REPO_ROOT = join(PACKAGE_ROOT, "..", "..");
const BUNDLE = join(PACKAGE_ROOT, "openapi", "openapi.yaml");
const CLIENT_TREES = ["apps/web/src", "apps/mobile/lib"];

/**
 * A client deciding what to show from an error code.
 *
 * Both forms, because the two languages spell the same decision differently:
 * `code === "X"` / `code == 'X'` (TS) and `case 'X':` (Dart switch).
 */
const BRANCH = /(?:code\s*===?\s*|case\s+)['"]([A-Z][A-Z0-9_]{3,})['"]/g;

/**
 * ⚠️ DEBT, not permission — and it is EMPTY, which is the whole point.
 *
 * An entry here is a code a client branches on that the contract never
 * published. Adding a line is a reviewable admission (with an owner, in the
 * comment beside it); removing one — by documenting the code — never needs a
 * change to any other file.
 *
 * The five F-001 signup/change-password codes that lived here until 2026-09-05
 * are documented now; see the header. Do not re-add a code here to make a build
 * pass: writing the response down takes about as long and is the actual fix.
 */
const UNDOCUMENTED: readonly string[] = Object.freeze([]);

export interface CodeUse {
  readonly code: string;
  readonly files: readonly string[];
}

/** Every error code a client branches on, with where it does it. */
export function findBranchedCodes(files: readonly { path: string; source: string }[]): CodeUse[] {
  const byCode = new Map<string, Set<string>>();
  for (const { path, source } of files) {
    for (const match of source.matchAll(BRANCH)) {
      const set = byCode.get(match[1]) ?? new Set<string>();
      set.add(path);
      byCode.set(match[1], set);
    }
  }
  return [...byCode.entries()]
    .map(([code, paths]) => ({ code, files: [...paths].sort() }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

/** Codes branched on that the document never mentions. */
export function undocumented(uses: readonly CodeUse[], bundle: string): CodeUse[] {
  return uses.filter((use) => !bundle.includes(use.code));
}

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === "gen") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
      continue;
    }
    if (/\.test\.tsx?$/.test(full) || /_test\.dart$/.test(full)) continue;
    if (/\.(ts|tsx|dart)$/.test(full)) out.push(full);
  }
  return out;
}

describe("★ every error code a client branches on is in the contract", () => {
  const bundle = readFileSync(BUNDLE, "utf8");
  const files = CLIENT_TREES.flatMap((tree) => walk(join(REPO_ROOT, tree))).map((path) => ({
    path: relative(REPO_ROOT, path).split(sep).join("/"),
    source: readFileSync(path, "utf8"),
  }));

  it("the scan reached both client trees and the bundle", () => {
    expect(bundle.length).toBeGreaterThan(10_000);
    expect(files.some((f) => f.path.startsWith("apps/web/src"))).toBe(true);
    expect(files.some((f) => f.path.startsWith("apps/mobile/lib"))).toBe(true);
    // A scan finding no codes would pass the ban below forever.
    expect(findBranchedCodes(files).length).toBeGreaterThanOrEqual(10);
  });

  it("SELF-CHECK: it catches a code the document does not mention, and spares one it does", () => {
    const uses = findBranchedCodes([
      { path: "a.ts", source: 'if (err.code === "MADE_UP_CODE") return x;' },
      { path: "b.dart", source: "case 'ORG_ACCESS_DENIED':" },
    ]);
    expect(uses.map((u) => u.code)).toEqual(["MADE_UP_CODE", "ORG_ACCESS_DENIED"]);
    expect(undocumented(uses, bundle).map((u) => u.code)).toEqual(["MADE_UP_CODE"]);
  });

  it("★ every code a client branches on is published by the contract", () => {
    const missing = undocumented(findBranchedCodes(files), bundle).map((u) => u.code);
    expect(
      missing.filter((code) => !UNDOCUMENTED.includes(code)),
      "a client is branching on an error code the OpenAPI never publishes. Rename it server-side " +
        "and oasdiff, contracts-drift and every unit suite stay green while both apps lose their " +
        "specific message. Document the response, or add the code to UNDOCUMENTED with an owner.",
    ).toEqual([]);
  });

  it("the debt list is honest — every entry is still really undocumented", () => {
    // The opposite failure: a list that outlives the problem, so the next
    // person reads open items where there are none. (It is empty today; this
    // test is what keeps it empty once somebody documents a code they parked.)
    const missing = new Set(undocumented(findBranchedCodes(files), bundle).map((u) => u.code));
    const fixed = UNDOCUMENTED.filter((code) => !missing.has(code));
    expect(fixed, "these are documented now — delete them from UNDOCUMENTED").toEqual([]);
  });
});
