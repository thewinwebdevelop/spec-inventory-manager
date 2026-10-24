// F-003 · T-003-B11 — `backfill:f003` (data-model §4.2 · architecture §12).
//
// Executes the committed migration `*_f003_backfill_manage_roles/migration.sql`
// — THE one SQL source (G3-10) — in one transaction, and reports how many Admin
// rows it changed. Expected after a rollout: 0 (it is then a check, not a fix;
// devops runbook §3 condition 2). Also hosts the two read-only checks that go
// with it: the rollback-safety count (architecture §12) and "every
// Role.capabilities ⊆ the capability registry" (B03 review: a junk key sitting
// in a row would silently become a real right the day that key is registered).
//
// Why the file goes through `EXECUTE current_setting(...)`: Prisma sends raw SQL
// as ONE prepared statement, which Postgres refuses for a multi-statement
// script. PL/pgSQL EXECUTE runs a multi-statement string (SPI), and passing the
// text through a transaction-local setting means it is a bind parameter — never
// re-quoted, never edited — so what the database runs is the file, byte for
// byte (M3-06 hashes what the DATABASE received). No new dependency (`pg`).
//
// Registry keys are injected (packages/db does not depend on core-domain); the
// CLI in apps/api/scripts/backfill-f003.ts passes CAPABILITY_REGISTRY.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const BACKFILL_F003_SLUG = "f003_backfill_manage_roles";

const MIGRATIONS_DIR = join(__dirname, "..", "prisma", "migrations");
const SQL_SETTING = "omnistock.f003_backfill_sql";
const UPDATED_SETTING = "omnistock.f003_backfill_updated";

/** The minimal client surface used here (a PrismaClient or its tx client). */
export interface RawSqlClient {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
}
export interface TransactionalRawSqlClient extends RawSqlClient {
  $transaction<R>(fn: (tx: RawSqlClient) => Promise<R>, options?: { timeout?: number }): Promise<R>;
}

/** Absolute path of the ONE committed backfill migration; throws unless exactly one exists. */
export function backfillF003MigrationPath(migrationsDir: string = MIGRATIONS_DIR): string {
  const hits = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.endsWith(`_${BACKFILL_F003_SLUG}`))
    .map((e) => e.name);
  if (hits.length !== 1) {
    throw new Error(
      `backfill:f003 expects exactly 1 migration *_${BACKFILL_F003_SLUG} in ${migrationsDir}, found ${hits.length}`,
    );
  }
  return join(migrationsDir, hits[0]!, "migration.sql");
}

/** The migration that retires the bridge trigger (data-model §4.2). */
export const DROP_BRIDGE_SLUG = "f003_drop_admin_bridge";

function retiredBridgeMigrations(migrationsDir: string = MIGRATIONS_DIR): string[] {
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.endsWith(`_${DROP_BRIDGE_SLUG}`))
    .map((e) => e.name);
}

export function readBackfillF003Sql(migrationsDir?: string): string {
  return readFileSync(backfillF003MigrationPath(migrationsDir), "utf8");
}

export interface BackfillF003Result {
  /** Admin rows that gained `manage_roles` in this run. */
  readonly rolesUpdated: number;
  /** sha256 of the text the database executed (read back from the server). */
  readonly executedSha256: string;
}

/**
 * Runs the migration file in ONE transaction. Any error — the Owner ≥ 1
 * RAISE included — rolls everything back and is rethrown untouched.
 */
