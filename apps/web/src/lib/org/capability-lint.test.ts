/**
 * ★ T-002-Q5 — the tripwire for the bug that came back five times.
 *
 * `full_access` is a wildcard. A system Owner's role carries it and nothing
 * else, so any capability question written as plain set membership answers
 * "no" for the person who may do everything. That mistake shipped in SIX
 * places — the sidebar (`useCan`), the tax card's edit gate, the onboarding
 * card (whose backup-owner nudge is *defined* for an Owner alone in their
 * shop, inside a function that returned early for Owners), the profile
 * screen's rename gate, the leave dialog's "here is the way out" link, and
 * mobile's `ActiveOrg.can`. Every one of them was written by somebody with no
 * reason to suspect the rule was more than `Set.has`.
 *
 * Unit tests cannot catch this class, and it is worth being precise about why:
 * each of them PASSES ITS OWN capability list — `["manage_members"]`,
 * `["manage_org_settings"]` — so they describe a user who does not exist. 305
 * green web tests and 200+ green integration tests all agreed with the code.
 *
 * So the guard is structural, like the G-15 role-write tripwire: ask the
 * SOURCE whether anybody is deciding a capability question outside the one
 * place that knows the rule.
 *
 * It reads files and never imports them, and it scans the Flutter tree too —
 * the same defect existed on both sides, and Dart's analyzer cannot express
 * this rule while the TypeScript lane cannot see Dart.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { can } from "./capability";

/** cwd is `apps/web` under vitest. */
const REPO_ROOT = join(process.cwd(), "..", "..");
const WEB_SRC = join(REPO_ROOT, "apps/web/src");
const MOBILE_LIB = join(REPO_ROOT, "apps/mobile/lib");

/**
 * A membership test on a capability collection.
 *
 * Anchored on the RECEIVER (`…capabilities` / `…caps`) rather than on the
 * argument: `ownerRoleIds.has(role.id)` and `entitlements.contains(x)` are
 * different questions with different rules, and a lint that swept them up
 * would be switched off within a week.
 */
const MEMBERSHIP = /\b(\w*(?:apabilities|Caps|caps))\.(has|contains|includes)\(\s*([^)]*?)\s*\)/g;

/**
 * Asking whether somebody holds `full_access` ITSELF is not the bug — it is
 * the wildcard, and `isOwner` has to ask about it directly. Only questions
 * about OTHER capabilities have to go through `can`.
 */
const FULL_ACCESS_ARGUMENT = /FULL_ACCESS|fullAccessCapability|['"]full_access['"]/;

/**
 * The one place per platform that may implement the rule.
 *
 * ⚠️ Mobile's moved. It lived in `session_state.dart` until the M-07 security
 * review pointed out that file imports `package:flutter/foundation.dart`, so a
 * `domain/` file importing the rule was pulling Flutter in transitively — the
 * boundary gate only inspects DIRECT imports and could not see it. The rule is
 * now in a Flutter-free `capabilities.dart`, and this list had to follow: for
 * one run the guard failed the build on the very file that implements the
 * thing it protects, which is the guard being stale rather than right.
 */
const ALLOWED = Object.freeze([
  "apps/web/src/lib/org/capability.ts",
  "apps/mobile/lib/core/session/capabilities.dart",
]);

/**
 * ★ The WRITE side of the same rule — added 2026-08-20, after the read-side
 * guard above had been green for weeks over a client that was making
 * capabilities up.
 *
 * `org_repository_impl.dart` filled the creator's capability set with a literal
 * `{'full_access'}`, under a comment claiming the `201` said so. It does not:
 * `POST /organizations` returns `membership.roleKey` and no capability list.
 * The value matched what the server provisions, so nothing failed — a client
 * had simply written down an authorization fact nobody told it, in a codebase
 * whose golden rule is that ownership is a capability and never a role key.
 *
 * The scan found four more copies while it was at it: `CAPABILITY_FULL_ACCESS`
 * declared TWICE in the web tree, `CAPABILITY_MANAGE_MEMBERS` twice,
 * `manage_org_settings` once inside a feature on mobile. All correct, all
 * hand-typed, and every one of them the same shape as the second copy that put
 * the wildcard bug in six places.
 *
 * So: a capability NAME may appear as a literal only where the rule lives.
 * Everywhere else, import it.
 */
const CAPABILITY_LITERAL = /['"](full_access|manage_members|manage_org_settings)['"]/g;

export interface Offence {
  readonly file: string;
  readonly snippet: string;
}

/** Every raw membership test outside the sanctioned files. */
export function findOffences(files: readonly { path: string; source: string }[]): Offence[] {
  const offences: Offence[] = [];
  for (const { path, source } of files) {
    if (ALLOWED.includes(path)) continue;
    const code = stripComments(source);
    for (const match of code.matchAll(MEMBERSHIP)) {
      if (FULL_ACCESS_ARGUMENT.test(match[3])) continue;
      offences.push({ file: path, snippet: match[0] });
    }
  }
  return offences;
}

/** Every capability name written as a literal outside the sanctioned files. */
export function findLiterals(files: readonly { path: string; source: string }[]): Offence[] {
  const offences: Offence[] = [];
  for (const { path, source } of files) {
    if (ALLOWED.includes(path)) continue;
    for (const match of stripComments(source).matchAll(CAPABILITY_LITERAL)) {
      offences.push({ file: path, snippet: match[0] });
    }
  }
  return offences;
}

/** Comments explain the rule by quoting it; prose is not code. */
export function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("///"))
    .join("\n");
}

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === "gen" || entry === "node_modules" || entry === ".next") continue;
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

