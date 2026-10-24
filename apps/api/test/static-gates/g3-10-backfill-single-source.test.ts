// F-003 · T-003-B11 — G3-10 (test-plan §5.2 · data-model §4.2 "SQL แหล่งเดียว").
//
// The `manage_roles` backfill has ONE text: the committed migration
// `*_f003_backfill_manage_roles/migration.sql`. `backfill:f003`
// (packages/db/src/backfill-f003.ts) executes that file; it never restates it.
// A second copy drifts — the migration keeps the exact-set / key / idempotency
// guards and the copy forgets one, and Admin rows gain `manage_roles` on a
// path nobody reviewed. Rules:
//   1. exactly one migration directory matches `*_f003_backfill_manage_roles`
//   2. no production file pairs a `'manage_roles'` literal with `UPDATE "Role"`
// Plus the link to SYSTEM_ROLE_BLUEPRINT: what the backfill writes (F-002 Admin
// set + manage_roles, byte order) IS the F-003 Admin preset, so a migrated shop
// and a newly provisioned one hold the same array.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  CAPABILITY_MANAGE_ROLES,
  CAPABILITY_REGISTRY,
  SYSTEM_ROLE_BLUEPRINT,
} from "@omnistock/core-domain";
import {
  REPO,
  fixture,
  fixtureNames,
  lineOf,
  productionFiles,
  readCode,
  sqlCode,
  type Violation,
} from "./scan";

