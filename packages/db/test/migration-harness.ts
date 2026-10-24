// F-003 · T-003-QA05 ★ — migration-fail harness (test-plan §4.14 M3-01 ·
// architecture §13.1 · data-model §4.2 "migration-fail harness (Q-QA-1)").
//
// Replays the REAL committed migration chain up to a named baseline into a
// throw-away database, lets the test seed data that only an old schema allows,
// then applies the next migration(s) with the real `prisma migrate deploy` and
// hands back exit code + stdout + stderr untouched. Nothing here interprets a
// failure: a non-zero exit is returned, a harness malfunction (CLI missing,
// timeout, killed) THROWS — never "treat as passed" (BUILD-RULES fail-loud).
//
// Why scratch databases (CREATE DATABASE per case) and not the shared
// TEST_DATABASE_URL: that DB is already migrated to HEAD by the CI lane; a
// migration cannot be un-applied, and a failed migration leaves it in a state
// `migrate deploy` refuses to continue from. Every case gets its own DB and
// drops it afterwards.
//
// Why psql for NOTICE capture (M3-04): Prisma discards server NOTICE/WARNING
// messages, and adding a driver (`pg`) is a new dependency this task may not add
// (BUILD-RULES §5 — raised in the task report). psql prints them on stderr with
// a fixed `NOTICE:  ` prefix; the helper parses that and throws if psql is absent.
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "../generated/client";

const PKG_ROOT = join(__dirname, "..");
const PRISMA_DIR = join(PKG_ROOT, "prisma");
const REAL_MIGRATIONS = join(PRISMA_DIR, "migrations");
const FIXTURE_MIGRATIONS = join(__dirname, "fixtures", "migrations");
const PRISMA_BIN = join(
  PKG_ROOT,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prisma.cmd" : "prisma",
);

/** Last migration of F-002 — the state F-003's migrations are applied on top of. */
export const F002_BASELINE = "20260807000000_f002_role_org_composite_fk";

/** Fixtures sort right after the baseline so they are "the next migration". */
const FIXTURE_TIMESTAMP = "20260807000001";

export interface MigrationSource {
  readonly name: string;
  sql(): string;
}

export interface F003Source {
  readonly kind: "stand-in" | "real";
  readonly migrations: readonly MigrationSource[];
}

// ── real / fixture migration discovery ─────────────────────────────────────────