export async function runBackfillF003(
  client: TransactionalRawSqlClient,
  opts: { readonly migrationsDir?: string } = {},
): Promise<BackfillF003Result> {
  // Security review B11 (Medium): once the bridge is retired, re-running this
  // file would only resurrect a key-reading function G-12 believes is gone.
  const retiredInRepo = retiredBridgeMigrations(opts.migrationsDir);
  if (retiredInRepo.length > 0) {
    throw new Error(
      `backfill:f003 refused: ${retiredInRepo.join(", ")} (${DROP_BRIDGE_SLUG}) exists — ` +
        "the admin bridge is retired; this backfill must not run again",
    );
  }
  const sql = readBackfillF003Sql(opts.migrationsDir);
  return client.$transaction(
    async (tx) => {
      const applied = await tx.$queryRawUnsafe<{ migration_name: string }[]>(
        `SELECT migration_name FROM _prisma_migrations
          WHERE migration_name LIKE $1 AND finished_at IS NOT NULL AND rolled_back_at IS NULL`,
        `%\\_${DROP_BRIDGE_SLUG.replace(/_/g, "\\_")}`,
      );
      if (applied.length > 0) {
        throw new Error(
          `backfill:f003 refused: ${applied.map((m) => m.migration_name).join(", ")} ` +
            `(${DROP_BRIDGE_SLUG}) is applied in this database — the admin bridge is retired; ` +
            "this backfill must not run again",
        );
      }
      await tx.$queryRawUnsafe(`SELECT set_config($1, $2, true)`, SQL_SETTING, sql);
      await tx.$executeRawUnsafe(
        `DO $f003$ BEGIN EXECUTE current_setting('${SQL_SETTING}'); END $f003$`,
      );
      const [row] = await tx.$queryRawUnsafe<{ executed: string; updated: string | null }[]>(
        `SELECT current_setting($1) AS executed, current_setting($2, true) AS updated`,
        SQL_SETTING,
        UPDATED_SETTING,
      );
      const updated = Number(row?.updated);
      if (!row || row.updated === null || row.updated === "" || !Number.isInteger(updated)) {
        throw new Error(
          `backfill:f003: the migration did not report its row count (${UPDATED_SETTING}) — not the expected file?`,
        );
      }
      return {
        rolesUpdated: updated,
        executedSha256: createHash("sha256").update(row.executed, "utf8").digest("hex"),
      };
    },
    { timeout: 60_000 },
  );
}

/** architecture §12 — must be 0 before rolling F-003 code back to F-002. */
// role-read: history — counts deleted rows on purpose (they block a rollback)
export const ROLLBACK_SAFETY_SQL = `SELECT count(*)::int AS n FROM "Role"
 WHERE key IS NULL OR "lastEditedAt" IS NOT NULL OR "deletedAt" IS NOT NULL`;

export async function rollbackSafetyCount(client: RawSqlClient): Promise<number> {
  const [row] = await client.$queryRawUnsafe<{ n: number }[]>(ROLLBACK_SAFETY_SQL);
  return row!.n;
}

export interface RoleOutsideRegistry {
  readonly organizationId: string;
  readonly roleId: string;
  /** Keys this row holds that the registry does not define (sorted). */
  readonly unregistered: string[];
}

/**
 * Every Role row (deleted ones included — they can be read back) holding a
 * capability key the registry does not define. Empty = clean. An empty
 * registry is refused: it would report every row and hide the real signal.
 */
export async function rolesOutsideRegistry(
  client: RawSqlClient,
  registeredKeys: readonly string[],
): Promise<RoleOutsideRegistry[]> {
  if (registeredKeys.length === 0) throw new Error("rolesOutsideRegistry: registry is empty");
  // role-read: history — deleted rows can be read back, so they are checked too
  return client.$queryRawUnsafe<RoleOutsideRegistry[]>(
    `SELECT r."organizationId", r.id AS "roleId",
            array(SELECT u.c FROM (SELECT DISTINCT c FROM unnest(r.capabilities) c
                                    WHERE c <> ALL ($1::text[])) u
                   ORDER BY u.c COLLATE "C") AS unregistered
       FROM "Role" r
      WHERE NOT (r.capabilities <@ $1::text[])
      ORDER BY r."organizationId", r.id`,
    [...registeredKeys],
  );
}

export interface BackfillF003Report extends BackfillF003Result {
  readonly rollbackSafetyCount: number;
  readonly rolesOutsideRegistry: RoleOutsideRegistry[];
}

/** The whole `backfill:f003` run; `ok` = nothing outside the registry (exit code). */
export async function backfillF003Report(
  client: TransactionalRawSqlClient,
  registeredKeys: readonly string[],
): Promise<BackfillF003Report & { ok: boolean }> {
  const result = await runBackfillF003(client);
  const outside = await rolesOutsideRegistry(client, registeredKeys);
  return {
    ...result,
    rollbackSafetyCount: await rollbackSafetyCount(client),
    rolesOutsideRegistry: outside,
    ok: outside.length === 0,
  };
}
