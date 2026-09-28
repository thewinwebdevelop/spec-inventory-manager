// F-003 · T-003-B10 — G3-07 Unicode parity (SR-04 · data-model §2.1 · test-plan §5.2).
//
// core-domain `normalizeRoleName`/`validateRoleName` decide what a role name may
// hold; the DB CHECK `Role_name_shape` re-states it as regex bracket classes in
// the migration. This gate makes every such class EXACTLY one of the known
// sets, code point for code point, against the Node that runs the test:
//   forbidden        Cc ∪ Cf ∪ Default_Ignorable ∪ Co ∪ Cs ∪ 5 fillers (PM
//                    2026-09-28, widened from data-model's Cc ∪ Cf by the B04
//                    security review)
//   whitespace       JS `\s` — leading / trailing / doubled (B10 review, Medium)
//   non-space ws     JS `\s` minus U+0020 — must not appear at all (normalize
//                    collapses it to U+0020)
// A class equal to none of them is red (reported against the nearest set). A
// Node upgrade that grows a set turns this red — the fix is a NEW migration that
// re-creates the CHECK (never an edit to an applied one).
//
// The core-domain side of the forbidden-set parity is
// apps/api/test/role-name-charset-parity.test.ts (packages/db does not depend on
// core-domain). Pure file reading: no database needed, runs in every lane.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { listRealMigrations } from "./migration-harness";
import {
  difference,
  extractEscapedClasses,
  forbiddenRoleNameSet,
  jsWhitespaceNonSpaceSet,
  jsWhitespaceSet,
  parseEscapedBracketClass,
  renderEscapedClass,
} from "./unicode-class";

const MIGRATIONS = join(__dirname, "..", "prisma", "migrations");
const sqlOf = (name: string) => readFileSync(join(MIGRATIONS, name, "migration.sql"), "utf8");

const KNOWN: Readonly<Record<string, Set<number>>> = {
  forbidden: forbiddenRoleNameSet(),
  whitespace: jsWhitespaceSet(),
  "non-space whitespace": jsWhitespaceNonSpaceSet(),
};
const FORBIDDEN = KNOWN.forbidden;
const cp = (n: number) => String.fromCodePoint(n);

/** First 40 code points of a difference list (+ how many more). */
const head = (l: string[]) =>
  l.slice(0, 40).join(", ") + (l.length > 40 ? `, … +${l.length - 40}` : "");

/** Which known set `body` equals, or a failure message against the nearest one. */
function classify(body: string): { set: string } | { problem: string } {
  const sqlSet = parseEscapedBracketClass(body);
  let nearest = "";
  let best = Infinity;
  let msg = "";
  for (const [name, set] of Object.entries(KNOWN)) {
    const missing = difference(set, sqlSet);
    const extra = difference(sqlSet, set);
    if (missing.length === 0 && extra.length === 0) return { set: name };
    // nearest = the known set sharing the most code points with the SQL class
    const shared = set.size - missing.length;
    if (-shared < best) {
      best = -shared;
      nearest = name;
      msg = `missing from SQL: [${head(missing)}] · extra in SQL: [${head(extra)}]`;
    }
  }
  return { problem: `equals no known set; nearest '${nearest}' — ${msg}` };
}
const problemOf = (body: string) => {
  const c = classify(body);
  return "problem" in c ? c.problem : null;
};

