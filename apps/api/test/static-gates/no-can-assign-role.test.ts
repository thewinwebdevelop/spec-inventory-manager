// F-003 · T-003-B17 — gate "no canAssignRole" (tasks.md "⛔ เงื่อนไข merge" ·
// security review of B05).
//
// `canAssignRole` was the F-002 compat wrapper: it handed `decideMemberAuthority`
// Owner MARKERS (`[full_access]` / `[]`) instead of the real capability sets,
// so a call site using it kept F-002's answer — and with it the lower → reset →
// raise impersonation path D-034 exists to close (AC-5.4b). B17 (members) and
// B18 (invitations) moved every call site to `decideMemberAuthority` with the
// real sets, and B17 deleted the wrapper. This gate keeps it gone: red if any
// production file (apps/api + the workspace packages it runs — including
// core-domain, where it was defined) REFERENCES the name — call, import,
// definition or alias (a rename on import would slip past a `canAssignRole(`
// match). No allowlist.
import { describe, it, expect } from "vitest";
import {
  blankComments,
  fixture,
  fixtureNames,
  lineOf,
  productionFiles,
  readCode,
  type Violation,
} from "./scan";

const REFERENCE = /\bcanAssignRole\b/g;
const DECIDES = /\bdecideMemberAuthority\s*\(/g;
/** The routes that used to call the wrapper — each must now decide with the real rule. */
const MOVED_CALL_SITES = [
  "apps/api/src/orgs/members.service.ts",
  "apps/api/src/orgs/invitations.service.ts",
] as const;

function gate(file: string, code: string): Violation[] {
  return [...code.matchAll(REFERENCE)].map((m) => ({
    gate: "no-canAssignRole",
    rule: "reference-in-production",
    file,
    line: lineOf(code, m.index!),
    snippet: code.slice(m.index!, m.index! + 80).split("\n")[0]!,
  }));
}

const files = productionFiles();

describe("gate · canAssignRole (the F-002 wrapper) is referenced nowhere in production (D-034 · AC-5.4b)", () => {
  it("non-vacuity: the scan reached api + core-domain, and the moved call sites decide with decideMemberAuthority", () => {
    expect(files.filter((f) => f.startsWith("apps/api/src/")).length).toBeGreaterThan(50);
    expect(files).toContain("packages/core-domain/src/orgs/member-authz.ts");
    for (const f of MOVED_CALL_SITES) {
      expect(files).toContain(f);
      expect([...readCode(f).matchAll(DECIDES)].length, f).toBeGreaterThanOrEqual(1);
    }
  });

  it("★ production code: no reference at all", () => {
    expect(files.flatMap((f) => gate(f, readCode(f)))).toEqual([]);
  });

  it.each(["no-car-aliased.fixture", "no-car-direct-call.fixture"])(
    "FIXTURE %s turns the gate red",
    (name) => {
      expect(gate("apps/api/src/orgs/members.service.ts", fixture(name)).length).toBeGreaterThan(0);
    },
  );

  it("every no-car fixture on disk is exercised above", () => {
    expect(fixtureNames("no-car-")).toEqual([
      "no-car-aliased.fixture",
      "no-car-direct-call.fixture",
    ]);
  });

  it("SELF-CHECK: flags the shapes, clears the legitimate ones", () => {
    const f = "apps/api/src/orgs/members.service.ts";
    for (const code of [
      "if (!canAssignRole(input)) throw x;",
      "import { canAssignRole } from '@omnistock/core-domain';",
      "const decide = canAssignRole;",
      "export function canAssignRole(i: unknown) { return true; }",
    ]) {
      expect(gate(f, code).length, `NOT FLAGGED: ${code}`).toBeGreaterThan(0);
    }
    for (const code of [
      "const r = decideMemberAuthority({ op: 'remove' });",
      "const canAssignRoleLike = 1;",
      readCode(f),
    ]) {
      expect(gate(f, code), `FALSE POSITIVE: ${code.slice(0, 60)}`).toEqual([]);
    }
    // Prose is not a call site: comments are blanked before matching.
    expect(gate(f, blankComments("// replaced canAssignRole(…) here\nconst a = 1;"))).toEqual([]);
  });
});
