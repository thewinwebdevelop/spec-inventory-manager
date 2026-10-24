// F-003 · T-003-B11 ★ — M3-04 · M3-05 · M3-06 · M3-07 + the "Role.capabilities
// ⊆ registry" check, on the REAL `*_f003_backfill_manage_roles` migration
// (test-plan §4.14 · data-model §4.2/§4.3 · architecture §12). M3-01 (Owner ≥ 1)
// lives in f003-owner-invariant.int.test.ts, now pointed at the same migration.
// Requires TEST_DATABASE_URL (+ psql for NOTICE capture); skipped otherwise, loudly.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../generated/client";
import {
  BACKFILL_F003_SLUG,
  backfillF003MigrationPath,
  readBackfillF003Sql,
  rolesOutsideRegistry,
  rollbackSafetyCount,
  runBackfillF003,
} from "../src/backfill-f003";
import {
  F002_BASELINE,
  createScratchDatabase,
  migrateDeploy,
  realMigrationBySlug,
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
    "[T-003-B11] SKIPPING M3-04..M3-07: TEST_DATABASE_URL is not set. The manage_roles " +
      "backfill, the admin bridge trigger and backfill:f003 are NOT verified in this run.",
  );
}

const SLOW = 120_000;

/** F-002 Admin (7) + manage_roles, byte order — what F-003 provisioning writes (SYSTEM_ROLE_BLUEPRINT). */
const ADMIN_F003 = [
  "manage_channels",
  "manage_members",
  "manage_orders",
  "manage_org_settings",
  "manage_products",
  "manage_roles",
  "manage_stock",
  "view_financials",
];
const ADMIN_F002 = ADMIN_F003.filter((c) => c !== "manage_roles");
/** The F-002 Staff/Owner rows as the harness seeds them (order preserved — never touched). */
const STAFF_F002 = ["manage_products", "manage_stock", "manage_orders"];

const scratch: ScratchDatabase[] = [];
const clients: PrismaClient[] = [];
afterAll(async () => {
  for (const c of clients) await c.$disconnect();
  for (const db of scratch) await db.drop();
  removeStagedMigrations();
});

function client(url: string): PrismaClient {
  const c = new PrismaClient({ datasources: { db: { url } } });
  clients.push(c);
  return c;
}

/** Fresh DB at the F-002 baseline, `seed` run on it, then `f003_role_expand` deployed (not the backfill). */
async function expandedDb(seed: (url: string) => Promise<void>) {
  const db = await createScratchDatabase(TEST_DB as string);
  scratch.push(db);
  const staged = stageMigrations({ upTo: F002_BASELINE });
  expect(migrateDeploy(staged.schemaPath, db.url).status).toBe(0);
  await seed(db.url);
  staged.add(realMigrationBySlug("f003_role_expand"));
  const res = migrateDeploy(staged.schemaPath, db.url);
  expect(res.status, res.stderr).toBe(0);
  return { db, staged };
}

function sql(url: string, text: string) {
  const res = runSqlCapturingNotices(url, `BEGIN;\n${text}\nCOMMIT;\n`);
  expect(res.status, res.stderr).toBe(0);
  return res;
}

type RoleRow = {
  id: string;
  organizationId: string;
  key: string | null;
  capabilities: string[];
  version: number;
  lastEditedAt: Date | null;
};
async function roles(c: PrismaClient, org: string): Promise<Record<string, RoleRow>> {
  const rows = await c.$queryRawUnsafe<RoleRow[]>(
    `SELECT id, "organizationId", key, capabilities, version, "lastEditedAt"
       FROM "Role" WHERE "organizationId" = $1 ORDER BY id`,
    org,
  );
  // by the seed's role id prefix (role-<seedKey>-…), which survives key swaps
  return Object.fromEntries(rows.map((r) => [r.id.split("-")[1], r]));
}

