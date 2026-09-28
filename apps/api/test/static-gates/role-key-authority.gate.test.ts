// F-003 · T-003-QA03 ★ — G-12: `Role.key` never decides a permission.
//
// Refs: F-003 test-plan §5.2 row G-12 · architecture §14 (a flag-opening
// condition: this file must be in the deployed commit and run in its CI log) ·
// data-model §4.2 (bridge trigger) · F-002 test-plan G-12 / I-45.
//
// Two layers, one rule:
//   1. CODE — apps/api, apps/web, apps/back-office (TS) and apps/mobile (Dart):
//      5 TS shapes + 2 Dart shapes. The only way out is a per-file PRESENTATION
//      allowlist (a label map), each entry with its reason.
//   2. SQL (SR-10) — every `CREATE [OR REPLACE] FUNCTION … $tag$…$tag$` body in
//      packages/db/prisma/migrations/**/migration.sql that compares `key` to
//      'owner'|'admin'|'staff'. The only way out is a per-(migration, function)
//      allowlist entry with a `removeBy` date. Past that date, the function must
//      have been dropped by a later migration — otherwise red. The clock is a
//      parameter, so the expiry is tested with fixtures, not by waiting.
//
// ⚠️ What this does NOT prove: grep sees only the shapes it knows. Passing the
// key into a helper, `ROLE_KEYS.indexOf`, a lookup table keyed by role key —
// none of those are caught. The behavioural proof is I-45 / I3-56 (swap keys on
// a real DB; permissions must not move). This gate is the fast layer only.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  type CodeRuleId,
  type SqlAllowance,
  type PresentationAllowance,
  CODE_RULE_IDS,
  MAX_REMOVE_BY_WINDOW_DAYS,
  collectCodeFiles,
  codeOffenders,
  loadMigrations,
  parseMigration,
  scanCode,
  sqlOffenders,
} from "./role-key-authority.gate";

const REPO = join(process.cwd(), "..", "..");
const FIXTURES = join(process.cwd(), "test", "static-gates", "__fixtures__", "role-key-authority");
const MIGRATIONS = join(REPO, "packages", "db", "prisma", "migrations");

/** Where production code lives. Tests/fixtures are not scanned (collectCodeFiles). */
const CODE_ROOTS = [
  "apps/api/src",
  "apps/web/src",
  "apps/back-office/src",
  "apps/mobile/lib",
] as const;

/**
 * Presentation-only files allowed to branch on a role key — a label map, never
 * a permission input. Per FILE, never per directory.
 */
const PRESENTATION_ALLOWLIST: readonly PresentationAllowance[] = Object.freeze([
  {
    file: "apps/web/src/features/org/i18n.ts",
    reason:
      "`roleLabel()` maps a system roleKey to its Thai label and falls back to roleName " +
      "for an unknown/custom key (api-spec: roleKey is an open set). Display only.",
    hits: 1,
  },
  {
    file: "apps/mobile/lib/features/org/presentation/widgets/role_label.dart",
    reason:
      "`roleLabel()` — the Dart twin of the web label map above; unknown key falls back to roleName.",
    hits: 1,
  },
  {
    file: "apps/mobile/lib/features/org/presentation/screens/invite_member_screen.dart",
    reason:
      "Invite screen display choices: default radio selection (`staff`), per-key description " +
      "sentence, and which TTL warning sentence to show (`_isElevated`). The server decides " +
      "the role and the expiry; none of these gate a request. T-003-M09 rewrites this screen " +
      "(server-driven roles) and must re-pin `hits`. See QA03 report: `_isElevated` drifts " +
      "from the server's isElevatedRole once custom roles exist (display defect, not authority).",
    hits: 3,
  },
]);

/**
 * Database functions allowed to read `Role.key` — each with an owner and a
 * deadline. EMPTY until B11 (T-003-B11) lands `role_f003_admin_bridge`; that PR
 * adds its row here: migration dir, fn name, owner "backend-api",
 * addedOn = merge date of the build PR, removeBy = addedOn + 60 days
 * (architecture §14, data-model §4.2). A window over 60 days is itself red.
 */
