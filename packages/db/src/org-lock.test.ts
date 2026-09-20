// F-002 · T-002-03 ★ — unit proof of the org serialization anchor.
// Spec: architecture.md §5.1 (lock + re-check inside the tx) · §5.2 (timeout
// policy + error mapping) · §12.2 row 6 (ORG_LOCK_REQUIRED_OPERATIONS).
// Test-plan: U-DB-08(ก)(ข)(ค)(ง) · U-API-21 (the mapping half, proven here at
// the db seam so apps/api only has to render it) · U-CFG-07 (read-from-config).
//
// The mapping cases are the ones that BLOCK MERGE (test-plan §19.1 item 6): the
// int test I-C-13 races a real lock and is deliberately not the gate.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ORG_TX_TIMEOUTS } from "@omnistock/config";
import {
  ORG_BUSY_DETAILS,
  ORG_BUSY_ERROR_CODE,
  ORG_BUSY_HTTP_STATUS,
  ORG_LOCK_REQUIRED_OPERATIONS,
  OrgBusyError,
  OrgLockAnchorMissingError,
  OrgLockContextMismatchError,
  OrgLockOutsideTransactionError,
  classifyOrgLockError,
  lockCurrentOrganization,
  runInOrgLockTransaction,
  runWithOrgContext,
  toOrgBusyError,
} from "./org-lock";
import { MissingOrgContextError, OrgScopeViolationError } from "./tenancy";

// ── fakes ──────────────────────────────────────────────────────────────────

interface RecordedCall {
  kind: "execute" | "query";
  sql: string;
  values: unknown[];
}

/** An interactive-transaction client look-alike: no $transaction/$connect/$extends. */
function fakeTx(rows: unknown[] = [{ id: "org_a" }]) {
  const calls: RecordedCall[] = [];
  const tx = {
    $executeRawUnsafe(sql: string, ...values: unknown[]) {
      calls.push({ kind: "execute", sql, values });
      return Promise.resolve(1);
    },
    $queryRawUnsafe(sql: string, ...values: unknown[]) {
      calls.push({ kind: "query", sql, values });
      return Promise.resolve(rows);
    },
  };
  return { tx, calls };
}

/** A full client (has $transaction) — i.e. NOT inside a transaction. */
function fakeClient(rows: unknown[] = [{ id: "org_a" }]) {
  const { tx, calls } = fakeTx(rows);
  const txOptions: unknown[] = [];
  const client = {
    ...tx,
    $connect: () => Promise.resolve(),
    $extends: () => client,
    $transaction<R>(fn: (t: typeof tx) => Promise<R>, options?: unknown): Promise<R> {
      txOptions.push(options);
      return fn(tx);
    },
  };
  return { client, calls, txOptions };
}

const ctxA = { organizationId: "org_a" };

/** Prisma-shaped error (structurally what the real client throws). */
function prismaError(code: string, meta?: Record<string, unknown>, message = `Prisma error ${code}`) {
  const err = new Error(message) as Error & { code: string; meta?: Record<string, unknown>; clientVersion: string };
  err.name = "PrismaClientKnownRequestError";
  err.code = code;
  err.clientVersion = "5.22.0";
  if (meta) err.meta = meta;
  return err;
}

/** The exact error a raw `SELECT … FOR UPDATE` produces on lock timeout (probed
 *  against the real Postgres before this file was written: P2010 + meta.code). */
const rawLockTimeout = () =>
  prismaError(
    "P2010",
    { code: "55P03", message: "ERROR: canceling statement due to lock timeout" },
    "Invalid `prisma.$queryRawUnsafe()` invocation:\nRaw query failed. Code: `55P03`.",
  );
const rawDeadlock = () =>
  prismaError("P2010", { code: "40P01", message: "ERROR: deadlock detected" }, "Raw query failed. Code: `40P01`.");
const rawSerialization = () =>
  prismaError(
    "P2010",
    { code: "40001", message: "ERROR: could not serialize access" },
    "Raw query failed. Code: `40001`.",
  );
const txTimeout = () =>
  prismaError(
    "P2028",
    undefined,
    "Transaction API error: Transaction already closed: A query cannot be executed on an expired transaction.",
  );
const poolTimeout = () =>
  prismaError(
    "P2024",
    { connection_limit: 5, timeout: 2 },
    "Timed out fetching a new connection from the connection pool.",
  );

