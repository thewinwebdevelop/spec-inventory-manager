// F-002 — where a route-tier mark is ALLOWED to sit, checked across EVERY
// controller rather than a list somebody has to remember to extend.
//
// ── The rule ───────────────────────────────────────────────────────────────
// On a controller whose path carries `:orgId`, the tier (`@Public()`,
// `@UserScoped()`, `@SystemScoped()`) belongs on the HANDLER, never on the
// class. A class-level mark is inherited by every handler added afterwards, and
// the inherited one is always the permissive one: `OrgScopeGuard`'s `user`
// branch checks only that a token is valid, and `CapabilityGuard` returns early
// for any declared tier. So a sibling handler added later silently becomes
// "any logged-in user may do this, in any shop".
//
// That is not hypothetical. It was High-1 of the f66451f security review:
// `@UserScoped()` sat on the `MembersController` CLASS, one handler saved it,
// and `PATCH`/`DELETE` member were about to land on the same prefix.
//
// ── Why this file replaces the original check ──────────────────────────────
// The fix shipped with a test that pinned THREE controllers by hand. Twelve
// exist, and eight of the nine it did not cover carry `:orgId` — so the rule it
// claimed to enforce protected only the controller that had already been fixed.
// A guard that looks general and is not is worse than an obvious gap: it stops
// anyone looking again.
//
// This scans the source tree instead, so a controller added tomorrow is covered
// the moment it exists, and the count assertion makes "a new file appeared"
// something you have to look at rather than something you can miss.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(__dirname, "..", "src");

interface ControllerDecl {
  readonly file: string;
  readonly path: string;
  readonly classMarks: readonly string[];
}

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, acc);
    else if (full.endsWith(".ts") && !full.includes(".test.")) acc.push(full);
  }
  return acc;
}

/**
 * Every `@Controller(...)` in production source, with the tier decorators
 * attached to the CLASS (the ones immediately above it, before the decorator).
 */
function declaredControllers(): ControllerDecl[] {
  const found: ControllerDecl[] = [];
  for (const file of sourceFiles(SRC)) {
    const source = readFileSync(file, "utf8");
    const match = source.match(
      /((?:@(?:Public|UserScoped|SystemScoped)\(\)\s*\n\s*)*)@Controller\(\s*("([^"]*)")?/,
    );
    if (!match) continue;
    found.push({
      file: file.slice(SRC.length + 1),
      path: match[3] ?? "/",
      classMarks: match[1]?.match(/@\w+\(\)/g) ?? [],
    });
  }
  return found;
}

describe("route-tier marks are placed where a new sibling cannot inherit them", () => {
  const controllers = declaredControllers();

  it("the scan found the controllers that exist (a scan that finds none proves nothing)", () => {
    // Vacuity floor. If the regex or the walk breaks, every assertion below
    // passes over an empty list — the failure mode that makes a green suite a
    // lie. The number is deliberately a floor, not an equality: adding a
    // controller should not fail THIS test, it should be covered by the next.
    expect(controllers.length).toBeGreaterThanOrEqual(12);
    expect(controllers.map((c) => c.file)).toContain("orgs/invitations.controller.ts");
    expect(controllers.map((c) => c.file)).toContain("auth/members.controller.ts");
  });

  it("★ no controller whose path carries :orgId declares a tier at CLASS level", () => {
    const offenders = controllers
      .filter((c) => c.path.includes(":orgId") && c.classMarks.length > 0)
      .map((c) => `${c.file} → @Controller("${c.path}") ${c.classMarks.join(" ")}`);

    // The fix is to move the decorator onto each handler — never to add the
    // controller to an exception list. The rule's whole value is that it holds
    // without anyone having to notice.
    expect(offenders).toEqual([]);
  });

  it("class-level marks stay fine where the path has no org parameter", () => {
    // The rule is about inheritance reaching an org-scoped sibling, not about
    // class-level marks being wrong in general: `/auth/*` is genuinely public as
    // a whole, and a future `/auth/...` endpoint SHOULD inherit that.
    const marked = controllers.filter((c) => c.classMarks.length > 0);
    expect(marked.length).toBeGreaterThan(0);
    for (const c of marked) {
      expect(c.path.includes(":orgId"), `${c.file} carries :orgId`).toBe(false);
    }
  });

  it("every org-scoped controller is left unmarked, i.e. org-scoped by default (§1.1)", () => {
    // The positive half: default-deny only means anything if these really do
    // say nothing. A controller that declared `@SystemScoped()` here would be
    // refused outright (F-085 is not built), which is a different bug with the
    // same root.
    const orgScoped = controllers.filter((c) => c.path.includes(":orgId"));
    expect(orgScoped.length).toBeGreaterThanOrEqual(6);
    for (const c of orgScoped) expect(c.classMarks, c.file).toEqual([]);
  });
});
