// F-003 · T-003-B15 ★ — G3-04 (test-plan §5.2 · data-model §2.2 "gate LIVE_ROLE_WHERE").
//
// Soft delete (D-036) only stays safe if every `Role` read says which world it
// reads: LIVE (offers/resolves a role for use — must hide deleted rows) or
// HISTORY (names a role from the past — must not). Per call site:
//   (ก) `LIVE_ROLE_WHERE` appears in the call's own argument, or
//   (ข) the line right above the enclosing statement is
//       `// role-read: history — <reason>` (reason required)
// Neither ⇒ red. Matching runs on comment-blanked code, so prose that mentions
// `.role.findMany(` is never a call site; the label is read from the raw text.
// MUT-10 (delete `LIVE_ROLE_WHERE` from `GET /roles`) must turn this red.
import { describe, it, expect } from "vitest";
import * as ts from "typescript";
import {
  balancedArgs,
  fixture,
  fixtureNames,
  lineOf,
  productionFiles,
  readCode,
  readRaw,
  type Violation,
} from "./scan";

const CALL =
  /\.role\.(findFirst|findFirstOrThrow|findUnique|findUniqueOrThrow|findMany|count|aggregate|groupBy)\s*\(/g;
const RAW = /\b(?:FROM|JOIN)\s+(?:"?public"?\s*\.\s*)?"Role"/gi;
const LABEL = /^\s*\/\/\s*role-read:\s*history\s+—\s+\S/;

export interface RoleReadSite {
  file: string;
  line: number;
  kind: "live" | "history" | "unlabelled";
  snippet: string;
}

/** Line (1-based) where the statement enclosing `pos` starts. */
function statementLine(raw: string, pos: number): number {
  const sf = ts.createSourceFile("s.ts", raw, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let found: ts.Node = sf;
  const visit = (node: ts.Node): void => {
    if (pos >= node.getStart(sf) && pos < node.getEnd()) {
      found = node;
      ts.forEachChild(node, visit);
    }
  };
  ts.forEachChild(sf, visit);
  let stmt: ts.Node = found;
  while (
    stmt.parent &&
    !ts.isBlock(stmt.parent) &&
    !ts.isSourceFile(stmt.parent) &&
    !ts.isModuleBlock(stmt.parent) &&
    !ts.isCaseClause(stmt.parent) &&
    !ts.isClassDeclaration(stmt.parent)
  )
    stmt = stmt.parent;
  return lineOf(raw, stmt.getStart(sf));
}

export function roleReadSites(file: string, raw: string, code: string): RoleReadSite[] {
  const lines = raw.split("\n");
  const labelled = (pos: number) => LABEL.test(lines[statementLine(raw, pos) - 2] ?? "");
  const sites: RoleReadSite[] = [];
  for (const m of code.matchAll(CALL)) {
    const open = m.index! + m[0].length - 1;
    const live = /\bLIVE_ROLE_WHERE\b/.test(balancedArgs(code, open));
    sites.push({
      file,
      line: lineOf(code, m.index!),
      kind: live ? "live" : labelled(m.index!) ? "history" : "unlabelled",
      snippet: m[0],
    });
  }
  for (const m of code.matchAll(RAW)) {
    sites.push({
      file,
      line: lineOf(code, m.index!),
      kind: labelled(m.index!) ? "history" : "unlabelled",
      snippet: m[0],
    });
  }
  return sites;
}

const g304 = (file: string, raw: string, code: string): Violation[] =>
  roleReadSites(file, raw, code)
    .filter((s) => s.kind === "unlabelled")
    .map((s) => ({
      gate: "G3-04",
      rule: "role-read-unlabelled",
      file,
      line: s.line,
      snippet: s.snippet,
    }));

const fixtureSites = (name: string) => {
  // `fixture()` blanks comments; the label check needs the raw text too.
  const code = fixture(name);
  const raw = readRaw(`apps/api/test/static-gates/__gate_fixtures__/${name}`);
  return { code, raw };
};

describe("G3-04 · every Role read is labelled live or history", () => {
  const files = productionFiles();
  const sites = files.flatMap((f) => roleReadSites(f, readRaw(f), readCode(f)));

  it("non-vacuity: the scan finds the known call sites (api + db raw SQL)", () => {
    expect(sites.length).toBeGreaterThanOrEqual(6);
    expect(new Set(sites.map((s) => s.file))).toEqual(
      new Set([
        "apps/api/src/orgs/members.service.ts",
        "apps/api/src/orgs/roles.service.ts",
        "apps/api/src/orgs/invitations.service.ts",
        "packages/db/src/backfill-f003.ts",
      ]),
    );
  });

  it("★ no production Role read is unlabelled", () => {
    expect(files.flatMap((f) => g304(f, readRaw(f), readCode(f)))).toEqual([]);
  });

  it("★ the dm §2.2 live reads stay LIVE — a history label cannot be used to dodge (MUT-10)", () => {
    // GET /roles · PATCH member (new role) · invite create/reissue · accept.
    for (const file of [
      "apps/api/src/orgs/roles.service.ts",
      "apps/api/src/orgs/members.service.ts",
      "apps/api/src/orgs/invitations.service.ts",
    ]) {
      const kinds = sites.filter((s) => s.file === file).map((s) => s.kind);
      expect(kinds.length, file).toBeGreaterThan(0);
      expect(
        kinds.every((k) => k === "live"),
        `${file}: ${kinds.join(",")}`,
      ).toBe(true);
    }
  });

  it('FIXTURES: findUniqueOrThrow · groupBy · raw FROM "Role" · label without reason → red', () => {
    const expected: Record<string, number> = {
      "g3-04-find-unique-or-throw.fixture": 1,
      "g3-04-group-by.fixture": 1,
      "g3-04-raw-from-role.fixture": 2,
      "g3-04-label-no-reason.fixture": 1,
    };
    for (const [name, n] of Object.entries(expected)) {
      const { raw, code } = fixtureSites(name);
      expect(g304(name, raw, code).length, name).toBe(n);
    }
  });

  it("FIXTURE: the labelled / live twins of the same shapes are green", () => {
    const { raw, code } = fixtureSites("g3-04-labelled.fixture");
    const found = roleReadSites("x.ts", raw, code);
    expect(found.map((s) => s.kind)).toEqual(["live", "history", "live", "history"]);
  });

  it("every g3-04 fixture on disk is exercised above", () => {
    expect(fixtureNames("g3-04-")).toEqual([
      "g3-04-find-unique-or-throw.fixture",
      "g3-04-group-by.fixture",
      "g3-04-label-no-reason.fixture",
      "g3-04-labelled.fixture",
      "g3-04-raw-from-role.fixture",
    ]);
  });

  it("SELF-CHECK: LIVE_ROLE_WHERE in a DIFFERENT call does not label this one", () => {
    const src = [
      "async function f(tx) {",
      "  const a = await tx.role.findMany({ where: { organizationId } });",
      "  const b = await tx.membership.findMany({ where: { role: LIVE_ROLE_WHERE } });",
      "}",
    ].join("\n");
    expect(roleReadSites("x.ts", src, src).map((s) => s.kind)).toEqual(["unlabelled"]);
  });
});
