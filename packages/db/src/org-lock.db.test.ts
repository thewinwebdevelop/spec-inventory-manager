// F-002 · T-002-03 ★ — DB-BACKED proof of the org anchor (test-plan I-C-13,
// db-layer half). Requires TEST_DATABASE_URL; skipped otherwise, loudly.
//
// WHY THIS FILE EXISTS: org-lock.test.ts proves the MAPPING (which error becomes
// 409/busy) without racing anything — that is the layer that blocks merge. It
// cannot prove the two claims that only Postgres can answer:
//   1. `SET LOCAL lock_timeout` + `FOR UPDATE` really give up after the
//      configured time and really produce `55P03` (not an indefinite wait that
//      dies later as an ambiguous tx timeout);
//   2. the lock is a ROW lock — a different tenant is completely unaffected
//      while one tenant's row is held. That control case is the whole point of
//      §5.2: the risk being managed is a noisy neighbour, not just an error code.
// A third claim is proven here too because it is the reason the anchor exists at
// all: two concurrent read-then-write transactions on the same org do NOT
// interleave (no lost update) — the §5/§5.1 invariant, end to end.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ORG_TX_TIMEOUTS } from "@omnistock/config";
import { PrismaClient } from "../generated/client";
import { OrgBusyError, lockCurrentOrganization, runInOrgLockTransaction, runWithOrgContext } from "./org-lock";

// Same convention as tenancy.db.test.ts (and apps/api's *.int.test.ts): gate on
// TEST_DATABASE_URL only, so "no test database" is an honest skip instead of a
// confusing connection error against a stale DATABASE_URL.
const TEST_DB = process.env.TEST_DATABASE_URL;
const d = TEST_DB ? describe : describe.skip;

if (!TEST_DB) {
  console.warn(
    "[T-002-03] SKIPPING the DB-backed org-lock proof (I-C-13): TEST_DATABASE_URL is not set. " +
      "The lock_timeout → 409/busy behaviour and the 'other tenants are unaffected' claim are NOT verified in this run.",
  );
}