// ── §12.2 row 6 — the list qa asserts call sites against ────────────────────

describe("ORG_LOCK_REQUIRED_OPERATIONS (architecture §5 · §12.2 row 6)", () => {
  it("holds exactly the 7 operations §5 requires the anchor for", () => {
    expect(ORG_LOCK_REQUIRED_OPERATIONS).toHaveLength(7);
    expect(ORG_LOCK_REQUIRED_OPERATIONS.map((op) => `${op.method} ${op.path}`)).toEqual([
      "PATCH /orgs/{orgId}/members/{userId}",
      "DELETE /orgs/{orgId}/members/{userId}",
      "DELETE /orgs/{orgId}/membership",
      "POST /invitations/accept",
      "POST /orgs/{orgId}/invitations",
      "POST /orgs/{orgId}/invitations/{invitationId}/link",
      "DELETE /orgs/{orgId}/invitations/{invitationId}",
    ]);
  });

  it("is frozen and has a unique key + service method per row", () => {
    expect(Object.isFrozen(ORG_LOCK_REQUIRED_OPERATIONS)).toBe(true);
    expect(() => {
      (ORG_LOCK_REQUIRED_OPERATIONS as unknown as { push: (x: unknown) => void }).push({});
    }).toThrow();
    const keys = ORG_LOCK_REQUIRED_OPERATIONS.map((op) => op.operationKey);
    expect(new Set(keys).size).toBe(keys.length);
    for (const op of ORG_LOCK_REQUIRED_OPERATIONS) {
      expect(op.serviceMethod).toMatch(/^[A-Za-z]+Service\.[a-zA-Z]+$/);
      expect(Object.isFrozen(op)).toBe(true);
    }
  });
});

// ── U-DB-08 — the helper itself ────────────────────────────────────────────

describe("lockCurrentOrganization (U-DB-08)", () => {
  const savedLock = process.env.ORG_LOCK_TIMEOUT_MS;
  afterEach(() => {
    if (savedLock === undefined) delete process.env.ORG_LOCK_TIMEOUT_MS;
    else process.env.ORG_LOCK_TIMEOUT_MS = savedLock;
  });

  it("(ก) locks the Organization row with SELECT id … FOR UPDATE, org bound as a parameter", async () => {
    const { tx, calls } = fakeTx();
    await runWithOrgContext(ctxA, () => lockCurrentOrganization(tx));

    const lock = calls.find((c) => c.kind === "query");
    expect(lock?.sql.replace(/\s+/g, " ").trim()).toBe('SELECT id FROM "Organization" WHERE id = $1 FOR UPDATE');
    expect(lock?.values).toEqual(["org_a"]); // parameterized — never interpolated
  });

  it("(ง) issues SET LOCAL lock_timeout BEFORE the FOR UPDATE, with the value from ORG_TX_TIMEOUTS", async () => {
    process.env.ORG_LOCK_TIMEOUT_MS = "777";
    const { tx, calls } = fakeTx();
    await runWithOrgContext(ctxA, () => lockCurrentOrganization(tx));

    expect(calls.map((c) => c.kind)).toEqual(["execute", "query"]); // order is the point
    expect(calls[0].sql).toBe("SET LOCAL lock_timeout = '777ms'");
    expect(calls[0].sql).toContain(`${ORG_TX_TIMEOUTS.lockTimeoutMs}ms`);
  });

  it("(ง) follows a config change instead of a number baked into this file", async () => {
    process.env.ORG_LOCK_TIMEOUT_MS = "1234";
    const first = fakeTx();
    await runWithOrgContext(ctxA, () => lockCurrentOrganization(first.tx));
    process.env.ORG_LOCK_TIMEOUT_MS = "2345";
    const second = fakeTx();
    await runWithOrgContext(ctxA, () => lockCurrentOrganization(second.tx));

    expect(first.calls[0].sql).toContain("1234ms");
    expect(second.calls[0].sql).toContain("2345ms");
  });

  it("(ข · N-2) takes the org from the ALS context, not from what the caller passes", async () => {
    const { tx, calls } = fakeTx();
    await runWithOrgContext({ organizationId: "org_ctx" }, () => lockCurrentOrganization(tx));
    expect(calls[1].values).toEqual(["org_ctx"]);
  });

  it("(ข · N-2) refuses an explicit ctx that disagrees with the ALS context", async () => {
    const { tx, calls } = fakeTx();
    await expect(
      runWithOrgContext({ organizationId: "org_ctx" }, () =>
        lockCurrentOrganization(tx, { organizationId: "org_other" }),
      ),
    ).rejects.toBeInstanceOf(OrgLockContextMismatchError);
    expect(calls).toHaveLength(0); // nothing was locked
  });

  it("(ข · N-2) refuses a bare organizationId string — the org is never a caller-supplied string", async () => {
    const { tx } = fakeTx();
    await expect(
      runWithOrgContext(ctxA, () => lockCurrentOrganization(tx, "org_a" as unknown as { organizationId: string })),
    ).rejects.toBeInstanceOf(OrgScopeViolationError);
  });

  it("accepts an explicit ctx when no ALS context is established (apps/api owns its own store)", async () => {
    const { tx, calls } = fakeTx([{ id: "org_b" }]);
    await lockCurrentOrganization(tx, { organizationId: "org_b" });
    expect(calls[1].values).toEqual(["org_b"]);
  });

  it("throws MissingOrgContextError when there is no context at all", async () => {
    const { tx, calls } = fakeTx();
    await expect(lockCurrentOrganization(tx)).rejects.toBeInstanceOf(MissingOrgContextError);
    expect(calls).toHaveLength(0);
  });

  it("(ค) throws when called outside an interactive transaction (a full client was passed)", async () => {
    const { client, calls } = fakeClient();
    await expect(runWithOrgContext(ctxA, () => lockCurrentOrganization(client))).rejects.toBeInstanceOf(
      OrgLockOutsideTransactionError,
    );
    expect(calls).toHaveLength(0);
    await expect(runWithOrgContext(ctxA, () => lockCurrentOrganization(client))).rejects.toThrow(
      /interactive transaction/i,
    );
  });

  it("throws when the anchor row does not exist — a lock on nothing protects nothing", async () => {
    const { tx } = fakeTx([]);
    await expect(runWithOrgContext(ctxA, () => lockCurrentOrganization(tx))).rejects.toBeInstanceOf(
      OrgLockAnchorMissingError,
    );
  });
});