/** Committed migration directory names, in apply order (Prisma sorts by name). */
export function listRealMigrations(): string[] {
  return readdirSync(REAL_MIGRATIONS, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

function realMigration(name: string): MigrationSource {
  const file = join(REAL_MIGRATIONS, name, "migration.sql");
  return { name, sql: () => readFileSync(file, "utf8") };
}

/** The committed migration whose directory name ends in `_<slug>` (exactly one). */
export function realMigrationBySlug(slug: string): MigrationSource {
  const hits = listRealMigrations().filter((n) => n.endsWith(`_${slug}`));
  if (hits.length !== 1)
    throw new Error(`expected exactly 1 committed migration *_${slug}, found ${hits.length}`);
  return realMigration(hits[0]);
}

/** Every committed migration after `baseline`, in order. */
export function realMigrationsAfter(baseline: string): MigrationSource[] {
  const names = listRealMigrations();
  if (!names.includes(baseline)) throw new Error(`baseline migration not found: ${baseline}`);
  return names.filter((n) => n > baseline).map(realMigration);
}

/** Names of committed migrations whose SQL contains `text`. */
export function realMigrationsContaining(text: string): string[] {
  return listRealMigrations().filter((n) => realMigration(n).sql().includes(text));
}

/** A migration under test/fixtures/migrations/<slug>/ — never under prisma/migrations. */
export function fixtureMigration(slug: string): MigrationSource {
  const file = join(FIXTURE_MIGRATIONS, slug, "migration.sql");
  if (!existsSync(file)) throw new Error(`fixture migration not found: ${file}`);
  return { name: `${FIXTURE_TIMESTAMP}_${slug}`, sql: () => readFileSync(file, "utf8") };
}

/**
 * What M3-01 applies on top of the F-002 baseline: every committed F-003
 * migration, in order — `*_f003_role_expand` then `*_f003_backfill_manage_roles`,
 * whose §3 carries `RAISE EXCEPTION 'f003_owner_invariant_violation org=%'`.
 * (T-003-B11 switched this from the QA05 stand-in fixture, now deleted.)
 */
export const F003_MIGRATION_SOURCE: F003Source = {
  kind: "real",
  migrations: realMigrationsAfter(F002_BASELINE),
};

// ── staging a migrations directory ────────────────────────────────────────────

export interface StagedMigrations {
  readonly dir: string;
  readonly schemaPath: string;
  /** Migration names currently staged, in order. */
  readonly names: string[];
  /** Stage one more migration; it must sort after everything already staged. */
  add(migration: MigrationSource): void;
}

const stagedDirs: string[] = [];

/** Deletes every temp dir created by stageMigrations (call from afterAll). */
export function removeStagedMigrations(): void {
  for (const dir of stagedDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
}

/**
 * Builds a temp dir `{schema.prisma, migrations/}` holding the committed
 * migrations up to and including `upTo` (verbatim copies — same checksums).
 */
export function stageMigrations(opts: { upTo: string }): StagedMigrations {
  const all = listRealMigrations();
  const cut = all.indexOf(opts.upTo);
  if (cut < 0) throw new Error(`stageMigrations: '${opts.upTo}' is not a committed migration`);

  const dir = mkdtempSync(join(tmpdir(), "omnistock-migharness-"));
  stagedDirs.push(dir);
  const migDir = join(dir, "migrations");
  mkdirSync(migDir);
  cpSync(join(PRISMA_DIR, "schema.prisma"), join(dir, "schema.prisma"));
  cpSync(join(REAL_MIGRATIONS, "migration_lock.toml"), join(migDir, "migration_lock.toml"));

  const names = all.slice(0, cut + 1);
  for (const n of names) cpSync(join(REAL_MIGRATIONS, n), join(migDir, n), { recursive: true });

  return {
    dir,
    schemaPath: join(dir, "schema.prisma"),
    names,
    add(migration) {
      const last = names[names.length - 1];
      if (migration.name <= last) {
        throw new Error(
          `stageMigrations.add: '${migration.name}' does not sort after '${last}' — Prisma would apply it out of order`,
        );
      }
      mkdirSync(join(migDir, migration.name));
      writeFileSync(join(migDir, migration.name, "migration.sql"), migration.sql());
      names.push(migration.name);
    },
  };
}

// ── running prisma migrate deploy ─────────────────────────────────────────────

export interface CommandResult {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

/** Real `prisma migrate deploy` against `url`. Non-zero exit is RETURNED; a CLI that could not run THROWS. */
export function migrateDeploy(schemaPath: string, url: string): CommandResult {
  if (!existsSync(PRISMA_BIN))
    throw new Error(`prisma CLI not found at ${PRISMA_BIN} — run pnpm install`);
  const res = spawnSync(PRISMA_BIN, ["migrate", "deploy", "--schema", schemaPath], {
    // cwd = the staged dir so no stray .env from the repo is picked up
    cwd: join(schemaPath, ".."),
    env: { ...process.env, DATABASE_URL: url, PRISMA_HIDE_UPDATE_MESSAGE: "1" },
    encoding: "utf8",
    timeout: 90_000,
  });
  if (res.error) throw new Error(`prisma migrate deploy could not run: ${res.error.message}`);
  if (res.status === null)
    throw new Error(`prisma migrate deploy was killed (${res.signal})\n${res.stderr}`);
  return { status: res.status, stdout: res.stdout, stderr: res.stderr };
}

/**
 * Real `prisma migrate diff` from the live database at `url` to the datamodel
 * in `schemaPath`, with `--exit-code`: status 0 = no drift, 2 = drift (the SQL
 * that would fix it is on stdout). A CLI that could not run THROWS.
 */
export function migrateDiff(schemaPath: string, url: string): CommandResult {
  if (!existsSync(PRISMA_BIN))
    throw new Error(`prisma CLI not found at ${PRISMA_BIN} — run pnpm install`);
  const res = spawnSync(
    PRISMA_BIN,
    [
      "migrate",
      "diff",
      "--from-url",
      url,
      "--to-schema-datamodel",
      schemaPath,
      "--script",
      "--exit-code",
    ],
    {
      cwd: join(schemaPath, ".."),
      env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: "1" },
      encoding: "utf8",
      timeout: 90_000,
    },
  );
  if (res.error) throw new Error(`prisma migrate diff could not run: ${res.error.message}`);
  if (res.status === null)
    throw new Error(`prisma migrate diff was killed (${res.signal})\n${res.stderr}`);
  return { status: res.status, stdout: res.stdout, stderr: res.stderr };
}

/** Real `prisma migrate resolve --rolled-back <name>` (the runbook step after a failed deploy). */
export function migrateResolveRolledBack(
  schemaPath: string,
  url: string,
  name: string,
): CommandResult {
  const res = spawnSync(
    PRISMA_BIN,
    ["migrate", "resolve", "--rolled-back", name, "--schema", schemaPath],
    {
      cwd: join(schemaPath, ".."),
      env: { ...process.env, DATABASE_URL: url, PRISMA_HIDE_UPDATE_MESSAGE: "1" },
      encoding: "utf8",
      timeout: 90_000,
    },
  );
  if (res.error) throw new Error(`prisma migrate resolve could not run: ${res.error.message}`);
  if (res.status === null)
    throw new Error(`prisma migrate resolve was killed (${res.signal})\n${res.stderr}`);
  return { status: res.status, stdout: res.stdout, stderr: res.stderr };
}

// ── scratch databases ─────────────────────────────────────────────────────────

export interface ScratchDatabase {
  readonly name: string;
  readonly url: string;
  drop(): Promise<void>;
}

function withDatabase(baseUrl: string, dbName: string): string {
  const u = new URL(baseUrl);
  u.pathname = `/${dbName}`;
  return u.toString();
}

async function onAdmin<T>(url: string, fn: (c: PrismaClient) => Promise<T>): Promise<T> {
  const c = new PrismaClient({ datasources: { db: { url } } });
  try {
    return await fn(c);
  } finally {
    await c.$disconnect();
  }
}

/** Empty database on the same server as `baseUrl`. Needs CREATEDB (the CI/local role is the superuser). */
export async function createScratchDatabase(baseUrl: string): Promise<ScratchDatabase> {
  const name = `migharness_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  await onAdmin(baseUrl, (c) => c.$executeRawUnsafe(`CREATE DATABASE "${name}"`));
  return {
    name,
    url: withDatabase(baseUrl, name),
    drop: async () => {
      await onAdmin(baseUrl, (c) =>
        c.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`),
      );
    },
  };
}