const SLUG = "f003_backfill_manage_roles";
const MIGRATIONS = join(REPO, "packages/db/prisma/migrations");
const LITERAL = /(["'`])manage_roles\1/g;
const UPDATE_ROLE = /\bUPDATE\s+(?:ONLY\s+)?(?:"?public"?\s*\.\s*)?"Role"/gi;

function g310(file: string, code: string): Violation[] {
  const literals = [...code.matchAll(LITERAL)];
  const updates = [...code.matchAll(UPDATE_ROLE)];
  if (literals.length === 0 || updates.length === 0) return [];
  return updates.map((m) => ({
    gate: "G3-10",
    rule: "manage_roles-update-outside-migration",
    file,
    line: lineOf(code, m.index!),
    snippet: m[0],
  }));
}

const backfillDirs = () =>
  readdirSync(MIGRATIONS, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.endsWith(`_${SLUG}`))
    .map((e) => e.name);

describe("G3-10 · the manage_roles backfill has one SQL source", () => {
  const files = productionFiles();

  it("★ exactly one committed migration *_f003_backfill_manage_roles", () => {
    expect(backfillDirs()).toHaveLength(1);
    expect(existsSync(join(MIGRATIONS, backfillDirs()[0]!, "migration.sql"))).toBe(true);
  });

  it("non-vacuity: both patterns match the real migration, and the scan reached the script", () => {
    const rel = `packages/db/prisma/migrations/${backfillDirs()[0]}/migration.sql`;
    const sql = sqlCode(rel);
    expect([...sql.matchAll(LITERAL)].length).toBeGreaterThan(0);
    expect([...sql.matchAll(UPDATE_ROLE)].length).toBeGreaterThan(0);
    expect(
      g310(rel, sql).length,
      "the migration itself is the shape the gate looks for",
    ).toBeGreaterThan(0);
    expect(files).toContain("packages/db/src/backfill-f003.ts");
    expect(files.length).toBeGreaterThan(100);
    // the literal does occur in production TS (the registry) — only the PAIR is banned
    expect(files.filter((f) => [...readCode(f).matchAll(LITERAL)].length > 0)).toContain(
      "packages/core-domain/src/rbac/registry.ts",
    );
  });

  it("★ no production file pairs 'manage_roles' with UPDATE \"Role\"", () => {
    expect(files.flatMap((f) => g310(f, readCode(f)))).toEqual([]);
  });

  it("FIXTURE: a restated backfill in the script turns the gate red", () => {
    expect(
      g310("packages/db/src/backfill-f003.ts", fixture("g3-10-restated-backfill.fixture")).map(
        (v) => v.rule,
      ),
    ).toEqual(["manage_roles-update-outside-migration"]);
  });

  it("every g3-10 fixture on disk is exercised above", () => {
    expect(fixtureNames("g3-10-")).toEqual(["g3-10-restated-backfill.fixture"]);
  });

  it("SELF-CHECK: flags the shapes, clears the legitimate ones", () => {
    const red = [
      `$executeRawUnsafe(\`UPDATE "Role" SET capabilities = array_append(capabilities, 'manage_roles')\`)`,
      `const q = 'update "Role" set x = 1'; const k = "manage_roles";`,
      'sql`UPDATE ONLY public."Role" SET c = ${"manage_roles"}`',
    ];
    for (const code of red)
      expect(g310("x.ts", code).length, `NOT FLAGGED: ${code}`).toBeGreaterThan(0);
    const green = [
      'export const CAPABILITY_MANAGE_ROLES = "manage_roles" as const;',
      `$executeRawUnsafe('UPDATE "Role" SET version = version + 1')`,
      `$executeRawUnsafe(\`UPDATE "Role" SET c = $1\`, [CAPABILITY_MANAGE_ROLES])`,
      `UPDATE "RoleHistory" SET x = 'manage_roles'`,
    ];
    for (const code of green) expect(g310("x.ts", code), `FALSE POSITIVE: ${code}`).toEqual([]);
  });
});

describe("G3-10 · what the backfill writes is the SYSTEM_ROLE_BLUEPRINT Admin preset", () => {
  const sql = () =>
    readFileSync(join(MIGRATIONS, backfillDirs()[0]!, "migration.sql"), "utf8").replace(
      /--[^\n]*/g,
      "",
    );
  /** Every `ARRAY['…', …]` literal of ≥ 7 keys — the F-002 Admin set, wherever it is compared. */
  const f002Sets = () =>
    [...sql().matchAll(/ARRAY\s*\[([^\]]+)\]/g)]
      .map((m) => [...m[1]!.matchAll(/'([a-z_]+)'/g)].map((k) => k[1]!))
      .filter((keys) => keys.length >= 7);
  const admin = () => {
    const rows = SYSTEM_ROLE_BLUEPRINT.filter((r) => r.key === "admin");
    expect(rows).toHaveLength(1);
    return [...rows[0]!.capabilities];
  };
  const byteOrder = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

  it("the backfill UPDATE and the bridge trigger compare against the same F-002 set (non-vacuity: 2 sites)", () => {
    const sets = f002Sets();
    expect(sets.length).toBe(2);
    expect(sets[1]).toEqual(sets[0]);
  });

  it("★ blueprint Admin = F-002 set + manage_roles, in byte order (the canonical array the SQL builds)", () => {
    const f002 = f002Sets()[0]!;
    expect(f002).toEqual([...f002].sort(byteOrder)); // SQL compares a sorted array
    expect(f002).not.toContain(CAPABILITY_MANAGE_ROLES);
    expect(admin()).toEqual([...f002, CAPABILITY_MANAGE_ROLES].sort(byteOrder));
    expect(admin()).toHaveLength(8);
  });

  it('the SQL sorts with COLLATE "C" (byte order) everywhere it builds or compares a set', () => {
    const orderBys = [...sql().matchAll(/ORDER\s+BY\s+c\b([^)]*)\)/g)].map((m) => m[1]!.trim());
    expect(orderBys.length).toBeGreaterThanOrEqual(4);
    for (const o of orderBys) expect(o).toBe('COLLATE "C"');
  });

  it("every capability the backfill can write is registered", () => {
    const keys = new Set<string>(CAPABILITY_REGISTRY.map((c) => c.key));
    for (const k of [...f002Sets()[0]!, CAPABILITY_MANAGE_ROLES]) expect(keys.has(k), k).toBe(true);
  });
});
