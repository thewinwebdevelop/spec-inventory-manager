// F-003 · T-003-QA03 ★ — G-12: `Role.key` never decides a permission.
//
// Refs: F-003 test-plan §5.2 row G-12 · architecture §14 (a flag-opening
// condition: this file must be in the deployed commit and run in its CI log) ·
// data-model §4.2 (bridge trigger) · F-002 test-plan G-12 / I-45.
//
// Two layers, one rule:
//   1. CODE — apps/api, apps/web, apps/back-office, packages/core-domain (TS)
//      and apps/mobile (Dart): 8 TS + 4 Dart rule families (see the scanner).
//      The only way out is a PRESENTATION allowlist pinned per LINE.
//   2. SQL (SR-10) — every `CREATE [OR REPLACE] FUNCTION … $tag$…$tag$` body in
//      packages/db/prisma/migrations/**/migration.sql that compares `key` to
//      'owner'|'admin'|'staff'. The only way out is a per-(migration, function)
//      allowlist entry with a `removeBy` date. Past that date, the function must
//      have been dropped by a LATER migration (same schema + signature, not in
//      a string, not inside another function body) — otherwise red. The clock
//      is a parameter, so the expiry is tested with fixtures, not by waiting.
//
// ⚠️ What this does NOT prove: grep sees only the shapes it knows — the blind
// spots are listed in the scanner's header. The behavioural proof is I-45 /
// I3-56 (swap keys on a real DB; permissions must not move). This gate is the
// fast layer only; the two are required together (architecture §14).
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  type CodeRuleId,
  type Migration,
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
  stalePins,
  stripComments,
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
  "packages/core-domain/src", // where permission rules live (golden rule 6)
] as const;

/**
 * Presentation-only lines allowed to read a role key — label maps and display
 * choices, never a permission input. Pinned per FILE + exact LINE text: a new
 * key read in the same file is red until reviewed and pinned here.
 */
function labelCalls(file: string, lines: string[]): PresentationAllowance {
  return {
    file,
    reason: "Display only: a role key passed to `roleLabel` to render the role's label.",
    lines,
  };
}