// ── M3-04 ─────────────────────────────────────────────────────────────────────
d("M3-04 ★ backfill: exact preset · idempotent · fail-closed on a mismatch", () => {
  it(
    "F-002 shop → Admin gets manage_roles (canonical), Owner/Staff untouched, one NOTICE per row; a second backfill:f003 = 0 rows and no version bump",
    async () => {
      let healthy = "";
      let drifted = "";
      let swapped = "";
      const { db } = await expandedDb(async (url) => {
        healthy = await seedF002Org(url, { tag: "healthy", ownerStatus: "active" });
        drifted = await seedF002Org(url, { tag: "drifted", ownerStatus: "active" });
        swapped = await seedF002Org(url, { tag: "swapped", ownerStatus: "active" });
        // key='admin' but not the F-002 set (someone removed view_financials by hand)
        sql(
          url,
          `UPDATE "Role" SET capabilities = array_remove(capabilities, 'view_financials')
                   WHERE "organizationId" = '${drifted}' AND key = 'admin';`,
        );
        // I-45: keys swapped — Staff now carries key='admin', Admin carries 'staff'
        // ("organizationId", key) is unique — swap through a placeholder
        sql(
          url,
          `UPDATE "Role" SET key = 'swap' WHERE "organizationId" = '${swapped}' AND key = 'admin';
                  UPDATE "Role" SET key = 'admin' WHERE "organizationId" = '${swapped}' AND key = 'staff';
                  UPDATE "Role" SET key = 'staff' WHERE "organizationId" = '${swapped}' AND key = 'swap';`,
        );
      });
      const c = client(db.url);

      // the migration file itself, through a notice handler (psql)
      const applied = sql(db.url, readBackfillF003Sql());

      const h = await roles(c, healthy);
      expect(h.owner!.capabilities).toEqual(["full_access"]);
      expect(h.admin!.capabilities).toEqual(ADMIN_F003);
      expect(h.staff!.capabilities).toEqual(STAFF_F002);
      expect([h.owner!.version, h.admin!.version, h.staff!.version]).toEqual([1, 2, 1]);
      expect(Object.values(h).every((r) => r.lastEditedAt === null)).toBe(true);

      const dr = await roles(c, drifted);
      expect(dr.admin!.capabilities).not.toContain("manage_roles");
      expect(dr.admin!.version).toBe(1);
      const sw = await roles(c, swapped);
      expect(sw.staff!.key).toBe("admin");
      expect(sw.staff!.capabilities).toEqual(STAFF_F002); // key='admin' gives nothing
      expect([...sw.admin!.capabilities].sort()).toEqual(ADMIN_F002); // key='staff' gets nothing either
      expect(Object.values(sw).every((r) => r.version === 1)).toBe(true);

      // one NOTICE for the one row changed, attributed to the system (the other
      // NOTICE is Postgres' own "DROP TRIGGER IF EXISTS … skipping")
      expect(
        applied.notices.filter((n) => !/^trigger .* does not exist, skipping$/.test(n)),
      ).toEqual([
        `f003_backfill actor=system org=${healthy} role=${h.admin!.id} added=manage_roles`,
      ]);
      // fail closed + loud: the two key='admin' rows that do not match are counted
      expect(applied.warnings).toEqual([
        expect.stringMatching(/^f003_backfill_admin_mismatch count=2\b/),
      ]);

      // backfill:f003 (the script) — twice: nothing left to do, versions frozen
      const before = await roles(c, healthy);
      const first = await runBackfillF003(c);
      const second = await runBackfillF003(c);
      expect([first.rolesUpdated, second.rolesUpdated]).toEqual([0, 0]);
      const after = await roles(c, healthy);
      expect(Object.values(after).map((r) => r.version)).toEqual(
        Object.values(before).map((r) => r.version),
      );
    },
    SLOW,
  );

  it(
    "backfill:f003 on a database the migration has not touched updates the row and reports it",
    async () => {
      let org = "";
      const { db } = await expandedDb(async (url) => {
        org = await seedF002Org(url, { tag: "script", ownerStatus: "active" });
      });
      const c = client(db.url);
      const first = await runBackfillF003(c);
      expect(first.rolesUpdated).toBe(1);
      expect((await roles(c, org)).admin!.capabilities).toEqual(ADMIN_F003);
      expect((await runBackfillF003(c)).rolesUpdated).toBe(0);
    },
    SLOW,
  );

  it(
    "through the real `prisma migrate deploy`: the Admin row equals the F-003 preset",
    async () => {
      let org = "";
      const { db, staged } = await expandedDb(async (url) => {
        org = await seedF002Org(url, { tag: "deploy", ownerStatus: "active" });
      });
      staged.add(realMigrationBySlug(BACKFILL_F003_SLUG));
      const res = migrateDeploy(staged.schemaPath, db.url);
      expect(res.status, res.stderr).toBe(0);
      const r = await roles(client(db.url), org);
      expect([r.owner!.capabilities, r.admin!.capabilities, r.staff!.capabilities]).toEqual([
        ["full_access"],
        ADMIN_F003,
        STAFF_F002,
      ]);
    },
    SLOW,
  );

  it(
    "★ fix round 1 (security High): an Admin an Owner edited back to the F-002 seven is NOT re-granted by a re-run, and is not reported as a mismatch",
    async () => {
      let org = "";
      const { db } = await expandedDb(async (url) => {
        org = await seedF002Org(url, { tag: "owneredit", ownerStatus: "active" });
      });
      const c = client(db.url);
      expect((await runBackfillF003(c)).rolesUpdated).toBe(1);
      // the Owner takes manage_roles away through a role PATCH (F-003 write path shape)
      const adminId = (await roles(c, org)).admin!.id;
      await c.$executeRawUnsafe(
        `UPDATE "Role" SET capabilities = $1::text[], version = version + 1,
                "lastEditedAt" = now(), "lastEditedByUserId" = $2
          WHERE id = $3`,
        ADMIN_F002,
        `user-owner-${org.slice("org-".length)}`,
        adminId,
      );
      const edited = (await roles(c, org)).admin!;

      const rerun = await runBackfillF003(c);
      expect(rerun.rolesUpdated).toBe(0);
      const after = (await roles(c, org)).admin!;
      expect(after.capabilities).toEqual(ADMIN_F002);
      expect(after.version).toBe(edited.version);

      // the same file through a notice handler: no NOTICE, no mismatch WARNING
      const res = sql(db.url, readBackfillF003Sql());
      expect(res.notices.filter((n) => n.startsWith("f003_backfill "))).toEqual([]);
      expect(res.warnings).toEqual([]);
    },
    SLOW,
  );
});

