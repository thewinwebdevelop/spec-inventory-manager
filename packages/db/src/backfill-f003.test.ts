// F-003 · T-003-B11 fix round 1 — backfill:f003 guards that need no database.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  readBackfillF003Sql,
  runBackfillF003,
  type TransactionalRawSqlClient,
} from "./backfill-f003";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function migrationsDir(names: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), "b11-mig-"));
  dirs.push(dir);
  for (const n of names) {
    mkdirSync(join(dir, n));
    writeFileSync(join(dir, n, "migration.sql"), "SELECT 1;");
  }
  return dir;
}

/** A client that fails the test if anything reaches the database. */
const untouchable: TransactionalRawSqlClient = {
  $queryRawUnsafe: () => Promise.reject(new Error("database touched")),
  $executeRawUnsafe: () => Promise.reject(new Error("database touched")),
  $transaction: () => Promise.reject(new Error("database touched")),
};

describe("backfill:f003 refuses once the bridge is retired (security Medium, fix round 1)", () => {
  it("★ a *_f003_drop_admin_bridge migration in the repo ⇒ refuse before touching the database", async () => {
    const dir = migrationsDir([
      "20261024000000_f003_backfill_manage_roles",
      "20270101000000_f003_drop_admin_bridge",
    ]);
    await expect(runBackfillF003(untouchable, { migrationsDir: dir })).rejects.toThrow(
      /f003_drop_admin_bridge/,
    );
  });

  it("control: without it, the run proceeds to the database", async () => {
    const dir = migrationsDir(["20261024000000_f003_backfill_manage_roles"]);
    await expect(runBackfillF003(untouchable, { migrationsDir: dir })).rejects.toThrow(
      "database touched",
    );
  });
});

describe("the committed file's order (security Medium, fix round 1)", () => {
  const sql = readBackfillF003Sql().replace(/--[^\n]*/g, "");

  it("★ the Owner ≥ 1 scan runs BEFORE the bridge DDL; no DROP TRIGGER (ACCESS EXCLUSIVE)", () => {
    const owner = sql.indexOf("f003_owner_invariant_violation org=%");
    const bridge = sql.indexOf("CREATE TRIGGER role_f003_admin_bridge");
    expect(owner).toBeGreaterThan(0);
    expect(bridge).toBeGreaterThan(0);
    expect(owner).toBeLessThan(bridge);
    expect(sql).not.toMatch(/DROP\s+TRIGGER/i);
  });

  it("★ the backfill and the bridge only touch rows no person has edited", () => {
    expect(sql.match(/"lastEditedAt"\s+IS\s+NULL/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });
});