const PRESENTATION_ALLOWLIST: readonly PresentationAllowance[] = Object.freeze([
  {
    file: "apps/web/src/features/org/i18n.ts",
    reason:
      "`roleLabel()` maps a system roleKey to its Thai label and falls back to roleName " +
      "for an unknown/custom key (api-spec: roleKey is an open set). Display only.",
    lines: [
      "export function roleLabel(",
      "switch (roleKey) {",
      'case "owner":',
      'case "admin":',
      'case "staff":',
    ],
  },
  {
    file: "apps/mobile/lib/features/org/presentation/widgets/role_label.dart",
    reason:
      "`roleLabel()` — the Dart twin of the web label map above; unknown key falls back to roleName.",
    lines: [
      "String roleLabel(AppLocalizations t, String? roleKey, String roleName) => switch (roleKey) {",
      "'owner' => t.roleOwner,",
      "'admin' => t.roleAdmin,",
      "'staff' => t.roleStaff,",
    ],
  },
  {
    file: "apps/mobile/lib/features/org/presentation/screens/invite_member_screen.dart",
    reason:
      "Invite screen display choices: default radio selection (`staff` / preset key), the Owner-" +
      "only description sentence (T-003-M04 — ux-wireframe §0.1 dropped admin/staff descriptions " +
      "as no longer honest once a shop can edit a role), and which TTL warning sentence to show " +
      "(`_isElevated`). The server decides the role and the expiry; none of these gate a request. " +
      "The TTL `key == 'admin'` check stays pinned until the TTL decision lands (QA03 F1, waiting on a user decision). QA03 finding F1: " +
      "`_isElevated` drifts from the server's isElevatedRole once custom roles exist (display " +
      "defect, not authority).",
    lines: [
      "final preset = widget.initialRoleKey;",
      "final staff = roles.where((r) => r.key == 'staff').firstOrNull;",
      "return selected.grantsOwnership || selected.key == 'admin';",
      "final description = role.key == 'owner' ? t.inviteRoleOwnerDesc : null;",
    ],
  },
  {
    file: "apps/web/src/features/org/role-copy.ts",
    reason:
      "`displayRoleName()` (ux §0.2, T-003-W03): translates a system roleKey to its label unless " +
      "the shop renamed the role (`nameCustomized`); unknown key falls back to name. Display only.",
    lines: [
      "const { name, roleKey, nameCustomized } = params;",
      "if (roleKey && roleKey in ROLE_KEY_LABEL) return ROLE_KEY_LABEL[roleKey];",
    ],
  },
  {
    file: "apps/web/src/features/org/roles/RolesScreen.tsx",
    reason:
      "`toLastEdited()` (T-003-W05): adapts the wire `RoleLastEdited.by` to W03's `lastEditedLine` " +
      "and passes the editor's roleKey straight into `displayRoleName()` for the label. Display only.",
    lines: [
      "const { kind, roleName, roleKey, roleNameCustomized } = le.by;",
      "? displayRoleName({ name: roleName, roleKey, nameCustomized: roleNameCustomized })",
    ],
  },
  {
    file: "packages/core-domain/src/rbac/role-view.ts",
    reason:
      "`wireNameCustomized()` (data-model AC-1.5 row, T-003-B21): the wire flag that tells a client " +
      "to show `name` as-is instead of translating `key` (`key === null || column`). Display only — " +
      "the verdicts in the same file decide from capabilities via decideRoleWrite.",
    lines: ["return role.key === null || role.nameCustomized;"],
  },
  {
    file: "packages/core-domain/src/rbac/role-validation.ts",
    reason:
      "`reservedRoleNames()` (AC-3.5 · data-model §2.1, T-003-B04): picks WHICH system-role translations " +
      "are reserved as names (a live, un-renamed admin/staff role's label; minus the caller's own). " +
      "A naming policy — it never grants or refuses a capability.",
    lines: [
      "if (role.nameCustomized || role.key === ctx.selfKey) continue;",
      'if (role.key === "admin" || role.key === "staff") {',
      "out.add(roleNameComparisonKey(labels[role.key]));",
    ],
  },
  // ── display call sites: a role key handed to `roleLabel` to render a label.
  // Exempt ONLY here, line by line; the helper's result used as a condition
  // (TS-10 / DART-6) is red even on a pinned line.
  labelCalls("apps/mobile/lib/features/org/presentation/copy/role_display_copy.dart", [
    "return roleLabel(t, roleKey, name);",
  ]),
  labelCalls("apps/web/src/features/invite/components/InviteScreen.tsx", [
    "<p>{inviteScreenTh.invitedAs(roleLabel(previewed.roleKey, previewed.roleName))}</p>",
    "roleName: roleLabel(result.membership.roleKey, result.membership.roleName),",
  ]),
  labelCalls("apps/web/src/features/org/components/MembersScreen.tsx", [
    "{roleLabel(invitation.roleKey, invitation.roleName)}",
    "roleName: roleLabel(invitation.roleKey, invitation.roleName),",
    '<Badge tone="neutral">{roleLabel(member.roleKey, member.roleName)}</Badge>',
  ]),
  labelCalls("apps/web/src/features/org/components/OrgSwitcher.tsx", [
    "{roleLabel(active.roleKey, active.roleName)}",
    "{roleLabel(item.membership.roleKey, item.membership.roleName)}",
  ]),
  labelCalls("apps/web/src/features/org/components/SelectOrgScreen.tsx", [
    "{roleLabel(item.membership.roleKey, item.membership.roleName)}",
  ]),
  labelCalls("apps/mobile/lib/features/org/presentation/screens/members_screen.dart", [
    "Text('${roleLabel(t, invitation.roleKey, invitation.roleName)} · $status'),",
    "'${roleLabel(t, member.roleKey, member.roleName)} · '",
  ]),
  labelCalls("apps/mobile/lib/features/org/presentation/screens/org_picker_screen.dart", [
    "subtitle: Text(roleLabel(t, org.roleKey, org.roleName)),",
  ]),
  labelCalls("apps/mobile/lib/features/org/presentation/widgets/org_switcher.dart", [
    "? '${roleLabel(t, org.roleKey, org.roleName)} · ${t.orgSwitcherCurrent}'",
    ": roleLabel(t, org.roleKey, org.roleName),",
  ]),
]);

/**
 * Database functions allowed to read `Role.key` — each with an owner and a
 * deadline (architecture §14, data-model §4.2). A window over 60 days is itself
 * red. Past `removeBy` the function must be dropped by a LATER migration
 * (`f003_drop_admin_bridge`) or this gate is red — moving the date needs a new
 * review, not an edit to make CI green.
 */
