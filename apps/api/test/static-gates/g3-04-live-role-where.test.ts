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
  enclosingMethod,
  fixture,
  fixtureNames,
  lineOf,
  productionFiles,
  readCode,
  readRaw,
  topLevelEntries,
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
  /** `Class.method` holding the read (AST) — live reads are pinned per method. */
  owner: string;
  /** Line where the enclosing statement starts — the label goes right above it. */
  stmt: number;
}

/**
 * LIVE only when the call's own `where` IS the helper, or is an object literal
 * whose LAST top-level entry is `...LIVE_ROLE_WHERE` (review L-2): inside an
 * `OR` it can be bypassed, and a later spread/key can override `deletedAt`.
 */
function liveWhere(args: string): boolean {
  const inner = args.trim();
  if (!inner.startsWith("{")) return false;
  const where = topLevelEntries(balancedArgs(inner, 0)).find((e) => e.key === "where")?.value;
  if (where === undefined) return false;
  if (where === "LIVE_ROLE_WHERE") return true;
  if (!where.startsWith("{")) return false;
  const entries = topLevelEntries(balancedArgs(where, 0));
  return entries.length > 0 && entries[entries.length - 1]!.value === "...LIVE_ROLE_WHERE";
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
  const sites: RoleReadSite[] = [];
  const site = (pos: number, snippet: string, live: boolean) => {
    const stmt = statementLine(raw, pos);
    const labelled = LABEL.test(lines[stmt - 2] ?? "");
    sites.push({
      file,
      line: lineOf(code, pos),
      kind: live ? "live" : labelled ? "history" : "unlabelled",
      snippet,
      owner: enclosingMethod(code, pos),
      stmt,
    });
  };
  for (const m of code.matchAll(CALL))
    site(m.index!, m[0], liveWhere(balancedArgs(code, m.index! + m[0].length - 1)));
  for (const m of code.matchAll(RAW)) site(m.index!, m[0], false);
  // One label, one read (review L-2): a single history label above a statement
  // holding two non-live reads (`Promise.all([...])`) covers neither.
  for (const s of sites) {
    const shared = sites.filter((o) => o.stmt === s.stmt && o.kind !== "live");
    if (s.kind === "history" && shared.length > 1) s.kind = "unlabelled";
  }
  return sites.sort((a, b) => a.line - b.line);
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

  it("non-vacuity: at least the known call sites (api + db raw SQL) — new files may join", () => {
    expect(sites.length).toBeGreaterThanOrEqual(6);
    const seen = new Set(sites.map((s) => s.file));
    for (const known of [
      "apps/api/src/orgs/members.service.ts",
      "apps/api/src/orgs/roles.service.ts",
      "apps/api/src/orgs/invitations.service.ts",
      "packages/db/src/backfill-f003.ts",
    ])
      expect(seen, known).toContain(known);
  });

  it("★ no production Role read is unlabelled", () => {
    expect(files.flatMap((f) => g304(f, readRaw(f), readCode(f)))).toEqual([]);
  });

  /**
   * dm §2.2 live reads, pinned per METHOD (review M-2): another method in the
   * same file may legitimately be history (B25's deleted-row cap count in
   * roles.service.ts), but these may not — a history label here is a dodge.
   * B21–B25 add their live methods to this list.
   */
  const LIVE_METHODS: readonly (readonly [string, string])[] = [
    ["apps/api/src/orgs/roles.service.ts", "RolesService.list"], // GET /roles (MUT-10)
    ["apps/api/src/orgs/members.service.ts", "MembersService.updateRole"], // PATCH member new role
    ["apps/api/src/orgs/invitations.service.ts", "InvitationsService.accept"], // accept (B07 L-4)
    ["apps/api/src/orgs/invitations.service.ts", "InvitationsService.readRole"], // invite create
    ["apps/api/src/orgs/role-read.service.ts", "RoleReadService.listDetails"], // GET /role-details (B21)
    ["apps/api/src/orgs/role-read.service.ts", "RoleReadService.getDetail"], // GET /roles/{id} + live count (B21)
  ];

  it("★ the dm §2.2 live reads stay LIVE, per method — a history label cannot be used to dodge (MUT-10)", () => {
    for (const [file, method] of LIVE_METHODS) {
      const kinds = sites.filter((s) => s.file === file && s.owner === method).map((s) => s.kind);
      expect(
        kinds.length,
        `${method}: no Role read found — renamed? update LIVE_METHODS`,
      ).toBeGreaterThan(0);
      expect(
        kinds.every((k) => k === "live"),
        `${method}: ${kinds.join(",")}`,
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

  it("FIXTURES (L-2): helper not last / inside OR · one label over two reads → red", () => {
    for (const [name, n] of [
      ["g3-04-live-not-last.fixture", 2],
      ["g3-04-shared-label.fixture", 2],
    ] as const) {
      const { raw, code } = fixtureSites(name);
      expect(g304(name, raw, code).length, name).toBe(n);
    }
  });

  it("FIXTURE: a raw FOR SHARE read held in a `const … =` with the label above the const (B20 shape) → green; label inside the initializer → red", () => {
    const { raw, code } = fixtureSites("g3-04-const-sql-label.fixture");
    expect(roleReadSites("x.ts", raw, code).map((s) => s.kind)).toEqual([
      "history",
      "history",
      "unlabelled",
    ]);
  });

  it("FIXTURE: the labelled / live twins of the same shapes are green", () => {
    const { raw, code } = fixtureSites("g3-04-labelled.fixture");
    const found = roleReadSites("x.ts", raw, code);
    expect(found.map((s) => s.kind)).toEqual(["live", "history", "live", "history"]);
  });

  it("every g3-04 fixture on disk is exercised above", () => {
    expect(fixtureNames("g3-04-")).toEqual([
      "g3-04-const-sql-label.fixture",
      "g3-04-find-unique-or-throw.fixture",
      "g3-04-group-by.fixture",
      "g3-04-label-no-reason.fixture",
      "g3-04-labelled.fixture",
      "g3-04-live-not-last.fixture",
      "g3-04-raw-from-role.fixture",
      "g3-04-shared-label.fixture",
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