const TAG = `t002-03-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

d("lockCurrentOrganization against a real database (I-C-13)", () => {
  let base: PrismaClient;
  /** A SEPARATE client/pool: the holder must not compete for the app's connections. */
  let holder: PrismaClient;
  let orgA: string;
  let orgB: string;

  const lockTimeoutMs = ORG_TX_TIMEOUTS.lockTimeoutMs;

  beforeAll(async () => {
    base = new PrismaClient({ datasources: { db: { url: TEST_DB } } });
    holder = new PrismaClient({ datasources: { db: { url: TEST_DB } } });
    orgA = (await base.organization.create({ data: { name: `${TAG}-A` } })).id;
    orgB = (await base.organization.create({ data: { name: `${TAG}-B` } })).id;
  });

  afterAll(async () => {
    await base?.organization.deleteMany({ where: { name: { startsWith: TAG } } });
    await base?.$disconnect();
    await holder?.$disconnect();
  });

  /**
   * Holds `SELECT … FOR UPDATE` on `organizationId` in its own connection for
   * the duration of `fn` — the same shape test-plan §19.1(ค) asks for, minus
   * `pg_sleep` (an awaited promise is deterministic: the lock is released when
   * the test says so, not when a sleep happens to end).
   */
  async function withHeldLock<T>(organizationId: string, fn: () => Promise<T>): Promise<T> {
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    let acquired!: () => void;
    const acquiredPromise = new Promise<void>((resolve) => (acquired = resolve));

    const holding = holder.$transaction(
      async (tx) => {
        await tx.$queryRawUnsafe('SELECT id FROM "Organization" WHERE id = $1 FOR UPDATE', organizationId);
        acquired();
        await held;
      },
      { timeout: 30_000, maxWait: 5_000 },
    );

    await acquiredPromise;
    try {
      return await fn();
    } finally {
      release();
      await holding;
    }
  }

  it("gives up on a held row lock and reports it as 409 CONFLICT + busy, within lock_timeout (+ margin)", async () => {
    const before = await base.organization.findUniqueOrThrow({ where: { id: orgA } });

    const started = Date.now();
    const error = await withHeldLock(orgA, () =>
      runWithOrgContext({ organizationId: orgA }, () =>
        runInOrgLockTransaction(
          base,
          async (tx) => tx.organization.update({ where: { id: orgA }, data: { name: `${TAG}-A-MUTATED` } }),
          { operation: "updateMemberRole" },
        ),
      )
        .then(() => null)
        .catch((e: unknown) => e),
    );
    const elapsed = Date.now() - started;

    expect(error).toBeInstanceOf(OrgBusyError);
    const busy = error as OrgBusyError;
    expect(busy.httpStatus).toBe(409);
    expect(busy.errorCode).toBe("CONFLICT");
    expect(busy.details).toEqual({ reason: "busy" });
    expect(busy.reason).toBe("lock_timeout"); // 55P03 — NOT the ambiguous tx timeout
    expect(busy.alert).toBe(false); // ordinary contention, not a policy violation
    expect(busy.operation).toBe("updateMemberRole");

    // it waited (the lock was real) but not longer than the policy allows
    expect(elapsed).toBeGreaterThanOrEqual(lockTimeoutMs * 0.5);
    expect(elapsed).toBeLessThan(lockTimeoutMs + 1_500);

    // (ก) nothing from the database's vocabulary reaches the caller
    const wire = `${busy.message} ${JSON.stringify(busy.details)}`;
    for (const forbidden of ["55P03", "40P01", "40001", "P2028", "P2010", "prisma", "Organization"]) {
      expect(wire.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }

    // (ค) the transaction rolled back whole — not one field was written
    const after = await base.organization.findUniqueOrThrow({ where: { id: orgA } });
    expect(after.name).toBe(before.name);
    expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
  });

  it("(จ) does not leak across tenants: another org's write succeeds normally while the lock is held", async () => {
    const started = Date.now();
    const result = await withHeldLock(orgA, () =>
      runWithOrgContext({ organizationId: orgB }, () =>
        runInOrgLockTransaction(base, async (tx) =>
          tx.organization.update({ where: { id: orgB }, data: { name: `${TAG}-B-OK` } }),
        ),
      ),
    );
    const elapsed = Date.now() - started;

    expect(result.name).toBe(`${TAG}-B-OK`);
    expect(elapsed).toBeLessThan(lockTimeoutMs); // it never queued behind org A
  });

  it("(ฉ) leaves no stuck state: once the lock is released the same org succeeds again", async () => {
    await withHeldLock(orgA, async () => {
      /* held, then released by withHeldLock */
    });

    const result = await runWithOrgContext({ organizationId: orgA }, () =>
      runInOrgLockTransaction(base, async (tx) =>
        tx.organization.update({ where: { id: orgA }, data: { name: `${TAG}-A-AFTER` } }),
      ),
    );
    expect(result.name).toBe(`${TAG}-A-AFTER`);
  });

  it("serializes concurrent read-then-write transactions on the same org (the §5 invariant, no lost update)", async () => {
    await base.organization.update({ where: { id: orgA }, data: { timezone: "0" } });

    // Read-then-write is EXACTLY the shape that loses an update under Read
    // Committed; if the anchor works, the two runs cannot interleave.
    const bump = () =>
      runWithOrgContext({ organizationId: orgA }, () =>
        runInOrgLockTransaction(base, async (tx) => {
          const current = await tx.organization.findUniqueOrThrow({ where: { id: orgA }, select: { timezone: true } });
          await new Promise((r) => setTimeout(r, 50)); // widen the window on purpose
          return tx.organization.update({
            where: { id: orgA },
            data: { timezone: String(Number(current.timezone) + 1) },
          });
        }),
      );

    await Promise.all([bump(), bump()]);

    const final = await base.organization.findUniqueOrThrow({ where: { id: orgA } });
    expect(final.timezone).toBe("2"); // 1 would mean one write was lost

    await base.organization.update({ where: { id: orgA }, data: { timezone: "Asia/Bangkok" } });
  });

  it("refuses to pretend: calling the helper on a full client (outside a tx) throws instead of no-op locking", async () => {
    await expect(
      runWithOrgContext({ organizationId: orgA }, () => lockCurrentOrganization(base)),
    ).rejects.toThrow(/interactive transaction/i);
  });
});