const SQL_FUNCTION_ALLOWLIST: readonly SqlAllowance[] = Object.freeze([]);

/** Marker in red fixtures: this line MUST be flagged. */
const HIT = /\/\/ ← hit\s*$/;

function readFixture(rel: string): string {
  return readFileSync(join(FIXTURES, rel), "utf8");
}

function expectedHitLines(source: string): number[] {
  return source.split("\n").flatMap((line, i) => (HIT.test(line) ? [i + 1] : []));
}

const RED_CODE_FIXTURES: ReadonlyArray<readonly [string, CodeRuleId]> = [
  ["code/red/ts-1-role-dot-key-compare.ts.fixture", "TS-1"],
  ["code/red/ts-2-role-key-var-compare.ts.fixture", "TS-2"],
  ["code/red/ts-3-key-literal-compare.ts.fixture", "TS-3"],
  ["code/red/ts-4-includes-role-key.ts.fixture", "TS-4"],
  ["code/red/ts-5-switch-role-key.ts.fixture", "TS-5"],
  ["code/red/dart-1-key-equality.dart.fixture", "DART-1"],
  ["code/red/dart-2-switch-contains.dart.fixture", "DART-2"],
];

const BRIDGE: SqlAllowance = {
  migration: "20261001000000_f003_backfill_manage_roles",
  fn: "role_f003_admin_bridge",
  owner: "backend-api",
  reason: "fixture",
  addedOn: "2026-10-01",
  removeBy: "2026-11-30",
};
const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