export interface AppliedMigration {
  readonly name: string;
  /** true = applied successfully (finished, not rolled back). */
  readonly finished: boolean;
}

export async function appliedMigrations(url: string): Promise<AppliedMigration[]> {
  const rows = await onAdmin(url, (c) =>
    c.$queryRawUnsafe<
      Array<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }>
    >(
      `SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY migration_name`,
    ),
  );
  return rows.map((r) => ({
    name: r.migration_name,
    finished: r.finished_at !== null && r.rolled_back_at === null,
  }));
}

// ── F-002-shaped seed (raw SQL: the schema at the baseline, not today's client) ─

/**
 * F-002 system-role snapshot, frozen on purpose: F-003 changes the live
 * blueprint (Admin gains `manage_roles`), but a pre-F-003 shop looks like THIS.
 * Copied from core-domain SYSTEM_ROLE_BLUEPRINT at the F-002 baseline.
 */
const F002_ROLES = [
  { key: "owner", name: "Owner", isSystem: true, caps: ["full_access"] },
  {
    key: "admin",
    name: "Admin",
    isSystem: false,
    caps: [
      "manage_members",
      "manage_org_settings",
      "manage_products",
      "manage_stock",
      "manage_channels",
      "manage_orders",
      "view_financials",
    ],
  },
  {
    key: "staff",
    name: "Staff",
    isSystem: false,
    caps: ["manage_products", "manage_stock", "manage_orders"],
  },
] as const;

export type SeedMembershipStatus = "active" | "invited" | "revoked";

