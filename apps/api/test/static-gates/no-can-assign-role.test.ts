// F-003 · T-003-B17 — gate "no canAssignRole in apps/api/src" (tasks.md
// "⛔ เงื่อนไข merge" · security review of B05).
//
// `canAssignRole` is the F-002 compat wrapper: it hands `decideMemberAuthority`
// Owner MARKERS (`[full_access]` / `[]`) instead of the real capability sets,
// so a call site that still uses it keeps F-002's answer — and with it the
// lower → reset → raise impersonation path D-034 exists to close (AC-5.4b).
// Every member/invitation decision in the API must call `decideMemberAuthority`
// with the real sets. This gate is red while any production file under
// `apps/api/src` still REFERENCES the wrapper (call, import, alias — a rename
// on import would otherwise slip past a `canAssignRole(` match).
//
// PENDING: the invitation routes move in T-003-B18 (in flight in parallel).
// Their file is listed below and the entry must still be TRUE — once B18
// removes the last reference, the stale entry turns this gate red until the
// row is deleted, so the allowlist cannot outlive the work it waits for.
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

const SCOPE = "apps/api/src/";
const PENDING: Readonly<Record<string, string>> = Object.freeze({
  "apps/api/src/orgs/invitations.service.ts": "T-003-B18 moves invite create/reissue/cancel",
});
const REFERENCE = /\bcanAssignRole\b/g;

function gate(file: string, code: string): Violation[] {
  if (file in PENDING) return [];
  return [...code.matchAll(REFERENCE)].map((m) => ({
    gate: "no-canAssignRole",
    rule: "reference-in-api-src",
    file,
    line: lineOf(code, m.index!),
    snippet: code.slice(m.index!, m.index! + 80).split("\n")[0]!,
  }));
}

const files = productionFiles().filter((f) => f.startsWith(SCOPE));

describe("gate · apps/api/src never calls the F-002 wrapper canAssignRole (D-034 · AC-5.4b)", () => {
  it("non-vacuity: the scan reached the member routes, and they decide with decideMemberAuthority", () => {
    expect(files.length).toBeGreaterThan(50);
    expect(files).toContain("apps/api/src/orgs/members.service.ts");
    expect(
      [
        ...readCode("apps/api/src/orgs/members.service.ts").matchAll(
          /\bdecideMemberAuthority\s*\(/g,
        ),
      ].length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("★ production code under apps/api/src: no reference outside the PENDING list", () => {
    expect(files.flatMap((f) => gate(f, readCode(f)))).toEqual([]);
  });

  it("every PENDING entry is still true (a stale entry is red — delete the row)", () => {
    for (const [file, why] of Object.entries(PENDING)) {
      expect(files, `${file} (${why}) is gone`).toContain(file);
      expect(
        [...readCode(file).matchAll(REFERENCE)].length,
        `${file} no longer references canAssignRole — remove its PENDING row (${why})`,
      ).toBeGreaterThan(0);
    }
  });

  it.each(["no-car-aliased.fixture", "no-car-direct-call.fixture"])(
    "FIXTURE %s as members.service.ts turns the gate red",
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