// ── U-API-21 — error mapping (the merge-blocking layer) ────────────────────

describe("busy-error mapping (U-API-21 · architecture §5.2)", () => {
  const cases = [
    { name: "55P03 lock_not_available", make: rawLockTimeout, reason: "lock_timeout", alert: false },
    { name: "40P01 deadlock_detected", make: rawDeadlock, reason: "deadlock", alert: true },
    { name: "40001 serialization_failure", make: rawSerialization, reason: "serialization", alert: true },
    { name: "P2028 transaction timeout", make: txTimeout, reason: "tx_timeout", alert: false },
    { name: "P2024 connection-pool timeout (maxWait)", make: poolTimeout, reason: "pool_timeout", alert: false },
  ] as const;

  it.each(cases)("$name → 409 CONFLICT + details.reason=busy", ({ make, reason, alert }) => {
    const busy = toOrgBusyError(make(), "updateMember");
    expect(busy).toBeInstanceOf(OrgBusyError);
    expect(busy?.httpStatus).toBe(409);
    expect(busy?.httpStatus).toBe(ORG_BUSY_HTTP_STATUS);
    expect(busy?.errorCode).toBe(ORG_BUSY_ERROR_CODE);
    expect(busy?.errorCode).toBe("CONFLICT");
    expect(busy?.details).toEqual({ reason: "busy" });
    expect(busy?.details).toBe(ORG_BUSY_DETAILS);
    expect(busy?.reason).toBe(reason);
    expect(busy?.alert).toBe(alert);
    expect(busy?.operation).toBe("updateMember");
    expect(classifyOrgLockError(make())).toBe(reason);
  });

  it.each(cases)("$name leaks no SQLSTATE / Prisma code / table name on the wire", ({ make }) => {
    const busy = toOrgBusyError(make(), "acceptInvitation");
    const wire = JSON.stringify({ message: busy?.message, details: busy?.details, code: busy?.errorCode });
    for (const forbidden of ["55P03", "40P01", "40001", "P2028", "P2024", "P2010", "prisma", "Organization", "Membership", "Invitation"]) {
      expect(wire.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
    // the diagnostics still exist for the server-side log — just not on the wire
    expect(busy?.diagnostic.prismaCode ?? busy?.diagnostic.sqlState).toBeTruthy();
    expect(busy?.cause).toBeDefined();
  });

  it("does NOT swallow other errors (a 409 that is too wide hides every real bug)", () => {
    const others: unknown[] = [
      prismaError("P2002", { target: ["organizationId", "userId"] }, "Unique constraint failed"),
      prismaError("P2025", undefined, "An operation failed because it depends on one or more records"),
      prismaError("P2010", { code: "42703", message: "column does not exist" }, "Raw query failed. Code: `42703`."),
      new OrgScopeViolationError("Membership", "update", "test"),
      new Error("boom"),
      "not an error",
      null,
    ];
    for (const err of others) {
      expect(classifyOrgLockError(err)).toBeNull();
      expect(toOrgBusyError(err, "updateMember")).toBeNull();
    }
  });
});

// ── the tx helper: nobody can forget the timeouts or the anchor ────────────

describe("runInOrgLockTransaction (architecture §5.1/§5.2)", () => {
  beforeEach(() => {
    process.env.ORG_LOCK_TIMEOUT_MS = "900";
    process.env.ORG_TX_TIMEOUT_MS = "4500";
    process.env.ORG_TX_MAX_WAIT_MS = "1500";
  });
  afterEach(() => {
    delete process.env.ORG_LOCK_TIMEOUT_MS;
    delete process.env.ORG_TX_TIMEOUT_MS;
    delete process.env.ORG_TX_MAX_WAIT_MS;
  });

  it("passes { timeout, maxWait } from ORG_TX_TIMEOUTS so no call site can forget them", async () => {
    const { client, txOptions } = fakeClient();
    await runWithOrgContext(ctxA, () => runInOrgLockTransaction(client, async () => "done"));
    expect(txOptions[0]).toMatchObject({ timeout: 4500, maxWait: 1500 });
    expect(txOptions[0]).toMatchObject({
      timeout: ORG_TX_TIMEOUTS.txTimeoutMs,
      maxWait: ORG_TX_TIMEOUTS.maxWaitMs,
    });
  });

  it("takes the anchor as the FIRST statement in the tx, before the caller's work", async () => {
    const { client, calls } = fakeClient();
    const work = vi.fn(async () => {
      calls.push({ kind: "query", sql: "-- caller work --", values: [] });
      return 1;
    });
    await runWithOrgContext(ctxA, () => runInOrgLockTransaction(client, work));

    expect(calls.map((c) => c.sql.slice(0, 24))).toEqual([
      "SET LOCAL lock_timeout =",
      "SELECT id FROM \"Organiza",
      "-- caller work --",
    ]);
    expect(work).toHaveBeenCalledTimes(1);
  });

  it("maps a lock-contention failure to OrgBusyError and never retries it server-side", async () => {
    const { client } = fakeClient();
    const work = vi.fn(async () => {
      throw rawLockTimeout();
    });
    const err = await runWithOrgContext(ctxA, () => runInOrgLockTransaction(client, work, { operation: "leaveOrg" }))
      .then(() => null)
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(OrgBusyError);
    expect((err as OrgBusyError).httpStatus).toBe(409);
    expect((err as OrgBusyError).operation).toBe("leaveOrg");
    expect(work).toHaveBeenCalledTimes(1); // no silent retry (no Idempotency-Key yet — F-011)
  });

  it("rethrows a non-contention failure untouched (fail loud)", async () => {
    const { client } = fakeClient();
    const original = prismaError("P2002", { target: ["organizationId", "email"] }, "Unique constraint failed");
    const err = await runWithOrgContext(ctxA, () =>
      runInOrgLockTransaction(client, async () => {
        throw original;
      }),
    )
      .then(() => null)
      .catch((e: unknown) => e);

    expect(err).toBe(original);
  });

  it("refuses to open the tx without an org context", async () => {
    const { client, txOptions } = fakeClient();
    await expect(runInOrgLockTransaction(client, async () => 1)).rejects.toBeInstanceOf(MissingOrgContextError);
    expect(txOptions).toHaveLength(0);
  });
});