// ── fix round 1 (security Medium ×2): bridge lifecycle + locks ────────────────
d("bridge lifecycle after f003_drop_admin_bridge · no ACCESS EXCLUSIVE on Role", () => {
  /** Modes this transaction holds on "Role" after running the backfill file (then ROLLBACK). */
  function roleLocksDuring(url: string): string[] {
    const res = runSqlCapturingNotices(
      url,
      `\\pset format unaligned\n\\pset tuples_only on\nBEGIN;\n${readBackfillF003Sql()}\n` +
        `SELECT 'LOCKS:' || coalesce(string_agg(DISTINCT mode, ',' ORDER BY mode), '')
           FROM pg_locks WHERE pid = pg_backend_pid() AND relation = '"Role"'::regclass;\nROLLBACK;\n`,
    );
    expect(res.status, res.stderr).toBe(0);
    const line = res.stdout.split("\n").find((l) => l.startsWith("LOCKS:"));
    expect(line, res.stdout).toBeDefined();
    return line!.slice("LOCKS:".length).split(",").filter(Boolean);
  }
  const bridgeTriggers = async (c: PrismaClient) =>
    (
      await c.$queryRawUnsafe<{ n: number }[]>(
        `SELECT count(*)::int AS n FROM pg_trigger
          WHERE tgrelid = '"Role"'::regclass AND tgname = 'role_f003_admin_bridge'`,
      )
    )[0]!.n;

  it(
    "★ a re-run (bridge already there) and a first run take no AccessExclusiveLock on Role",
    async () => {
      const { db, staged } = await expandedDb(async (url) => {
        await seedF002Org(url, { tag: "locks", ownerStatus: "active" });
      });
      const first = roleLocksDuring(db.url); // bridge not created yet
      expect(first).not.toContain("AccessExclusiveLock");
      expect(first.length, "non-vacuity: the UPDATE/CREATE TRIGGER did lock Role").toBeGreaterThan(
        0,
      );
      staged.add(realMigrationBySlug(BACKFILL_F003_SLUG));
      expect(migrateDeploy(staged.schemaPath, db.url).status).toBe(0);
      expect(await bridgeTriggers(client(db.url))).toBe(1);
      expect(roleLocksDuring(db.url)).not.toContain("AccessExclusiveLock");
    },
    SLOW,
  );

  it(
    "★ once f003_drop_admin_bridge is applied: backfill:f003 refuses (nothing written), and the file never re-creates the trigger",
    async () => {
      let org = "";
      const { db, staged } = await expandedDb(async (url) => {
        org = await seedF002Org(url, { tag: "dropped", ownerStatus: "active" });
      });
      staged.add(realMigrationBySlug(BACKFILL_F003_SLUG));
      expect(migrateDeploy(staged.schemaPath, db.url).status).toBe(0);
      const c = client(db.url);
      // stand-in for the future drop migration, recorded the way prisma records it
      await c.$executeRawUnsafe(`DROP TRIGGER IF EXISTS role_f003_admin_bridge ON "Role"`);
      await c.$executeRawUnsafe(`DROP FUNCTION IF EXISTS role_f003_admin_bridge()`);
      await c.$executeRawUnsafe(
        `INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
         VALUES ('drop-standin', 'x', now(), '20270101000000_f003_drop_admin_bridge', now(), 1)`,
      );
      // an Admin row the backfill would otherwise change
      await c.$executeRawUnsafe(
        `UPDATE "Role" SET capabilities = $1::text[] WHERE "organizationId" = $2 AND key = 'admin'`,
        ADMIN_F002,
        org,
      );

      await expect(runBackfillF003(c)).rejects.toThrow(/f003_drop_admin_bridge.*applied/);
      expect((await roles(c, org)).admin!.capabilities).toEqual(ADMIN_F002);
      expect(await bridgeTriggers(c)).toBe(0);

      // even the raw file (no CLI guard) leaves the trigger dropped
      sql(db.url, readBackfillF003Sql());
      expect(await bridgeTriggers(c)).toBe(0);

      // control: a ROLLED-BACK drop migration does not count
      await c.$executeRawUnsafe(
        `UPDATE _prisma_migrations SET rolled_back_at = now() WHERE id = 'drop-standin'`,
      );
      // (the raw file above already ran §1, so the row count here is 0 — the point
      // is that the CLI runs again and the missing trigger is created again)
      await expect(runBackfillF003(c)).resolves.toMatchObject({ rolesUpdated: 0 });
      expect(await bridgeTriggers(c)).toBe(1);
    },
    SLOW,
  );
});