const SQL_FUNCTION_ALLOWLIST: readonly SqlAllowance[] = Object.freeze([
  {
    migration: "20261024000000_f003_backfill_manage_roles",
    fn: "role_f003_admin_bridge",
    owner: "backend-api",
    reason:
      "T-003-B11 bridge trigger (data-model §4.2): an Admin inserted by F-002 code during a rolling " +
      "deploy gets manage_roles. Drop it (migration f003_drop_admin_bridge) in the release after " +
      "devops confirms no F-002 instance is left (architecture §12).",
    // addedOn = the day the task landed on the build branch; PM may re-base it
    // to the build PR's merge date (still ≤ 60 days).
    addedOn: "2026-10-24",
    removeBy: "2026-12-23",
  },
]);

/** Marker in red fixtures: `// ← hit` (fixture's own rule) or `// ← hit TS-6`. */
const HIT = /\/\/ ← hit(?: ([A-Z]+-\d+))?\s*$/;

function readFixture(rel: string): string {
  return readFileSync(join(FIXTURES, rel), "utf8");
}

function expectedHits(source: string, rule: CodeRuleId): Map<number, string> {
  const out = new Map<number, string>();
  source.split("\n").forEach((line, i) => {
    const m = HIT.exec(line);
    if (m) out.set(i + 1, m[1] ?? rule);
  });
  return out;
}

