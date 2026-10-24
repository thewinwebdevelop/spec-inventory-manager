// F-003 · T-003-B10 — G3-07, the core-domain half: the characters core-domain's
// role-name validation refuses ≡ the class in the DB CHECK "Role_name_shape".
//
// packages/db/test/unicode-parity.test.ts pins SQL ≡ the set's DEFINITION
// (Cc ∪ Cf ∪ Default_Ignorable ∪ Co ∪ Cs ∪ 5 fillers — PM 2026-09-28). This file
// pins SQL ≡ what core-domain actually USES. It lives in apps/api because it is
// the one workspace that sees both packages (packages/db does not depend on
// core-domain).
//
// core-domain MUST export `ROLE_NAME_FORBIDDEN_CHARACTER` (a RegExp) and its
// code-point set must be set-equal to the SQL class. Renamed / narrowed back to
// Cc ∪ Cf ⇒ red, with the missing code points listed.
// (Before T-003-B04 landed this file fell back to the db-side definition when
// core-domain had no `validateRoleName`. B04 is merged, so the fallback is gone:
// a renamed export used to turn this test silently weaker — DV05 review.)
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import * as coreDomain from "@omnistock/core-domain";

const DB_PKG = join(__dirname, "..", "..", "..", "packages", "db");
const MIGRATIONS = join(DB_PKG, "prisma", "migrations");

interface UnicodeClassHelpers {
  codePointSet(re: RegExp): Set<number>;
  forbiddenRoleNameSet(): Set<number>;
  extractEscapedClasses(sql: string): string[];
  jsWhitespaceSet(): Set<number>;
  jsWhitespaceNonSpaceSet(): Set<number>;
  parseEscapedBracketClass(body: string): Set<number>;
  difference(a: Set<number>, b: Set<number>): string[];
}

/** The db package's parser — loaded by path so this project's rootDir stays `.`. */
async function helpers(): Promise<UnicodeClassHelpers> {
  const url = pathToFileURL(join(DB_PKG, "test", "unicode-class.ts")).href;
  return (await import(/* @vite-ignore */ url)) as UnicodeClassHelpers;
}

function roleExpandSql(): string {
  const hits = readdirSync(MIGRATIONS).filter((n) => n.endsWith("_f003_role_expand"));
  expect(hits, "exactly one *_f003_role_expand migration").toHaveLength(1);
  return readFileSync(join(MIGRATIONS, hits[0], "migration.sql"), "utf8");
}

const exported = coreDomain as unknown as Record<string, unknown>;

describe("G3-07 (core-domain half) — role-name forbidden characters: core-domain ≡ DB CHECK", () => {
  it("core-domain ROLE_NAME_FORBIDDEN_CHARACTER is set-equal to the SQL class", async () => {
    const h = await helpers();
    // the whitespace classes (leading/trailing/doubled/non-space JS \s) are pinned by
    // packages/db unicode-parity.test.ts; every OTHER escaped class is a forbidden class
    const isWs = (body: string) => {
      const set = h.parseEscapedBracketClass(body);
      return [h.jsWhitespaceSet(), h.jsWhitespaceNonSpaceSet()].some(
        (ws) => h.difference(ws, set).length === 0 && h.difference(set, ws).length === 0,
      );
    };
    const classes = h.extractEscapedClasses(roleExpandSql()).filter((b) => !isWs(b));
    expect(classes.length, "no forbidden-character class in f003_role_expand").toBeGreaterThan(0);

    const re = exported.ROLE_NAME_FORBIDDEN_CHARACTER;
    expect(
      re,
      "core-domain exports no ROLE_NAME_FORBIDDEN_CHARACTER RegExp — " +
        "point this test at the constant core-domain actually exports",
    ).toBeInstanceOf(RegExp);
    const single = new RegExp(
      `^(?:${(re as RegExp).source})$`,
      (re as RegExp).flags.replace("g", ""),
    );
    const expected = h.codePointSet(single);
    // non-vacuity: the constant is the widened set
    for (const n of [0x200b, 0x202e, 0x3164, 0x2800, 0xe000]) expect(expected.has(n)).toBe(true);

    // visible non-vacuity in the CI log (T-003-DV05)
    console.info(
      `[G3-07] ${classes.length} forbidden-character class(es) in f003_role_expand compared with ` +
        "core-domain ROLE_NAME_FORBIDDEN_CHARACTER " +
        `(${expected.size} code points, Node ${process.versions.node}, Unicode ${process.versions.unicode})`,
    );
    for (const body of classes) {
      const sqlSet = h.parseEscapedBracketClass(body);
      expect({
        missingFromSql: h.difference(expected, sqlSet),
        extraInSql: h.difference(sqlSet, expected),
      }).toEqual({ missingFromSql: [], extraInSql: [] });
    }
  }, 60_000);
});