// ── M3-05 ─────────────────────────────────────────────────────────────────────
d("M3-05 bridge trigger role_f003_admin_bridge (BEFORE INSERT only)", () => {
  it(
    "F-002-shaped Admin insert gains manage_roles · F-003 Admin unchanged · custom/other keys untouched · UPDATE untouched",
    async () => {
      let org = "";
      const { db } = await expandedDb(async (url) => {
        org = await seedF002Org(url, { tag: "bridge", ownerStatus: "active" });
      });
      sql(db.url, readBackfillF003Sql());
      const c = client(db.url);
      // ("organizationId", key) is unique: each keyed insert gets its own shop
      const insert = async (id: string, key: string | null, caps: string[]) => {
        const shop = key === null ? org : `org-${id}`;
        if (key !== null) {
          await c.$executeRawUnsafe(
            `INSERT INTO "Organization"(id, name, "updatedAt") VALUES ($1, $1, now())`,
            shop,
          );
        }
        await c.$executeRawUnsafe(
          `INSERT INTO "Role"(id, "organizationId", name, capabilities, key, "updatedAt")
           VALUES ($1, $2, $3, $4::text[], $5, now())`,
          id,
          shop,
          `n-${id}`,
          caps,
          key,
        );
      };
      const capsOf = async (id: string) =>
        (
          await c.$queryRawUnsafe<{ capabilities: string[] }[]>(
            `SELECT capabilities FROM "Role" WHERE id = $1`,
            id,
          )
        )[0]!.capabilities;

      // F-002 code path: blueprint order, not sorted
      await insert("f002-admin", "admin", [
        "manage_members",
        "manage_org_settings",
        "manage_products",
        "manage_stock",
        "manage_channels",
        "manage_orders",
        "view_financials",
      ]);
      expect(await capsOf("f002-admin")).toEqual(ADMIN_F003);

      await insert("f003-admin", "admin", ADMIN_F003);
      expect(await capsOf("f003-admin")).toEqual(ADMIN_F003); // no duplicate

      await insert("custom", null, ADMIN_F002);
      expect(await capsOf("custom")).toEqual(ADMIN_F002);
      await insert("staff-keyed", "staff", ADMIN_F002);
      expect(await capsOf("staff-keyed")).toEqual(ADMIN_F002);
      await insert("admin-subset", "admin", ADMIN_F002.slice(1));
      expect(await capsOf("admin-subset")).toEqual(ADMIN_F002.slice(1));

      // UPDATE is not the trigger's business
      await c.$executeRawUnsafe(
        `UPDATE "Role" SET capabilities = $1::text[] WHERE id = 'f003-admin'`,
        ADMIN_F002,
      );
      expect(await capsOf("f003-admin")).toEqual(ADMIN_F002);
    },
    SLOW,
  );
});