/**
 * One shop as F-002 provisioning leaves it (Owner/Admin/Staff roles + one member
 * each; Admin and Staff active). `ownerStatus` ≠ 'active' ⇒ active Owner = 0.
 * Returns the organization id.
 */
export async function seedF002Org(
  url: string,
  opts: { tag: string; ownerStatus: SeedMembershipStatus },
): Promise<string> {
  const id = `${opts.tag}-${Math.random().toString(36).slice(2, 10)}`;
  const org = `org-${id}`;
  await onAdmin(url, (c) =>
    c.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `INSERT INTO "Organization"(id, name, "updatedAt") VALUES ($1, $2, now())`,
        org,
        `shop ${id}`,
      );
      for (const r of F002_ROLES) {
        const roleId = `role-${r.key}-${id}`;
        const userId = `user-${r.key}-${id}`;
        const status: SeedMembershipStatus = r.key === "owner" ? opts.ownerStatus : "active";
        await tx.$executeRawUnsafe(
          `INSERT INTO "Role"(id, "organizationId", name, "isSystem", capabilities, key, "updatedAt")
           VALUES ($1, $2, $3, $4, $5::text[], $6, now())`,
          roleId,
          org,
          r.name,
          r.isSystem,
          [...r.caps],
          r.key,
        );
        await tx.$executeRawUnsafe(
          `INSERT INTO "User"(id, email, "passwordHash", "updatedAt") VALUES ($1, $2, 'x', now())`,
          userId,
          `${userId}@migharness.test`,
        );
        await tx.$executeRawUnsafe(
          `INSERT INTO "Membership"(id, "organizationId", "userId", "roleId", status, "activatedAt", "revokedAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5::"MembershipStatus",
                   CASE WHEN $5 = 'invited' THEN NULL ELSE now() END,
                   CASE WHEN $5 = 'revoked' THEN now() ELSE NULL END, now())`,
          `mem-${r.key}-${id}`,
          org,
          userId,
          roleId,
          status,
        );
      }
    }),
  );
  return org;
}

// ── NOTICE / WARNING capture (M3-04) ──────────────────────────────────────────

export interface SqlRunResult extends CommandResult {
  /** `RAISE NOTICE` texts, in emission order. */
  readonly notices: string[];
  readonly warnings: string[];
  readonly errors: string[];
}

const PSQL_BIN = process.env.PSQL ?? "psql";

/** libpq rejects Prisma-only URL params (`schema`, `connection_limit`, …) — keep only what libpq knows. */
function libpqUrl(url: string): string {
  const u = new URL(url);
  const keep = new URLSearchParams();
  for (const k of ["sslmode", "sslrootcert", "sslcert", "sslkey"]) {
    const v = u.searchParams.get(k);
    if (v !== null) keep.set(k, v);
  }
  u.search = keep.toString();
  return u.toString();
}

const MESSAGE_LINE = /^(?:psql:[^\n]*?:\d+: )?(NOTICE|WARNING|ERROR):\s+(.*)$/;

/**
 * Runs `sql` in ONE psql session (ON_ERROR_STOP) and returns every server
 * NOTICE/WARNING/ERROR text. psql missing ⇒ throws (never an empty list).
 * Wrap `sql` in BEGIN/COMMIT yourself if it must be one transaction.
 */
export function runSqlCapturingNotices(url: string, sql: string): SqlRunResult {
  const res = spawnSync(
    PSQL_BIN,
    ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", libpqUrl(url), "-f", "-"],
    {
      input: sql,
      env: { ...process.env, PGOPTIONS: "-c client_min_messages=notice" },
      encoding: "utf8",
      timeout: 60_000,
    },
  );
  if (res.error) {
    throw new Error(
      `psql could not run (${res.error.message}) — install the PostgreSQL client or set PSQL=<path>`,
    );
  }
  if (res.status === null) throw new Error(`psql was killed (${res.signal})\n${res.stderr}`);
  const notices: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  for (const line of res.stderr.split(/\r?\n/)) {
    const m = MESSAGE_LINE.exec(line);
    if (!m) continue;
    (m[1] === "NOTICE" ? notices : m[1] === "WARNING" ? warnings : errors).push(m[2]);
  }
  return { status: res.status, stdout: res.stdout, stderr: res.stderr, notices, warnings, errors };
}