describe("G3-07 Unicode parity — SQL role-name classes ≡ the Node sets", () => {
  it("non-vacuity: the forbidden set is real — holds each family, excludes letters and Thai", () => {
    const must = {
      "U+200B ZWSP (Cf)": 0x200b,
      "U+202E RLO (Cf)": 0x202e,
      "U+2060 WORD JOINER (Cf)": 0x2060,
      "U+0009 TAB (Cc)": 0x09,
      "U+034F CGJ (Default_Ignorable only)": 0x34f,
      "U+FE0F VS16 (Default_Ignorable only)": 0xfe0f,
      "U+3164 HANGUL FILLER": 0x3164,
      "U+2800 BRAILLE BLANK": 0x2800,
      "U+E000 private use (Co)": 0xe000,
      "U+D800 surrogate (Cs)": 0xd800,
    };
    for (const [label, n] of Object.entries(must)) expect(FORBIDDEN.has(n), label).toBe(true);
    for (const ok of ["A", "ก", "ั", "่", " ", "é"])
      expect(FORBIDDEN.has(ok.codePointAt(0) as number), ok).toBe(false);
  });

  it("non-vacuity: the whitespace sets are JS \\s (NBSP, U+3000 in; letters out; U+0020 only in the first)", () => {
    for (const n of [0x20, 0xa0, 0x3000, 0x2028, 0x202f, 0xfeff])
      expect(KNOWN.whitespace.has(n), n.toString(16)).toBe(true);
    for (const n of [0xa0, 0x3000]) expect(KNOWN["non-space whitespace"].has(n)).toBe(true);
    expect(KNOWN["non-space whitespace"].has(0x20)).toBe(false);
    expect(KNOWN.whitespace.has(0x41)).toBe(false);
  });

  it("f003_role_expand carries every known class (the gate is not scanning nothing)", () => {
    const name = listRealMigrations().find((n) => n.endsWith("_f003_role_expand"));
    expect(name, "no *_f003_role_expand migration under prisma/migrations").toBeDefined();
    const found = new Set(
      extractEscapedClasses(sqlOf(name as string)).map((b) => {
        const c = classify(b);
        return "set" in c ? c.set : "?";
      }),
    );
    for (const k of Object.keys(KNOWN)) expect(found.has(k), `no '${k}' class`).toBe(true);
  });

  it("every escaped class in every migration equals a known Node set", () => {
    let seen = 0;
    const problems: string[] = [];
    for (const name of listRealMigrations()) {
      for (const body of extractEscapedClasses(sqlOf(name))) {
        seen++;
        const p = problemOf(body);
        if (p) problems.push(`${name}: ${p}`);
      }
    }
    expect(seen, "no escaped class found in any migration").toBeGreaterThan(0);
    expect(
      problems,
      `Node ${process.versions.node} (Unicode ${process.versions.unicode}) disagrees with the SQL. ` +
        `Expected bodies:\n` +
        Object.entries(KNOWN)
          .map(([k, s]) => `${k}: ${renderEscapedClass(s)}`)
          .join("\n"),
    ).toEqual([]);
  });

  // ── self-check: the comparison can go red ──────────────────────────────────

  it("fixture: a forbidden class missing U+2060 (WORD JOINER) is reported", () => {
    const without = new Set(FORBIDDEN);
    without.delete(0x2060);
    const [body] = extractEscapedClasses(
      `ALTER TABLE t ADD CHECK (name !~ '[${renderEscapedClass(without)}]');`,
    );
    expect(problemOf(body)).toContain("nearest 'forbidden' — missing from SQL: [U+2060]");
  });

  it("fixture: a Cc ∪ Cf-only class (the pre-widening draft) is reported (misses U+3164)", () => {
    const narrow = new Set([...FORBIDDEN].filter((n) => /[\p{Cc}\p{Cf}]/u.test(cp(n))));
    const [body] = extractEscapedClasses(`x !~ '[${renderEscapedClass(narrow)}]'`);
    expect(problemOf(body)).toMatch(/missing from SQL: \[.*U\+3164/);
  });

  it("fixture: a whitespace class missing U+3000 (inside '^[...]') is reported", () => {
    const ws = jsWhitespaceSet();
    ws.delete(0x3000);
    const bodies = extractEscapedClasses(`x !~ '^[${renderEscapedClass(ws)}]'`);
    expect(bodies).toHaveLength(1);
    expect(problemOf(bodies[0])).toContain("missing from SQL: [U+3000]");
  });

  it("fixture: a class with an extra code point (U+0041) is reported", () => {
    const withA = new Set(FORBIDDEN);
    withA.add(0x41);
    const [body] = extractEscapedClasses(`x !~ '[${renderEscapedClass(withA)}]'`);
    expect(problemOf(body)).toContain("extra in SQL: [U+0041]");
  });

  it("control: every known set rendered as SQL (in all positions) round-trips with no problem", () => {
    const w = renderEscapedClass(KNOWN.whitespace);
    const sql =
      `x !~ '[${renderEscapedClass(FORBIDDEN)}]' AND x !~ '^[${w}]' AND x !~ '[${w}]$' ` +
      `AND x !~ '[${w}][${w}]' AND x !~ '[${renderEscapedClass(KNOWN["non-space whitespace"])}]'`;
    const bodies = extractEscapedClasses(sql);
    expect(bodies).toHaveLength(6);
    for (const b of bodies) expect(problemOf(b)).toBeNull();
  });

  it("apostrophes in -- comments do not shift the literal pairing", () => {
    const sql = `-- the database's ctype\nCHECK (x !~ '[${renderEscapedClass(KNOWN.whitespace)}]') -- it's fine`;
    expect(extractEscapedClasses(sql)).toHaveLength(1);
  });

  it("fixture: a raw invisible character inside a bracket fails loud", () => {
    expect(() => extractEscapedClasses(`x !~ '[${cp(0x200b)}]'`)).toThrow(/raw non-ASCII/);
  });

  it("fixture: a bracket class with a non-escape token fails loud (never half-parsed)", () => {
    expect(() => parseEscapedBracketClass(String.raw`\u0001-\u001Fabc`)).toThrow(/expected/);
  });
});