// ─────────────────────────────────────────────────────────────────────────────
describe("G-12 · the real tree: no role key decides a permission", () => {
  const files = CODE_ROOTS.flatMap((root) => collectCodeFiles(REPO, root));
  const hits = files.flatMap((f) => scanCode(f.path, f.source));

  it("non-vacuity: every root was walked, in both languages", () => {
    for (const root of CODE_ROOTS) {
      expect(existsSync(join(REPO, root)), `missing scan root ${root}`).toBe(true);
      expect(files.filter((f) => f.path.startsWith(`${root}/`)).length, root).toBeGreaterThan(0);
    }
    expect(files.filter((f) => f.path.endsWith(".ts")).length).toBeGreaterThan(100);
    expect(files.filter((f) => f.path.endsWith(".tsx")).length).toBeGreaterThan(10);
    expect(files.filter((f) => f.path.endsWith(".dart")).length).toBeGreaterThan(20);
    expect(files.some((f) => /\.test\.tsx?$|_test\.dart$/.test(f.path))).toBe(false);
  });

  it("non-vacuity: the scanner fires on real code in both languages (the allowlisted label maps)", () => {
    // If this ever reads 0, the patterns stopped matching real syntax and the
    // green below means nothing.
    const byFile = (file: string) => hits.filter((h) => h.file === file).map((h) => h.rule);
    expect(byFile("apps/web/src/features/org/i18n.ts")).toContain("TS-5");
    expect(byFile("apps/mobile/lib/features/org/presentation/widgets/role_label.dart")).toContain(
      "DART-2",
    );
  });

  it("★ no file outside the presentation allowlist uses a role key as authority", () => {
    const offenders = codeOffenders(hits, PRESENTATION_ALLOWLIST);
    expect(
      offenders.map((h) => `${h.file}:${h.line} [${h.rule}] ${h.text}`),
      "G-12: decide by `capabilities`, never by `key`/`roleKey`. A label map may be " +
        "allowlisted per file (presentation only) — a permission check may not.",
    ).toEqual([]);
  });

  it("the presentation allowlist has no stale or vague entries, and each is pinned to its hit count", () => {
    for (const entry of PRESENTATION_ALLOWLIST) {
      expect(entry.reason.length, `${entry.file}: reason required`).toBeGreaterThan(20);
      expect(
        files.some((f) => f.path === entry.file),
        `${entry.file} is not a scanned file`,
      ).toBe(true);
      const found = hits.filter((h) => h.file === entry.file);
      expect(entry.hits, `${entry.file}: an entry must allow ≥ 1 hit`).toBeGreaterThan(0);
      // Ratchet: allowlisting a file is not a blank cheque for the next key read
      // someone adds to it. More = review it; fewer = re-pin (or drop the entry).
      expect(
        found.map((h) => `${h.line} [${h.rule}] ${h.text}`),
        `${entry.file}: pinned at ${entry.hits} hit(s) — review the change, then re-pin`,
      ).toHaveLength(entry.hits);
    }
  });

  it("non-vacuity: the SQL layer read real migrations and parsed a real function", () => {
    const migrations = loadMigrations(MIGRATIONS);
    expect(migrations.length).toBeGreaterThanOrEqual(6);
    const fns = migrations.flatMap((m) => parseMigration(m.name, m.sql).creates);
    expect(fns.map((f) => f.fn)).toContain("omnistock_reject_ledger_mutation");
  });

  it("★ no migration creates a function that reads Role.key, unless allowlisted and in date", () => {
    const problems = sqlOffenders(loadMigrations(MIGRATIONS), SQL_FUNCTION_ALLOWLIST, new Date());
    expect(problems, "G-12 (SR-10): a DB function deciding by Role.key").toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("G-12 · self-check: every shape turns the gate red (fixtures)", () => {
  it("the fixture set covers all 7 code shapes", () => {
    expect(RED_CODE_FIXTURES.map(([, rule]) => rule).sort()).toEqual([...CODE_RULE_IDS].sort());
  });

  it.each(RED_CODE_FIXTURES)("%s → exactly the tagged lines, each by %s", (rel, rule) => {
    const source = readFixture(rel);
    const expected = expectedHitLines(source);
    expect(expected.length, "fixture has no tagged lines").toBeGreaterThan(0);

    const hits = scanCode(rel, source);
    expect([...new Set(hits.map((h) => h.line))].sort((a, b) => a - b)).toEqual(expected);
    for (const line of expected) {
      expect(
        hits.filter((h) => h.line === line).map((h) => h.rule),
        `${rel}:${line} not flagged by ${rule}`,
      ).toContain(rule);
    }
    // and the red actually reaches the verdict
    expect(codeOffenders(hits, []).length).toBe(hits.length);
  });

  it.each(["code/green/ts-controls.ts.fixture", "code/green/dart-controls.dart.fixture"])(
    "control %s → zero hits (comments, labels, other `.key`s)",
    (rel) => {
      expect(scanCode(rel, readFixture(rel))).toEqual([]);
    },
  );

  it("a TS shape in a .dart file (and vice versa) is judged by that file's language", () => {
    expect(scanCode("x.dart", "switch (roleKey) {").map((h) => h.rule)).toEqual(["DART-2"]);
    expect(scanCode("x.ts", "if (role.key == 'owner') {}").map((h) => h.rule)).toContain("TS-1");
    expect(scanCode("x.md", "role.key === 'owner'")).toEqual([]);
  });

  it("the presentation allowlist is per FILE: a sibling is still red", () => {
    const src = readFixture("code/red/ts-5-switch-role-key.ts.fixture");
    const listed = scanCode("apps/web/src/a/labels.ts", src);
    const sibling = scanCode("apps/web/src/a/labels2.ts", src);
    const allow = [{ file: "apps/web/src/a/labels.ts", reason: "fixture", hits: listed.length }];
    expect(codeOffenders([...listed, ...sibling], allow).map((h) => h.file)).toEqual(
      sibling.map(() => "apps/web/src/a/labels2.ts"),
    );
    expect(sibling.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("G-12 · self-check: the SQL layer and its removeBy clock (fixtures)", () => {
  const unlisted = loadMigrations(join(FIXTURES, "sql", "unlisted"));
  const bridge = loadMigrations(join(FIXTURES, "sql", "bridge"));
  const bridgeDrop = loadMigrations(join(FIXTURES, "sql", "bridge-drop"));

  it("fixture trees load (non-vacuity)", () => {
    expect([unlisted.length, bridge.length, bridgeDrop.length]).toEqual([1, 1, 1]);
    expect(readdirSync(join(FIXTURES, "sql"))).toEqual(
      expect.arrayContaining(["unlisted", "bridge", "bridge-drop"]),
    );
  });

  it("★ SQL-FN: an unlisted function reading key → red, naming only that function", () => {
    const parsed = parseMigration(unlisted[0]!.name, unlisted[0]!.sql);
    expect(parsed.creates.map((c) => [c.fn, c.readsRoleKey])).toEqual([
      ["omnistock_reject_mutation", false],
      ["rogue_owner_only", true],
    ]);
    const problems = sqlOffenders(unlisted, [], at("2026-09-28"));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/rogue_owner_only/);
    expect(problems[0]).toMatch(/not allowlisted/);
  });

  it("backfill UPDATE and DO blocks that name key='admin'/'owner' are not functions", () => {
    const parsed = parseMigration(bridge[0]!.name, bridge[0]!.sql);
    expect(parsed.creates.map((c) => c.fn)).toEqual(["role_f003_admin_bridge"]);
    expect(parsed.creates[0]!.readsRoleKey).toBe(true);
  });

  it("the bridge unlisted → red (same rule as any function)", () => {
    expect(sqlOffenders(bridge, [], at("2026-10-02"))).toHaveLength(1);
  });

  it("the bridge allowlisted, on and before removeBy → green", () => {
    expect(sqlOffenders(bridge, [BRIDGE], at("2026-10-02"))).toEqual([]);
    expect(sqlOffenders(bridge, [BRIDGE], at("2026-11-30"))).toEqual([]);
  });

  it("★ ALLOWLIST-EXPIRED: the day after removeBy, still created and never dropped → red", () => {
    const problems = sqlOffenders(bridge, [BRIDGE], at("2026-12-01"));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/role_f003_admin_bridge/);
    expect(problems[0]).toMatch(/removeBy 2026-11-30/);
  });

  it("…and a later migration that drops it turns it green again", () => {
    expect(sqlOffenders([...bridge, ...bridgeDrop], [BRIDGE], at("2027-06-01"))).toEqual([]);
    // order matters: a drop BEFORE the create does not retire it
    const reversed = [{ name: "20260101000000_early_drop", sql: bridgeDrop[0]!.sql }, ...bridge];
    expect(sqlOffenders(reversed, [BRIDGE], at("2027-06-01"))).toHaveLength(1);
  });

  it("an entry for another migration does not cover this one (per-file)", () => {
    const elsewhere = { ...BRIDGE, migration: "20261002000000_other" };
    const problems = sqlOffenders(bridge, [elsewhere], at("2026-10-02"));
    expect(problems.some((p) => /not allowlisted/.test(p))).toBe(true);
    expect(problems.some((p) => /stale/.test(p))).toBe(true);
  });

  it(`an entry must carry owner, reason, valid dates and a window ≤ ${MAX_REMOVE_BY_WINDOW_DAYS} days`, () => {
    const now = at("2026-10-02");
    expect(sqlOffenders(bridge, [{ ...BRIDGE, removeBy: "2026-12-01" }], now)).toEqual([
      expect.stringMatching(/window/),
    ]);
    expect(sqlOffenders(bridge, [{ ...BRIDGE, removeBy: "someday" }], now)).toEqual([
      expect.stringMatching(/removeBy/),
    ]);
    expect(sqlOffenders(bridge, [{ ...BRIDGE, owner: "" }], now)).toEqual([
      expect.stringMatching(/owner/),
    ]);
    expect(sqlOffenders(bridge, [{ ...BRIDGE, reason: " " }], now)).toEqual([
      expect.stringMatching(/reason/),
    ]);
  });
});
