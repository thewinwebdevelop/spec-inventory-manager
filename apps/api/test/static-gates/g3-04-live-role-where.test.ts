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
  /** The call's argument text (`""` for raw SQL) — what a history allowance is matched on. */
  args: string;
  /** The history label's reason (text after `—`), when labelled. */
  reason: string | null;
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
  const site = (pos: number, snippet: string, live: boolean, args: string) => {
    const stmt = statementLine(raw, pos);
    const above = lines[stmt - 2] ?? "";
    const labelled = LABEL.test(above);
    sites.push({
      file,
      line: lineOf(code, pos),
      kind: live ? "live" : labelled ? "history" : "unlabelled",
      snippet,
      owner: enclosingMethod(code, pos),
      stmt,
      args,
      reason: labelled ? above.replace(/^\s*\/\/\s*role-read:\s*history\s+—\s+/, "").trim() : null,
    });
  };
  for (const m of code.matchAll(CALL)) {
    const args = balancedArgs(code, m.index! + m[0].length - 1);
    site(m.index!, m[0], liveWhere(args), args);
  }
  for (const m of code.matchAll(RAW)) site(m.index!, m[0], false, "");
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

/**
 * dm §2.2 live reads, pinned per METHOD (review M-2 · T-003-B25). Every Role
 * read of a pinned method must be LIVE — a history label there is a dodge —
 * except the read its `allow` names EXACTLY: the deleted-row cap of
 * `RolesService.delete` counts soft-deleted rows on
 * purpose (data-model §2.2 "History reads … นับเพดาน soft-delete"), and that one
 * call shape, with that label reason, is the only history a pinned method holds.
 */
export interface HistoryAllowance {
  /** The call (whitespace-free) — `.role.count(`. */
  readonly snippet: string;
  /** The call's argument text, verbatim. */
  readonly args: string;
  /** The label's reason must start with this. */
  readonly reason: string;
}
export interface LivePin {
  readonly file: string;
  readonly method: string;
  readonly allow?: HistoryAllowance;
}
const DELETED_ROW_CAP: HistoryAllowance = Object.freeze({
  snippet: ".role.count(",
  args: "{ where: { deletedAt: { not: null } } }",
  reason: "deleted-row cap",
});
const ORGS = "apps/api/src/orgs";
const LIVE_METHODS: readonly LivePin[] = [
  { file: `${ORGS}/roles.service.ts`, method: "RolesService.list" }, // GET /roles (MUT-10)
  { file: `${ORGS}/members.service.ts`, method: "MembersService.updateRole" }, // PATCH member new role
  { file: `${ORGS}/invitations.service.ts`, method: "InvitationsService.accept" }, // accept (B07 L-4)
  { file: `${ORGS}/invitations.service.ts`, method: "InvitationsService.readRole" }, // invite create
  { file: `${ORGS}/role-read.service.ts`, method: "RoleReadService.listDetails" }, // GET /role-details (B21)
  { file: `${ORGS}/role-read.service.ts`, method: "RoleReadService.getDetail" }, // GET /roles/{id} + live count (B21)
  { file: `${ORGS}/roles.service.ts`, method: "RolesService.create" }, // reserved names + live cap (B23)
  { file: `${ORGS}/roles.service.ts`, method: "RolesService.update" }, // the edited role (B24)
  { file: `${ORGS}/roles.service.ts`, method: "RolesService.validateNameInTx" }, // reserved names (B24)
  // T-003-B25 — the deleted role is looked up LIVE; its deleted-row cap is the one history read
  { file: `${ORGS}/roles.service.ts`, method: "RolesService.delete", allow: DELETED_ROW_CAP },
];

/** Each pinned method that has no Role read, or a read that is neither live nor its exact allowance. */
export function pinViolations(sites: readonly RoleReadSite[], pins: readonly LivePin[]): string[] {
  const out: string[] = [];
  for (const pin of pins) {
    const mine = sites.filter((s) => s.file === pin.file && s.owner === pin.method);
    if (mine.length === 0) {
      out.push(`${pin.method}: no Role read found — renamed? update LIVE_METHODS`);
      continue;
    }
    if (!mine.some((s) => s.kind === "live")) out.push(`${pin.method}: no LIVE read`);
    let allowed = 0;
    for (const s of mine) {
      if (s.kind === "live") continue;
      const a = pin.allow;
      const matches =
        a !== undefined &&
        s.kind === "history" &&
        s.snippet.replace(/\s+/g, "") === a.snippet &&
        s.args === a.args &&
        (s.reason ?? "").startsWith(a.reason);
      if (matches && allowed === 0) allowed++;
      else out.push(`${pin.method}: ${s.kind} read at line ${s.line} (${s.snippet.trim()})`);
    }
  }
  return out;
}

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

  it("★ the dm §2.2 live reads stay LIVE, per method — a history label cannot be used to dodge (MUT-10)", () => {
    expect(pinViolations(sites, LIVE_METHODS)).toEqual([]);
  });

  it("★ (B25) the ONE history read a pinned method may hold is the deleted-row cap, exactly as data-model §2.2 writes it", () => {
    const capReads = sites.filter((s) => s.owner === "RolesService.delete" && s.kind === "history");
    expect(capReads.map((s) => [s.snippet.replace(/\s+/g, ""), s.args])).toEqual([
      [".role.count(", "{ where: { deletedAt: { not: null } } }"],
    ]);
    expect(capReads[0]!.reason).toMatch(/^deleted-row cap\b/);
  });

  it("FIXTURE (B25): a pinned method that labels its role LOOKUP as history, or labels a non-cap read 'deleted-row cap' → red; the twin → green", () => {
    const { raw, code } = fixtureSites("g3-04-pin-history-dodge.fixture");
    const found = roleReadSites("apps/api/src/orgs/roles.service.ts", raw, code).map((s) => ({
      ...s,
      file: "apps/api/src/orgs/roles.service.ts",
    }));
    const pins: readonly LivePin[] = [
      {
        file: "apps/api/src/orgs/roles.service.ts",
        method: "RolesService.delete",
        allow: DELETED_ROW_CAP,
      },
      {
        file: "apps/api/src/orgs/roles.service.ts",
        method: "RolesService.update",
        allow: DELETED_ROW_CAP,
      },
      {
        file: "apps/api/src/orgs/roles.service.ts",
        method: "RolesService.twin",
        allow: DELETED_ROW_CAP,
      },
    ];
    const v = pinViolations(found, pins);
    // delete: no live lookup AND a non-allowed history read · update: the dodge wearing the cap label
    expect(v.filter((x) => x.startsWith("RolesService.delete:"))).toEqual([
      "RolesService.delete: no LIVE read",
      expect.stringMatching(
        /^RolesService\.delete: history read at line \d+ \(\.role\.findFirst\(\)$/,
      ),
    ]);
    expect(v.filter((x) => x.startsWith("RolesService.update:"))).toEqual([
      expect.stringMatching(/^RolesService\.update: history read at line \d+ \(\.role\.count\(\)$/),
    ]);
    expect(v.filter((x) => x.startsWith("RolesService.twin:"))).toEqual([]);
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
      "g3-04-pin-history-dodge.fixture",
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
