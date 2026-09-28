// F-003 · T-003-B10 ★ — M3-02 + M3-03 on the REAL `*_f003_role_expand`
// migration (test-plan §4.14 · data-model §4.1). Requires TEST_DATABASE_URL
// (+ psql for the SQL-level steps); skipped otherwise, loudly.
//
//   M3-02  pre-flight refuses each broken F-002 shape BEFORE touching the schema,
//          and the error names the check and THAT shop (a healthy shop sits
//          alongside, so "some org" is not enough). Control: clean data applies.
//   M3-03  re-apply: the whole file run a second time is a no-op (catalogue
//          snapshot unchanged) · a half-applied file (sections §0–§2 only) is
//          completed by the real deploy to the same catalogue as a clean apply ·
//          `prisma migrate diff` from the migrated DB to schema.prisma is empty.
import { afterAll, describe, expect, it } from "vitest";
import {
  F002_BASELINE,
  createScratchDatabase,
  listRealMigrations,
  migrateDeploy,
  migrateDiff,
  realMigrationBySlug,
  realMigrationsAfter,
  removeStagedMigrations,
  runSqlCapturingNotices,
  seedF002Org,
  stageMigrations,
  type ScratchDatabase,
} from "./migration-harness";

const TEST_DB = process.env.TEST_DATABASE_URL;
const d = TEST_DB ? describe : describe.skip;
if (!TEST_DB) {
  console.warn(
    "[T-003-B10] SKIPPING M3-02/M3-03: TEST_DATABASE_URL is not set. The f003_role_expand " +
      "pre-flight and re-apply guarantees are NOT verified in this run.",
  );
}

const SLOW = 120_000;
const PREFLIGHT = "f003_role_expand_preflight";
/** Section marker in the migration: everything before it = "stopped halfway". */
const HALFWAY_MARKER = "-- ── §3";

const scratch: ScratchDatabase[] = [];
afterAll(async () => {
  for (const db of scratch) await db.drop();
  removeStagedMigrations();
});

async function baselineDb() {
  const db = await createScratchDatabase(TEST_DB as string);
  scratch.push(db);
  const staged = stageMigrations({ upTo: F002_BASELINE });
  const base = migrateDeploy(staged.schemaPath, db.url);
  expect(base.status, `baseline deploy failed:\n${base.stderr}`).toBe(0);
  return { db, staged };
}

/** psql, one transaction, must succeed. */
function sql(url: string, text: string) {
  const res = runSqlCapturingNotices(url, `BEGIN;\n${text}\nCOMMIT;\n`);
  expect(res.status, res.stderr).toBe(0);
  return res;
}

/** Single-column query → trimmed lines (psql -A -t style via COPY-free SELECT). */
function query(url: string, text: string): string[] {
  const res = runSqlCapturingNotices(
    url,
    `\\pset format unaligned\n\\pset tuples_only on\n${text}`,
  );
  expect(res.status, res.stderr).toBe(0);
  return res.stdout.split("\n").filter((l) => l.length > 0);
}

/** Every schema object F-003 adds or removes, rendered as text (order-stable). */
function catalogue(url: string): string[] {
  return query(
    url,
    `SELECT 'col ' || table_name || '.' || column_name || ' ' || data_type || ' null=' || is_nullable
              || ' def=' || coalesce(column_default, '-')
       FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name IN ('Role', 'Invitation')
     UNION ALL
     SELECT 'con ' || conname || ' ' || pg_get_constraintdef(oid)
       FROM pg_constraint WHERE conrelid = '"Role"'::regclass
     UNION ALL
     SELECT 'idx ' || indexname || ' ' || indexdef
       FROM pg_indexes WHERE schemaname = current_schema() AND tablename = 'Role'
     UNION ALL
     SELECT 'trg ' || tgname || ' ' || pg_get_triggerdef(oid)
       FROM pg_trigger WHERE NOT tgisinternal
        AND tgrelid IN ('"Role"'::regclass, '"Membership"'::regclass, '"Invitation"'::regclass)
     UNION ALL
     SELECT 'fn ' || proname || ' volatile=' || provolatile::text || ' ' || md5(prosrc)
       FROM pg_proc WHERE proname LIKE 'omnistock_role_%'
     ORDER BY 1;`,
  );
}

const roleExpand = () => realMigrationBySlug("f003_role_expand");

// ── M3-02 ─────────────────────────────────────────────────────────────────────

/** Each case breaks ONE invariant of the broken shop, the way only an out-of-band edit could. */
const PREFLIGHT_CASES: ReadonlyArray<{
  check: string;
  why: string;
  breakIt: (org: string) => string;
}> = [
  {
    check: "name_duplicate_ci",
    why: "'Admin' and 'admin' in one shop (F-002's unique was case-sensitive)",
    breakIt: (org) =>
      `UPDATE "Role" SET name = 'admin' WHERE "organizationId" = '${org}' AND key = 'staff';`,
  },
  {
    check: "name_shape",
    why: "a name holding U+200B ZERO WIDTH SPACE (Cf)",
    breakIt: (org) =>
      `UPDATE "Role" SET name = 'Sta' || chr(8203) || 'ff' WHERE "organizationId" = '${org}' AND key = 'staff';`,
  },
  {
    check: "system_role_count",
    why: "two isSystem rows in one shop (SR-07)",
    breakIt: (org) =>
      `UPDATE "Role" SET "isSystem" = true WHERE "organizationId" = '${org}' AND key = 'admin';`,
  },
  {
    check: "capabilities_empty",
    why: "a role with no capability",
    breakIt: (org) =>
      `UPDATE "Role" SET capabilities = '{}' WHERE "organizationId" = '${org}' AND key = 'staff';`,
  },
  {
    check: "full_access_not_system",
    why: "a non-system role holding full_access",
    breakIt: (org) =>
      `UPDATE "Role" SET capabilities = '{full_access}' WHERE "organizationId" = '${org}' AND key = 'staff';`,
  },
];

