// F-003 · T-003-QA05 ★ — migration-fail harness + M3-01 (test-plan §4.14,
// architecture §13.1, data-model §4.2). Requires TEST_DATABASE_URL; skipped
// otherwise, loudly (same convention as src/*.db.test.ts).
//
// WHAT THIS PROVES
//   1. The harness itself is live (not decorative): a fixture migration that
//      RAISEs unconditionally makes `prisma migrate deploy` exit != 0 with the
//      RAISE text on stderr, and a no-op control fixture exits 0. Without this
//      pair, M3-01 could be "green" because the harness swallows failures.
//   2. M3-01: migrate to the F-002 baseline → seed a shop whose active Owner
//      count is 0 → apply the F-003 migration(s) → exit != 0 AND stderr names
//      THAT org (`f003_owner_invariant_violation org=<id>`). Control: a
//      baseline where every shop has an active Owner → the same migration(s)
//      apply cleanly.
//   3. The NOTICE-capture helper M3-04 will read `f003_backfill …` lines with.
//
// SOURCE OF THE F-003 MIGRATION: until T-003-B11 lands the real
// `*_f003_backfill_manage_roles` (which carries the RAISE), M3-01 runs against
// a stand-in fixture that implements the data-model §4.2 invariant check. The
// "source guard" test turns RED the moment a real migration under
// prisma/migrations carries the invariant while the stand-in is still in use —
// so the stand-in cannot silently outlive the real thing.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  F002_BASELINE,
  F003_MIGRATION_SOURCE,
  appliedMigrations,
  createScratchDatabase,
  fixtureMigration,
  migrateDeploy,
  realMigrationsContaining,
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
    "[T-003-QA05] SKIPPING the migration-fail harness + M3-01: TEST_DATABASE_URL is not set. " +
      "The Owner ≥ 1 migration invariant (AC-4.3 / AC-1.3) is NOT verified in this run.",
  );
}

const INVARIANT = "f003_owner_invariant_violation";
// Each case builds a fresh database and replays the whole migration chain.
const SLOW = 120_000;

/** Tracks scratch DBs so a failing assertion never leaks a database. */
const scratch: ScratchDatabase[] = [];
async function freshDb(): Promise<ScratchDatabase> {
  const db = await createScratchDatabase(TEST_DB as string);
  scratch.push(db);
  return db;
}
afterAll(async () => {
  for (const db of scratch) await db.drop();
  removeStagedMigrations();
});

/** Migrates a fresh DB to the F-002 baseline and asserts it stopped exactly there. */
async function baselineDb() {
  const db = await freshDb();
  const staged = stageMigrations({ upTo: F002_BASELINE });
  const base = migrateDeploy(staged.schemaPath, db.url);
  expect(base.status, `baseline deploy failed:\n${base.stderr}\n${base.stdout}`).toBe(0);
  return { db, staged };
}

d("migration harness — self-proof with fixture migrations (T-003-QA05)", () => {
  it(
    "stops at the baseline: _prisma_migrations holds exactly the migrations ≤ F002_BASELINE",
    async () => {
      const { db, staged } = await baselineDb();
      const applied = await appliedMigrations(db.url);
      expect(applied.map((m) => m.name)).toEqual(staged.names);
      expect(staged.names.at(-1)).toBe(F002_BASELINE);
      // non-vacuity: the chain is the real one, not an empty dir that "applied" nothing
      expect(staged.names.length).toBeGreaterThanOrEqual(6);
      expect(applied.every((m) => m.finished)).toBe(true);
    },
    SLOW,
  );

  it(
    "a fixture that RAISEs → deploy exit ≠ 0 and the RAISE text reaches stderr",
    async () => {
      const { db, staged } = await baselineDb();
      staged.add(fixtureMigration("qa05_always_raise"));
      const res = migrateDeploy(staged.schemaPath, db.url);
      expect(res.status).not.toBe(0);
      expect(res.stderr).toContain("qa05_fixture_always_raise marker=harness-live");
      // and it is recorded as failed, not as applied
      const row = (await appliedMigrations(db.url)).find((m) =>
        m.name.endsWith("qa05_always_raise"),
      );
      expect(row?.finished).toBe(false);
    },
    SLOW,
  );

  it(
    "control: a no-op fixture → deploy exit 0 and it is recorded as applied",
    async () => {
      const { db, staged } = await baselineDb();
      staged.add(fixtureMigration("qa05_noop"));
      const res = migrateDeploy(staged.schemaPath, db.url);
      expect(res.status, res.stderr).toBe(0);
      const row = (await appliedMigrations(db.url)).find((m) => m.name.endsWith("qa05_noop"));
      expect(row?.finished).toBe(true);
    },
    SLOW,
  );
});