describe("★ capability questions go through the shared rule, never Set membership", () => {
  const files = [...walk(WEB_SRC), ...walk(MOBILE_LIB)].map((path) => ({
    path: relative(REPO_ROOT, path).split(sep).join("/"),
    source: readFileSync(path, "utf8"),
  }));

  it("the scan reached both trees, and the sanctioned files exist", () => {
    // A guard that scanned nothing would be green forever — the failure mode
    // that makes the next person delete it rather than trust it.
    expect(files.some((f) => f.path.startsWith("apps/web/src")), "web tree not scanned").toBe(true);
    expect(files.some((f) => f.path.startsWith("apps/mobile/lib")), "mobile tree not scanned").toBe(
      true,
    );
    expect(files.length).toBeGreaterThan(50);
    for (const allowed of ALLOWED) {
      expect(
        files.some((f) => f.path === allowed),
        `${allowed} is not in the scan — the allow-list is pointing at nothing`,
      ).toBe(true);
    }
  });

  it("SELF-CHECK: the pattern catches the real defect and spares the real code", () => {
    // The exact line that shipped, and the exact line that replaced it.
    const bad = findOffences([
      { path: "x.ts", source: "const canEdit = capabilities.has(CAPABILITY_MANAGE_ORG_SETTINGS);" },
    ]);
    expect(bad, "the pattern would not have caught the bug it exists for").toHaveLength(1);

    const dartBad = findOffences([
      { path: "x.dart", source: "bool can(String c) => capabilities.contains(c);" },
    ]);
    expect(dartBad, "the Dart form of the same bug is invisible").toHaveLength(1);

    // …and the things that must NOT trip: asking about the wildcard itself,
    // a different collection entirely, and the sanctioned implementation.
    expect(
      findOffences([
        { path: "a.ts", source: "capabilities.has(CAPABILITY_FULL_ACCESS) && members === 1" },
        { path: "b.ts", source: "ownerRoleIds.has(role.id)" },
        { path: "c.dart", source: "entitlements.contains('accounting')" },
        { path: "apps/web/src/lib/org/capability.ts", source: "capabilities.has(x)" },
      ]),
    ).toEqual([]);
  });

  it("★ no source file decides a capability question on its own", () => {
    const offences = findOffences(files);
    expect(
      offences.map((o) => `${o.file}: ${o.snippet}`),
      "use `can(capabilities, X)` (web) or `ActiveOrg.can` (mobile) — `full_access` is a wildcard",
    ).toEqual([]);
  });

  it("★ no source file writes a capability NAME of its own", () => {
    const offences = findLiterals(files);
    expect(
      offences.map((o) => `${o.file}: ${o.snippet}`),
      "import the name — a hand-typed capability string is a second copy of a server fact",
    ).toEqual([]);
  });

  it("SELF-CHECK: the literal scan catches the defect it was written for", () => {
    // The line that shipped, and the two shapes that must not trip: the file
    // that defines the names, and prose that quotes one.
    expect(
      findLiterals([
        { path: "x.dart", source: "capabilities: const {'full_access'}," },
      ]),
      "the scan would not have caught the client that invented a capability set",
    ).toHaveLength(1);

    expect(
      findLiterals([
        { path: "apps/web/src/lib/org/capability.ts", source: 'export const X = "full_access";' },
        { path: "y.ts", source: '// the code filled in "full_access" and should not have' },
        { path: "z.dart", source: "/// a comment naming 'manage_members' is prose" },
      ]),
    ).toEqual([]);
  });

  it("the rule itself still holds: an Owner holding only full_access can do anything", () => {
    // The tripwire above is about WHERE the question is asked. This is the
    // answer it must give — the case no component test had ever supplied.
    const ownersRole = new Set(["full_access"]);
    expect(can(ownersRole, "manage_members")).toBe(true);
    expect(can(ownersRole, "manage_org_settings")).toBe(true);
    expect(can(ownersRole, "anything_f003_invents_later")).toBe(true);

    const staff = new Set(["view_products"]);
    expect(can(staff, "manage_members")).toBe(false);
    expect(can(staff, "view_products")).toBe(true);
  });
});