d("M3-02 f003_role_expand pre-flight refuses broken F-002 data before touching the schema", () => {
  for (const c of PREFLIGHT_CASES) {
    it(
      `${c.check}: ${c.why} → deploy exit ≠ 0, stderr names the check and that shop, no column added`,
      async () => {
        const { db, staged } = await baselineDb();
        await seedF002Org(db.url, { tag: "healthy", ownerStatus: "active" });
        const broken = await seedF002Org(db.url, {
          tag: `broken-${c.check}`,
          ownerStatus: "active",
        });
        sql(db.url, c.breakIt(broken));

        staged.add(roleExpand());
        const res = migrateDeploy(staged.schemaPath, db.url);

        expect(res.status).not.toBe(0);
        expect(res.stderr).toContain(`${PREFLIGHT} check=${c.check} org=${broken}`);
        // "RAISE before touching the schema": no F-003 column exists afterwards
        expect(
          query(
            db.url,
            `SELECT column_name FROM information_schema.columns
              WHERE table_name = 'Role' AND column_name IN ('version', 'deletedAt');`,
          ),
        ).toEqual([]);
      },
      SLOW,
    );
  }

  it(
    "control: two clean F-002 shops (one with a non-active Owner — not this migration's rule) → exit 0",
    async () => {
      const { db, staged } = await baselineDb();
      await seedF002Org(db.url, { tag: "clean-a", ownerStatus: "active" });
      await seedF002Org(db.url, { tag: "clean-b", ownerStatus: "revoked" });
      staged.add(roleExpand());
      const res = migrateDeploy(staged.schemaPath, db.url);
      expect(res.status, res.stderr).toBe(0);
      expect(res.stderr).not.toContain(PREFLIGHT);
    },
    SLOW,
  );
});

// ── M3-03 ─────────────────────────────────────────────────────────────────────

d("M3-03 f003_role_expand re-applies cleanly and leaves no drift", () => {
  it(
    "full chain on seeded data → run the file again → catalogue unchanged → migrate diff empty",
    async () => {
      const { db, staged } = await baselineDb();
      await seedF002Org(db.url, { tag: "reapply-a", ownerStatus: "active" });
      await seedF002Org(db.url, { tag: "reapply-b", ownerStatus: "active" });
      for (const m of realMigrationsAfter(F002_BASELINE)) staged.add(m);
      const first = migrateDeploy(staged.schemaPath, db.url);
      expect(first.status, first.stderr).toBe(0);

      const before = catalogue(db.url);
      // non-vacuity: the snapshot holds what this migration creates
      expect(before).toEqual(
        expect.arrayContaining([expect.stringMatching(/^col Role\.version integer/)]),
      );
      expect(before.filter((l) => l.startsWith("trg "))).toHaveLength(5);
      expect(before.filter((l) => l.startsWith("fn "))).toHaveLength(4);

      const again = sql(db.url, roleExpand().sql());
      expect(again.errors).toEqual([]);
      expect(catalogue(db.url)).toEqual(before);

      const diff = migrateDiff(staged.schemaPath, db.url);
      expect(diff.status, `schema drift after re-apply:\n${diff.stdout}\n${diff.stderr}`).toBe(0);
    },
    SLOW,
  );

  it(
    "stopped halfway (§0–§2 applied by hand) → real deploy completes it → same catalogue as a clean apply",
    async () => {
      // reference: a clean apply
      const ref = await baselineDb();
      await seedF002Org(ref.db.url, { tag: "ref", ownerStatus: "active" });
      ref.staged.add(roleExpand());
      expect(migrateDeploy(ref.staged.schemaPath, ref.db.url).status).toBe(0);
      const expected = catalogue(ref.db.url);

      const { db, staged } = await baselineDb();
      await seedF002Org(db.url, { tag: "halfway", ownerStatus: "active" });
      const text = roleExpand().sql();
      const cut = text.indexOf(HALFWAY_MARKER);
      expect(cut, `marker '${HALFWAY_MARKER}' not found in the migration`).toBeGreaterThan(0);
      sql(db.url, text.slice(0, cut));

      // non-vacuity: really half — columns are there, the new index and triggers are not
      const half = catalogue(db.url);
      expect(half.some((l) => l.startsWith("col Role.version "))).toBe(true);
      expect(half.some((l) => l.startsWith("idx Role_org_name_ci_live_key"))).toBe(false);
      expect(half.some((l) => l.startsWith("trg "))).toBe(false);

      staged.add(roleExpand());
      const res = migrateDeploy(staged.schemaPath, db.url);
      expect(res.status, res.stderr).toBe(0);
      expect(catalogue(db.url)).toEqual(expected);

      const diff = migrateDiff(staged.schemaPath, db.url);
      expect(diff.status, `schema drift:\n${diff.stdout}\n${diff.stderr}`).toBe(0);
    },
    SLOW,
  );

  it("the migration sorts right after the F-002 baseline (it is the first F-003 migration)", () => {
    const names = listRealMigrations();
    const i = names.indexOf(F002_BASELINE);
    expect(names[i + 1]).toBe(roleExpand().name);
  });
});