d(
  `M3-01 ★ Owner ≥ 1 at the end of the F-003 migration (source: ${F003_MIGRATION_SOURCE.kind})`,
  () => {
    it("source guard: the stand-in is not used once a real migration carries the invariant", () => {
      const real = realMigrationsContaining(INVARIANT);
      if (F003_MIGRATION_SOURCE.kind === "stand-in") {
        expect(
          real,
          "a real migration now carries the Owner invariant — point F003_MIGRATION_SOURCE at the real " +
            "F-003 migrations (migration-harness.ts) and delete the stand-in fixture",
        ).toEqual([]);
      } else {
        // real source: the RAISE must be in what we apply, or M3-01 proves nothing
        expect(real.length).toBeGreaterThan(0);
        for (const name of real)
          expect(F003_MIGRATION_SOURCE.migrations.map((m) => m.name)).toContain(name);
      }
      // non-vacuity: whatever we apply actually contains the RAISE text
      expect(
        F003_MIGRATION_SOURCE.migrations.some((m) => m.sql().includes(`${INVARIANT} org=%`)),
      ).toBe(true);
    });

    for (const ownerStatus of ["revoked", "invited"] as const) {
      it(
        `shop whose only Owner membership is '${ownerStatus}' (active Owner = 0) → exit ≠ 0 + stderr names that org`,
        async () => {
          const { db, staged } = await baselineDb();
          // a healthy shop alongside — the RAISE must name the broken one, not "any org"
          await seedF002Org(db.url, { tag: "healthy", ownerStatus: "active" });
          const broken = await seedF002Org(db.url, { tag: `broken-${ownerStatus}`, ownerStatus });

          for (const m of F003_MIGRATION_SOURCE.migrations) staged.add(m);
          const res = migrateDeploy(staged.schemaPath, db.url);

          expect(res.status).not.toBe(0);
          expect(res.stderr).toContain(`${INVARIANT} org=${broken}`);
        },
        SLOW,
      );
    }

    it(
      "control: every shop has an active Owner (admin/staff active too) → the same migration applies, exit 0",
      async () => {
        const { db, staged } = await baselineDb();
        await seedF002Org(db.url, { tag: "healthy-a", ownerStatus: "active" });
        await seedF002Org(db.url, { tag: "healthy-b", ownerStatus: "active" });

        for (const m of F003_MIGRATION_SOURCE.migrations) staged.add(m);
        const res = migrateDeploy(staged.schemaPath, db.url);

        expect(res.status, res.stderr).toBe(0);
        expect(res.stderr).not.toContain(INVARIANT);
        const names = (await appliedMigrations(db.url))
          .filter((m) => m.finished)
          .map((m) => m.name);
        for (const m of F003_MIGRATION_SOURCE.migrations) expect(names).toContain(m.name);
      },
      SLOW,
    );
  },
);

d("NOTICE capture helper (for M3-04)", () => {
  let db: ScratchDatabase;
  beforeAll(async () => {
    db = await freshDb();
  });

  it("returns every RAISE NOTICE, in order, with the text intact", () => {
    const res = runSqlCapturingNotices(
      db.url,
      `DO $$ BEGIN
         RAISE NOTICE 'f003_backfill actor=system org=% role=%', 'org_1', 'role_1';
         RAISE NOTICE 'f003_backfill actor=system org=% role=%', 'org_2', 'role_2';
       END $$;`,
    );
    expect(res.status).toBe(0);
    expect(res.notices).toEqual([
      "f003_backfill actor=system org=org_1 role=role_1",
      "f003_backfill actor=system org=org_2 role=role_2",
    ]);
  });

  it("separates WARNINGs from NOTICEs and reports zero when there are none", () => {
    const res = runSqlCapturingNotices(
      db.url,
      `DO $$ BEGIN RAISE WARNING 'f003_admin_mismatch count=%', 2; END $$;`,
    );
    expect(res.status).toBe(0);
    expect(res.notices).toEqual([]);
    expect(res.warnings).toEqual(["f003_admin_mismatch count=2"]);
  });

  it("an ERROR is surfaced (exit ≠ 0 + message) — never swallowed into an empty notice list", () => {
    const res = runSqlCapturingNotices(
      db.url,
      `DO $$ BEGIN RAISE NOTICE 'before'; RAISE EXCEPTION 'boom org=%', 'x'; END $$;`,
    );
    expect(res.status).not.toBe(0);
    expect(res.errors).toEqual(["boom org=x"]);
    expect(res.notices).toEqual(["before"]);
  });
});