const RED_CODE_FIXTURES: ReadonlyArray<readonly [string, CodeRuleId]> = [
  ["code/red/ts-1-role-dot-key-compare.ts.fixture", "TS-1"],
  ["code/red/ts-1b-after-regex-literal.ts.fixture", "TS-1"],
  ["code/red/ts-2-role-key-var-compare.ts.fixture", "TS-2"],
  ["code/red/ts-3-key-literal-compare.ts.fixture", "TS-3"],
  ["code/red/ts-4-includes-role-key.ts.fixture", "TS-4"],
  ["code/red/ts-5-switch-role-key.ts.fixture", "TS-5"],
  ["code/red/ts-6-system-literal.ts.fixture", "TS-6"],
  ["code/red/ts-7-indirection.ts.fixture", "TS-7"],
  ["code/red/ts-8-named-constant.ts.fixture", "TS-8"],
  ["code/red/ts-9-label-declared.ts.fixture", "TS-9"],
  ["code/red/ts-10-label-as-condition.ts.fixture", "TS-10"],
  ["code/red/dart-1-key-equality.dart.fixture", "DART-1"],
  ["code/red/dart-2-switch-contains.dart.fixture", "DART-2"],
  ["code/red/dart-3-system-literal.dart.fixture", "DART-3"],
  ["code/red/dart-4-indirection.dart.fixture", "DART-4"],
  ["code/red/dart-5-label-declared.dart.fixture", "DART-5"],
  ["code/red/dart-6-label-as-condition.dart.fixture", "DART-6"],
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
const AFTER = at("2027-06-01");
const later = (sql: string): Migration => ({ name: "20261201000000_later", sql });

// ─────────────────────────────────────────────────────────────────────────────
describe("G-12 · the real tree: no role key decides a permission", () => {
  const files = CODE_ROOTS.flatMap((root) => collectCodeFiles(REPO, root));
  const hits = files.flatMap((f) => scanCode(f.path, f.source));

  it("non-vacuity: every root was walked, in both languages", () => {
    for (const root of CODE_ROOTS) {
      expect(existsSync(join(REPO, root)), `missing scan root ${root}`).toBe(true);
      expect(files.filter((f) => f.path.startsWith(`${root}/`)).length, root).toBeGreaterThan(0);
    }
    expect(
      files.filter((f) => f.path.startsWith("packages/core-domain/src/")).length,
    ).toBeGreaterThan(10);
    expect(files.filter((f) => f.path.endsWith(".ts")).length).toBeGreaterThan(100);
    expect(files.filter((f) => f.path.endsWith(".tsx")).length).toBeGreaterThan(10);
    expect(files.filter((f) => f.path.endsWith(".dart")).length).toBeGreaterThan(20);
    expect(files.some((f) => /\.test\.tsx?$|_test\.dart$/.test(f.path))).toBe(false);
  });

  it("non-vacuity: the scanner fires on real code in both languages (the allowlisted label maps)", () => {
    // If this ever reads 0, the patterns stopped matching real syntax and the
    // green below means nothing.
    const byFile = (file: string) => hits.filter((h) => h.file === file).map((h) => h.rule);
    expect(byFile("apps/web/src/features/org/i18n.ts")).toEqual(
      expect.arrayContaining(["TS-5", "TS-6"]),
    );
    expect(byFile("apps/mobile/lib/features/org/presentation/widgets/role_label.dart")).toEqual(
      expect.arrayContaining(["DART-2", "DART-3"]),
    );
  });

  it("★ no line outside the presentation allowlist reads a role key as authority", () => {
    const offenders = codeOffenders(hits, PRESENTATION_ALLOWLIST);
    expect(
      offenders.map((h) => `${h.file}:${h.line} [${h.rule}] ${h.text}`),
      "G-12: decide by `capabilities`, never by `key`/`roleKey`. A label map may be " +
        "allowlisted per line (presentation only) — a permission check may not.",
    ).toEqual([]);
  });

  it("the presentation allowlist has reasons and no stale pins", () => {
    for (const entry of PRESENTATION_ALLOWLIST) {
      expect(entry.reason.length, `${entry.file}: reason required`).toBeGreaterThan(20);
      expect(entry.lines.length, `${entry.file}: pin at least one line`).toBeGreaterThan(0);
      expect(
        files.some((f) => f.path === entry.file),
        `${entry.file} is not a scanned file`,
      ).toBe(true);
    }
    expect(stalePins(hits, PRESENTATION_ALLOWLIST)).toEqual([]);
  });

  it("non-vacuity: the SQL layer read real migrations and parsed a real function", () => {
    const migrations = loadMigrations(MIGRATIONS);
    expect(migrations.length).toBeGreaterThanOrEqual(6);
    const fns = migrations.flatMap((m) => parseMigration(m.name, m.sql).creates);
    expect(fns.map((f) => f.fn)).toContain("public.omnistock_reject_ledger_mutation");
  });

  it("★ no migration creates a function that reads Role.key, unless allowlisted and in date", () => {
    const problems = sqlOffenders(loadMigrations(MIGRATIONS), SQL_FUNCTION_ALLOWLIST, new Date());
    expect(problems, "G-12 (SR-10): a DB function deciding by Role.key").toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("G-12 · self-check: every code shape turns the gate red (fixtures)", () => {
  it("the fixture set covers every rule", () => {
    expect([...new Set(RED_CODE_FIXTURES.map(([, rule]) => rule))].sort()).toEqual(
      [...CODE_RULE_IDS].sort(),
    );
  });

  it.each(RED_CODE_FIXTURES)(
    "%s → exactly the tagged lines, each by its tagged rule (%s)",
    (rel, rule) => {
      const source = readFixture(rel);
      const expected = expectedHits(source, rule);
      expect(expected.size, "fixture has no tagged lines").toBeGreaterThan(0);

      const hits = scanCode(rel, source);
      expect([...new Set(hits.map((h) => h.line))].sort((a, b) => a - b)).toEqual(
        [...expected.keys()].sort((a, b) => a - b),
      );
      for (const [line, want] of expected) {
        expect(
          hits.filter((h) => h.line === line).map((h) => h.rule),
          `${rel}:${line} not flagged by ${want}`,
        ).toContain(want);
      }
      // and the red actually reaches the verdict
      expect(codeOffenders(hits, []).length).toBe(hits.length);
    },
  );

  it.each(["code/green/ts-controls.ts.fixture", "code/green/dart-controls.dart.fixture"])(
    "control %s → zero hits (comments, labels, other `.key`s, lookalike literals)",
    (rel) => {
      expect(scanCode(rel, readFixture(rel))).toEqual([]);
    },
  );

  it("the comment stripper does not open a comment inside a regex literal or a string", () => {
    const src = 'const a = /x\\/*y/;\nconst b = "p/*q";\nconst c = 1; /* gone */ const d = 2;';
    expect(stripComments(src, "ts").split("\n")).toEqual([
      "const a = /x\\/*y/;",
      'const b = "p/*q";',
      "const c = 1;            const d = 2;",
    ]);
  });

  it("a shape is judged by the file's language", () => {
    expect(scanCode("x.dart", "switch (roleKey) {").map((h) => h.rule)).toContain("DART-2");
    expect(scanCode("x.ts", "if (role.key == 'owner') {}").map((h) => h.rule)).toContain("TS-1");
    expect(scanCode("x.md", "role.key === 'owner'")).toEqual([]);
  });

  it("★ roleLabel is not a free pass: a call outside a pinned display line is red, in any file", () => {
    for (const [file, line] of [
      ["apps/api/src/orgs/x.ts", "const l = roleLabel(role.key, role.name);"],
      [
        "apps/web/src/features/org/components/MembersScreen.tsx",
        "const extra = roleLabel(m.roleKey, m.roleName);",
      ],
      ["apps/mobile/lib/x.dart", "final l = roleLabel(t, m.roleKey, m.roleName);"],
    ] as const) {
      const hits = scanCode(file, line);
      expect(hits.length, line).toBeGreaterThan(0);
      expect(codeOffenders(hits, PRESENTATION_ALLOWLIST).length, line).toBe(hits.length);
    }
  });

  it("★ a label helper declared outside the two known label maps is red (the api-side decoy)", () => {
    const decoy = "export function roleLabel(k: string): boolean {\n  return ELEVATED.has(k);\n}";
    const hits = scanCode("apps/api/src/orgs/decide.ts", decoy);
    expect(hits.map((h) => h.rule)).toEqual(["TS-9"]);
    expect(codeOffenders(hits, PRESENTATION_ALLOWLIST)).toHaveLength(1);
  });

  it("★ UNPINNABLE: the label's result used as a condition is red even on a pinned line of an allowlisted file", () => {
    const file = "apps/web/src/features/org/components/MembersScreen.tsx";
    const line = "if (roleLabel(member.roleKey, member.roleName) === orgTh.role.owner) allow();";
    const hits = scanCode(file, line);
    expect(hits.map((h) => h.rule)).toContain("TS-10");
    const pinned = [{ file, reason: "fixture", lines: [line.trim()] }];
    expect(codeOffenders(hits, pinned).map((h) => h.rule)).toEqual(["TS-10"]);
    const dart = scanCode("x.dart", "if (roleLabel(t, k, n) == t.roleOwner) allow();");
    expect(
      codeOffenders(dart, [{ file: "x.dart", reason: "f", lines: [dart[0]!.text] }]).map(
        (h) => h.rule,
      ),
    ).toEqual(["DART-6"]);
  });

  it("the presentation allowlist is per FILE and per LINE: a sibling file or a new line is red", () => {
    const src = readFixture("code/red/ts-5-switch-role-key.ts.fixture");
    const listed = scanCode("apps/web/src/a/labels.ts", src);
    const sibling = scanCode("apps/web/src/a/labels2.ts", src);
    const allow = [
      { file: "apps/web/src/a/labels.ts", reason: "fixture", lines: listed.map((h) => h.text) },
    ];
    expect(sibling.length).toBeGreaterThan(0);
    expect(
      codeOffenders([...listed, ...sibling], allow).every((h) => h.file.endsWith("labels2.ts")),
    ).toBe(true);

    // a NEW key read added to the allowlisted file is not covered by the old pins
    const grown = scanCode("apps/web/src/a/labels.ts", `${src}\nif (role.key === "owner") {}`);
    expect(codeOffenders(grown, allow).map((h) => h.text)).toEqual(
      expect.arrayContaining(['if (role.key === "owner") {}']),
    );
    // a pin whose line disappeared is stale
    const pinnedExtra = [{ ...allow[0]!, lines: [...allow[0]!.lines, "gone();"] }];
    expect(stalePins(listed, pinnedExtra)).toEqual([expect.stringMatching(/gone\(\);/)]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("G-12 · self-check: the SQL layer and its removeBy clock (fixtures)", () => {
  const load = (dir: string) => loadMigrations(join(FIXTURES, "sql", dir));
  const unlisted = load("unlisted");
  const bridge = load("bridge");
  const bridgeDrop = load("bridge-drop");
  const fakeDrops = load("bridge-fake-drops");
  const dropInDo = load("bridge-drop-in-do");

  it("fixture trees load (non-vacuity)", () => {
    expect([unlisted, bridge, bridgeDrop, fakeDrops, dropInDo].map((m) => m.length)).toEqual([
      1, 1, 1, 1, 1,
    ]);
    expect(readdirSync(join(FIXTURES, "sql")).sort()).toEqual([
      "bridge",
      "bridge-drop",
      "bridge-drop-in-do",
      "bridge-fake-drops",
      "unlisted",
    ]);
  });

  it("★ SQL-FN: an unlisted function reading key → red, naming only that function", () => {
    const parsed = parseMigration(unlisted[0]!.name, unlisted[0]!.sql);
    expect(parsed.creates.map((c) => [c.fn, c.args, c.readsRoleKey])).toEqual([
      ["public.omnistock_reject_mutation", [], false],
      ["public.rogue_owner_only", ["text"], true],
    ]);
    const problems = sqlOffenders(unlisted, [], at("2026-09-28"));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/rogue_owner_only/);
    expect(problems[0]).toMatch(/not allowlisted/);
  });

  it("backfill UPDATE and DO blocks that name key='admin'/'owner' are not functions", () => {
    const parsed = parseMigration(bridge[0]!.name, bridge[0]!.sql);
    expect(parsed.creates.map((c) => c.fn)).toEqual(["public.role_f003_admin_bridge"]);
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

  it("…a later real drop turns it green (plain, or inside a DO block, quoted, no signature)", () => {
    expect(sqlOffenders([...bridge, ...bridgeDrop], [BRIDGE], AFTER)).toEqual([]);
    expect(sqlOffenders([...bridge, ...dropInDo], [BRIDGE], AFTER)).toEqual([]);
  });

  it("★ a drop that is not a drop keeps it red (string · other schema · other signature · inside a fn body)", () => {
    const parsed = parseMigration(fakeDrops[0]!.name, fakeDrops[0]!.sql);
    // only (b) and (c) are real statements — and they name something else
    expect(parsed.drops.map((d) => [d.fn, d.args])).toEqual([
      ["audit.role_f003_admin_bridge", []],
      ["public.role_f003_admin_bridge", ["text"]],
    ]);
    expect(sqlOffenders([...bridge, ...fakeDrops], [BRIDGE], AFTER)).toEqual([
      expect.stringMatching(/past removeBy/),
    ]);
    // one at a time, so no case hides behind another
    for (const sql of [
      "SELECT 'DROP FUNCTION role_f003_admin_bridge();';",
      "SELECT $x$DROP FUNCTION role_f003_admin_bridge();$x$;",
      "DO $$ BEGIN EXECUTE $q$DROP FUNCTION role_f003_admin_bridge();$q$; END $$;",
      "DROP FUNCTION IF EXISTS audit.role_f003_admin_bridge();",
      "DROP FUNCTION IF EXISTS role_f003_admin_bridge(text);",
      "CREATE FUNCTION later_fn() RETURNS void LANGUAGE plpgsql AS $$ BEGIN DROP FUNCTION role_f003_admin_bridge(); END $$;",
    ]) {
      expect(sqlOffenders([...bridge, later(sql)], [BRIDGE], AFTER), sql).toHaveLength(1);
    }
    // control: the same statement, for real
    expect(
      sqlOffenders(
        [...bridge, later("DROP FUNCTION IF EXISTS public.role_f003_admin_bridge();")],
        [BRIDGE],
        AFTER,
      ),
    ).toEqual([]);
  });

  it("a drop's signature must match the create's full argument types", () => {
    const create = {
      name: "20261001000000_sig",
      sql: `CREATE FUNCTION sig_fn(p_at timestamp with time zone, p_role "text") RETURNS boolean LANGUAGE sql AS $$ SELECT key = 'owner' FROM "Role" $$;`,
    };
    const entry = { ...BRIDGE, migration: create.name, fn: "sig_fn" };
    expect(parseMigration(create.name, create.sql).creates[0]!.args).toEqual([
      "timestamp with time zone",
      "text",
    ]);
    const withDrop = (drop: string) => sqlOffenders([create, later(drop)], [entry], AFTER);
    expect(withDrop("DROP FUNCTION sig_fn(time with time zone, text);")).toHaveLength(1);
    expect(withDrop("DROP FUNCTION sig_fn(timestamp with time zone);")).toHaveLength(1);
    expect(withDrop("DROP FUNCTION sig_fn(timestamp with time zone, text);")).toEqual([]);
    expect(withDrop("DROP FUNCTION sig_fn(at_ts timestamp with time zone, r text);")).toEqual([]);
  });

  it("order matters: a drop BEFORE the create does not retire it; a later keyed re-create revives it", () => {
    const early = { name: "20260101000000_early_drop", sql: bridgeDrop[0]!.sql };
    expect(sqlOffenders([early, ...bridge], [BRIDGE], AFTER)).toHaveLength(1);
    const recreate = { name: "20270101000000_recreate", sql: bridge[0]!.sql };
    // the re-create is itself unlisted (another migration) AND the entry's fn is live again
    expect(sqlOffenders([...bridge, ...bridgeDrop, recreate], [BRIDGE], AFTER)).toHaveLength(2);
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