// ── M3-06 ─────────────────────────────────────────────────────────────────────
d("M3-06 backfill:f003 executes exactly the migration file", () => {
  it(
    "the text the DATABASE received hashes to the committed migration.sql",
    async () => {
      const { db } = await expandedDb(async (url) => {
        await seedF002Org(url, { tag: "hash", ownerStatus: "active" });
      });
      const onDisk = readFileSync(
        join(
          __dirname,
          "..",
          "prisma",
          "migrations",
          realMigrationBySlug(BACKFILL_F003_SLUG).name,
          "migration.sql",
        ),
      );
      const res = await runBackfillF003(client(db.url));
      expect(res.executedSha256).toBe(createHash("sha256").update(onDisk).digest("hex"));
      expect(backfillF003MigrationPath()).toMatch(
        new RegExp(`prisma/migrations/\\d{14}_${BACKFILL_F003_SLUG}/migration\\.sql$`),
      );
    },
    SLOW,
  );

  it(
    "Owner ≥ 1 fails the script too, and its transaction leaves nothing behind",
    async () => {
      let broken = "";
      let ok = "";
      const { db } = await expandedDb(async (url) => {
        ok = await seedF002Org(url, { tag: "ok", ownerStatus: "active" });
        broken = await seedF002Org(url, { tag: "noowner", ownerStatus: "revoked" });
      });
      const c = client(db.url);
      await expect(runBackfillF003(c)).rejects.toThrow(
        `f003_owner_invariant_violation org=${broken}`,
      );
      const admin = (await roles(c, ok)).admin!;
      expect([...admin.capabilities].sort()).toEqual(ADMIN_F002); // rolled back: no manage_roles
      expect(admin.version).toBe(1);
    },
    SLOW,
  );
});

// ── M3-07 + ⊆ registry ────────────────────────────────────────────────────────
d("M3-07 rollback-safety query (architecture §12) · Role.capabilities ⊆ registry", () => {
  it(
    "= 0 right after migrating (backfill writes no lastEditedAt); > 0 once one custom role exists",
    async () => {
      let org = "";
      const { db } = await expandedDb(async (url) => {
        org = await seedF002Org(url, { tag: "rb", ownerStatus: "active" });
      });
      const c = client(db.url);
      await runBackfillF003(c);
      expect(await rollbackSafetyCount(c)).toBe(0);
      await c.$executeRawUnsafe(
        `INSERT INTO "Role"(id, "organizationId", name, capabilities, "updatedAt")
         VALUES ('custom-1', $1, 'Packer', ARRAY['manage_stock'], now())`,
        org,
      );
      expect(await rollbackSafetyCount(c)).toBe(1);
    },
    SLOW,
  );

  it(
    "lists every role holding a key outside the registry (with the unknown keys); none when clean",
    async () => {
      let org = "";
      const { db } = await expandedDb(async (url) => {
        org = await seedF002Org(url, { tag: "reg", ownerStatus: "active" });
      });
      const c = client(db.url);
      await runBackfillF003(c);
      const registry = ["full_access", ...ADMIN_F003];
      expect(await rolesOutsideRegistry(c, registry)).toEqual([]);

      await c.$executeRawUnsafe(
        `UPDATE "Role" SET capabilities = array_append(capabilities, 'export_everything')
          WHERE "organizationId" = $1 AND key = 'staff'`,
        org,
      );
      const out = await rolesOutsideRegistry(c, registry);
      expect(out).toEqual([
        {
          organizationId: org,
          roleId: `role-staff-${org.slice("org-".length)}`,
          unregistered: ["export_everything"],
        },
      ]);
      // control: the same row is clean against a registry that has the key
      expect(await rolesOutsideRegistry(c, [...registry, "export_everything"])).toEqual([]);
      await expect(rolesOutsideRegistry(c, [])).rejects.toThrow(/empty/);
    },
    SLOW,
  );
});
