// F-003 · T-003-QA02 — G-06 (F-002 test-plan §10 · F-003 test-plan §5.2 · AC-10.1).
//
// `Membership.status = 'invited'` is a dead state (F-002 data-model §18): the
// leak kit, the member list and every decision path treat it as "not a member",
// and nothing in the product creates it. G-06 keeps it that way, because the
// day something does write it, F-002's persona matrix is no longer complete.
//
// Three ways to write it, three rules:
//   1. `status: "invited"` (or the enum member) in code.
//   2. raw SQL that sets or inserts 'invited'.
//   3. a Membership create that sets NO status: the column DEFAULT is
//      'invited' (init migration), so silence IS the write.
//
// ⚠️ Heuristic, not a proof: a status taken from a variable is not followed.
import { describe, it, expect } from "vitest";
import {
  balancedArgs,
  blankComments,
  fixture,
  fixtureNames,
  lineOf,
  productionFiles,
  readCode,
  readRaw,
  sqlCode,
  sqlMigrationFiles,
  type Violation,
} from "./scan";

const INVITED_IN_CODE =
  /\bstatus\s*:\s*(?:\{\s*set\s*:\s*)?(?:(["'`])invited\1|(?:\$Enums\s*\.\s*)?MembershipStatus\s*\.\s*invited\b)/g;
/** `UPDATE "Membership" SET … status = 'invited'` — in the SET list, before any WHERE. */
const RAW_UPDATE_INVITED =
  /UPDATE\s+"?Membership"?\b(?:(?!\bWHERE\b)[^;])*?\bSET\b(?:(?!\bWHERE\b)[^;])*?"?status"?\s*=\s*'invited'/gi;
const RAW_INSERT_INVITED = /INSERT\s+INTO\s+"?Membership"?\b[^;]*?'invited'/gi;
const RAW_INSERT_COLUMNS = /INSERT\s+INTO\s+"?Membership"?\s*\(([^)]*)\)/gi;
const MEMBERSHIP_CREATE =
  /\bmembership\s*\.\s*(create|createMany|createManyAndReturn|upsert)\s*\(/g;
const MEMBERSHIP_WRITE =
  /\bmembership\s*\.\s*(create|createMany|createManyAndReturn|upsert|update|updateMany)\s*\(/g;

function g06(file: string, code: string): Violation[] {
  const out: Violation[] = [];
  const hit = (rule: string, index: number, snippet: string) =>
    out.push({
      gate: "G-06",
      rule,
      file,
      line: lineOf(code, index),
      snippet: snippet.slice(0, 120),
    });

  for (const m of code.matchAll(INVITED_IN_CODE)) hit("invited-literal", m.index!, m[0]);
  for (const m of code.matchAll(RAW_UPDATE_INVITED)) hit("raw-sql-invited", m.index!, m[0]);
  for (const m of code.matchAll(RAW_INSERT_INVITED)) hit("raw-sql-invited", m.index!, m[0]);
  for (const m of code.matchAll(RAW_INSERT_COLUMNS)) {
    if (!/"?status"?/.test(m[1])) hit("implicit-default", m.index!, m[0]);
  }
  for (const m of code.matchAll(MEMBERSHIP_CREATE)) {
    const args = balancedArgs(code, m.index! + m[0].length - 1);
    // upsert: only the `create:` branch can produce a new row.
    const scope = m[1] === "upsert" ? (/\bcreate\s*:\s*\{[\s\S]*/.exec(args)?.[0] ?? "") : args;
    if (!/\bstatus\s*:/.test(scope)) hit("implicit-default", m.index!, m[0]);
  }
  return out;
}

const tsFiles = productionFiles();
const sqlFiles = sqlMigrationFiles();

describe("G-06 · no write path produces Membership.status = 'invited'", () => {
  it("non-vacuity: the scan reached the real membership write paths", () => {
    expect(tsFiles.length).toBeGreaterThan(50);
    expect(sqlFiles.length).toBeGreaterThan(0);
    expect(tsFiles).toContain("apps/api/src/orgs/invitations.service.ts");
    const writes = tsFiles.flatMap((f) => [...readCode(f).matchAll(MEMBERSHIP_WRITE)]);
    expect(
      writes.length,
      "found no membership writes — the scanner is blind",
    ).toBeGreaterThanOrEqual(4);
    const creates = tsFiles.flatMap((f) => [...readCode(f).matchAll(MEMBERSHIP_CREATE)]);
    expect(
      creates.length,
      "found no membership creates — rule 3 checked nothing",
    ).toBeGreaterThanOrEqual(2);
  });

  it("★ production code and migrations never write 'invited'", () => {
    const offenders = [
      ...tsFiles.flatMap((f) => g06(f, readCode(f))),
      ...sqlFiles.flatMap((f) => g06(f, sqlCode(f))),
    ];
    expect(offenders).toEqual([]);
  });

  it("the schema still defaults to 'invited' — the reason rule 3 exists", () => {
    // If this flips, rule 3 is still harmless; revisit it rather than delete it.
    expect(readRaw("packages/db/prisma/schema.prisma")).toMatch(
      /status\s+MembershipStatus\s+@default\(invited\)/,
    );
  });

  it.each([
    ["g06-update-invited.fixture", "invited-literal"],
    ["g06-raw-sql-invited.fixture", "raw-sql-invited"],
    ["g06-implicit-default.fixture", "implicit-default"],
  ])("FIXTURE %s turns the gate red (%s)", (name, rule) => {
    const found = g06(name, fixture(name));
    expect(found.map((v) => v.rule)).toContain(rule);
  });

  it("every g06 fixture on disk is exercised above", () => {
    expect(fixtureNames("g06-")).toEqual([
      "g06-implicit-default.fixture",
      "g06-raw-sql-invited.fixture",
      "g06-update-invited.fixture",
    ]);
  });

  it("SELF-CHECK: flags the write shapes, clears the legitimate ones", () => {
    const red = [
      'data: { status: "invited" }',
      "data: { status: 'invited', roleId }",
      "data: { status: { set: `invited` } }",
      "data: { status: MembershipStatus.invited }",
      "data: { status: $Enums.MembershipStatus.invited }",
      `UPDATE "Membership" SET "roleId" = $1, status = 'invited' WHERE id = $2`,
      `INSERT INTO "Membership" ("id","status") VALUES ($1, 'invited')`,
      `INSERT INTO "Membership" ("id","userId","roleId") VALUES ($1,$2,$3)`,
      "tx.membership.createMany({ data: rows })",
      "tx.membership.upsert({ where, update: { status: 'active' }, create: { userId } })",
    ];
    for (const s of red) expect(g06("self", s).length, `NOT FLAGGED: ${s}`).toBeGreaterThan(0);

    const green = [
      'where: { status: "active" }',
      'return m.status === "invited" ? null : m;',
      'data: { status: "revoked", revokedAt }',
      'tx.membership.create({ data: { userId, roleId, status: "active" } })',
      "tx.membership.upsert({ where, update: {}, create: { userId, status: 'active' } })",
      `UPDATE "Membership" SET status = 'revoked' WHERE status = 'invited'`,
      `CREATE TABLE "Membership" ("status" "MembershipStatus" NOT NULL DEFAULT 'invited')`,
      "tx.membership.update({ where, data: { roleId } })",
    ];
    for (const s of green) expect(g06("self", s), `FALSE POSITIVE: ${s}`).toEqual([]);
    // Prose is not code: comments are blanked before matching.
    expect(g06("self", blankComments('// never write status: "invited"'))).toEqual([]);
  });
});
