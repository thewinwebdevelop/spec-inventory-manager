// F-003 · T-003-B10 — G3-07 Unicode parity (SR-04 · data-model §2.1 · test-plan §5.2).
//
// core-domain `validateRoleName` refuses a forbidden code point; the DB CHECK
// `Role_name_shape` refuses a bracket expression written into the migration.
// This gate makes the two the same set, code point for code point, against the
// Node that runs the test. A Node upgrade that grows a category turns this red —
// the fix is a NEW migration that re-creates the CHECK with the new class
// (never an edit to an applied one).
//
// The set is Cc ∪ Cf ∪ Default_Ignorable ∪ Co ∪ Cs ∪ 5 fillers (PM 2026-09-28,
// widened from data-model's Cc ∪ Cf by the B04 security review) — definition in
// ./unicode-class.ts. The core-domain side of the parity is
// apps/api/test/role-name-charset-parity.test.ts (packages/db does not depend on
// core-domain).
//
// Pure file reading: no database needed, so it runs in every lane.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { listRealMigrations } from "./migration-harness";
import {
  difference,
  extractForbiddenClasses,
  forbiddenRoleNameSet,
  parseEscapedBracketClass,
  renderEscapedClass,
} from "./unicode-class";

const MIGRATIONS = join(__dirname, "..", "prisma", "migrations");
const sqlOf = (name: string) => readFileSync(join(MIGRATIONS, name, "migration.sql"), "utf8");

const FORBIDDEN = forbiddenRoleNameSet();
const cp = (n: number) => String.fromCodePoint(n);

/** Compares one class body to the forbidden set; returns a failure message or null. */
function parityProblem(body: string): string | null {
  const sqlSet = parseEscapedBracketClass(body);
  const missing = difference(FORBIDDEN, sqlSet);
  const extra = difference(sqlSet, FORBIDDEN);
  if (missing.length === 0 && extra.length === 0) return null;
  return `missing from SQL: [${missing.join(", ")}] · extra in SQL: [${extra.join(", ")}]`;
}

describe("G3-07 Unicode parity — SQL forbidden-character class ≡ the Node set", () => {
  it("non-vacuity: the set is real — holds each family, excludes letters and Thai", () => {
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

  it("f003_role_expand carries a forbidden-character class (the gate is not scanning nothing)", () => {
    const name = listRealMigrations().find((n) => n.endsWith("_f003_role_expand"));
    expect(name, "no *_f003_role_expand migration under prisma/migrations").toBeDefined();
    expect(extractForbiddenClasses(sqlOf(name as string)).length).toBeGreaterThanOrEqual(1);
  });

  it("every forbidden-character class in every migration is set-equal to the Node set", () => {
    let seen = 0;
    const problems: string[] = [];
    for (const name of listRealMigrations()) {
      for (const body of extractForbiddenClasses(sqlOf(name))) {
        seen++;
        const p = parityProblem(body);
        if (p) problems.push(`${name}: ${p}`);
      }
    }
    expect(seen, "no forbidden-character class found in any migration").toBeGreaterThan(0);
    expect(
      problems,
      `Node ${process.versions.node} (Unicode ${process.versions.unicode}) disagrees with the SQL class. ` +
        `Expected class body:\n${renderEscapedClass(FORBIDDEN)}`,
    ).toEqual([]);
  });

  // ── self-check: the comparison can go red ──────────────────────────────────

  it("fixture: a class missing U+2060 (WORD JOINER) is reported", () => {
    const without = new Set(FORBIDDEN);
    without.delete(0x2060);
    const sql = `ALTER TABLE t ADD CHECK (name !~ '[${renderEscapedClass(without)}]');`;
    const [body] = extractForbiddenClasses(sql);
    expect(parityProblem(body)).toContain("missing from SQL: [U+2060]");
  });

  it("fixture: a class that is only Cc ∪ Cf (the pre-widening draft) is reported (misses U+3164)", () => {
    const narrow = new Set([...FORBIDDEN].filter((n) => /[\p{Cc}\p{Cf}]/u.test(cp(n))));
    const [body] = extractForbiddenClasses(`x !~ '[${renderEscapedClass(narrow)}]'`);
    expect(parityProblem(body)).toMatch(/missing from SQL: \[.*U\+3164/);
  });

  it("fixture: a class with an extra code point (U+0041) is reported", () => {
    const withA = new Set(FORBIDDEN);
    withA.add(0x41);
    const [body] = extractForbiddenClasses(`x !~ '[${renderEscapedClass(withA)}]'`);
    expect(parityProblem(body)).toContain("extra in SQL: [U+0041]");
  });

  it("control: the Node set rendered as SQL round-trips with no problem", () => {
    const [body] = extractForbiddenClasses(`x !~ '[${renderEscapedClass(FORBIDDEN)}]'`);
    expect(parityProblem(body)).toBeNull();
  });

  it("fixture: a raw invisible character inside a bracket literal fails loud", () => {
    expect(() => extractForbiddenClasses(`x !~ '[${cp(0x200b)}]'`)).toThrow(/raw non-ASCII/);
  });

  it("fixture: a bracket class with a non-escape token fails loud (never half-parsed)", () => {
    expect(() => parseEscapedBracketClass(String.raw`\u0001-\u001Fabc`)).toThrow(/expected/);
  });
});
