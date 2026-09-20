// F-002 · T-002-09 ★ — U-API-07 (test-plan §5): `adminResetPassword` is
// fail-closed on TWO conditions and does all of it in ONE transaction.
//
//   (ก) target active in this org only, not an Owner   → still succeeds
//   (ข) C-2  · target active in another org too        → 404, no write
//   (ค) target's other membership is revoked           → succeeds
//   (ง) caller lacks manage_members                    → 404 (as F-001)
//   (จ) case (ข) emits `…blocked_multi_org`
//   (ฉ) NEW-1 · target is Owner, caller has manage_members only
//                                                      → 404, no write,
//                                                        emits `…blocked_owner_target`
//   (ช) NEW-1 control · target is Owner, caller has full_access → succeeds
//   (ซ) a blocked reset must NOT revoke sessions or clear the login backoff
//        (otherwise a 404 still lets an Admin kick the Owner off every device)
//
//   cross-cutting (1) every read goes through the SAME `tx`, and
//       `SELECT … FOR UPDATE` on the target `User` is the FIRST statement
//   cross-cutting (2) the facts are re-read AFTER the write and re-decided
//       before commit; if they changed ⇒ rollback + 404 (NEW-5ก)
//   cross-cutting (3) neither blocked event carries a password or a hash
//   cross-cutting (4) all four refusals produce a BYTE-IDENTICAL 404
//
// The fake Prisma below is deliberately shaped so that BOTH the root client and
// the transaction client expose the delegates: the previous implementation read
// from the root client, so it runs here and fails on the assertions that matter
// (fail-closed, no write, events) rather than on a TypeError — the red is about
// the security condition, not about the mock.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { HttpException } from "@nestjs/common";
import {
  CAPABILITY_FULL_ACCESS,
  CAPABILITY_MANAGE_MEMBERS,
  type MembershipStatus,
} from "@omnistock/core-domain";
import { AuthService } from "./auth.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { HashingService } from "./hashing.service";
import type { RefreshTokenService } from "./refresh-token.service";
import type { AccessTokenService } from "./access-token.service";
import type { ThrottleService } from "./throttle.service";
import { OrgBusyError } from "@omnistock/db";
import { SecurityEventsService, collectSecurityEvents } from "./security-events.service";

const ORG = "org_caller";
const CALLER = "user_caller";
const TARGET = "user_target";
const TARGET_EMAIL = "Target.Person@Example.CO";
const NEW_PW = "correct-horse-battery-staple-9f3aK!";
const NEW_HASH = "$argon2id$v=19$fake$newhash";

interface MembershipFixture {
  status: MembershipStatus | null;
  capabilities: string[];
}

interface Scenario {
  caller?: MembershipFixture;
  target?: MembershipFixture;
  /** One entry per `count()` call: [before the write, after the write]. */
  otherOrgActiveCounts?: number[];
  targetUserRow?: boolean;
}

function buildHarness(scenario: Scenario = {}) {
  const caller = scenario.caller ?? { status: "active", capabilities: [CAPABILITY_MANAGE_MEMBERS] };
  const target = scenario.target ?? { status: "active", capabilities: ["manage_products"] };
  const counts = [...(scenario.otherOrgActiveCounts ?? [0, 0])];
  const targetUserRow = scenario.targetUserRow ?? true;

  /** Ordered log of every DB call, tagged with the client it was made on. */
  const calls: string[] = [];

  function delegates(label: "root" | "tx") {
    return {
      membership: {
        findUnique: vi.fn(async (args: { where: { organizationId_userId: { organizationId: string; userId: string } } }) => {
          const { organizationId, userId } = args.where.organizationId_userId;
          calls.push(`${label}:membership.findUnique(${organizationId},${userId})`);
          const fixture = userId === CALLER ? caller : userId === TARGET ? target : { status: null, capabilities: [] };
          if (fixture.status === null) return null;
          return { status: fixture.status, role: { capabilities: fixture.capabilities } };
        }),
        count: vi.fn(async (args: { where: Record<string, unknown> }) => {
          calls.push(`${label}:membership.count(${JSON.stringify(args.where)})`);
          return counts.length > 1 ? (counts.shift() as number) : (counts[0] ?? 0);
        }),
      },
      user: {
        update: vi.fn(async () => {
          calls.push(`${label}:user.update`);
          return { email: TARGET_EMAIL };
        }),
      },
    };
  }

  const tx = {
    ...delegates("tx"),
    $executeRawUnsafe: vi.fn(async (sql: string) => {
      calls.push(`tx:$executeRawUnsafe(${sql})`);
      return 0;
    }),
    $queryRawUnsafe: vi.fn(async (sql: string, ...params: unknown[]) => {
      calls.push(`tx:$queryRawUnsafe(${sql}|${params.join(",")})`);
      return targetUserRow ? [{ id: TARGET, email: TARGET_EMAIL }] : [];
    }),
  };

  const state = { committed: false, rolledBack: false, txOptions: undefined as unknown };
  const client = {
    ...delegates("root"),
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>, options?: unknown) => {
      state.txOptions = options;
      try {
        const result = await fn(tx);
        state.committed = true;
        return result;
      } catch (err) {
        state.rolledBack = true;
        throw err;
      }
    }),
  };

  const hashing = { hash: vi.fn(async () => NEW_HASH) };
  const refresh = { revokeAllForUser: vi.fn(async () => undefined) };
  const throttle = { clearAccount: vi.fn(async () => undefined) };
  const events = new SecurityEventsService();
  const sink = collectSecurityEvents(events);

  const service = new AuthService(
    { client } as unknown as PrismaService,
    hashing as unknown as HashingService,
    refresh as unknown as RefreshTokenService,
    {} as AccessTokenService,
    events,
    throttle as unknown as ThrottleService,
  );

  return { service, client, tx, calls, state, hashing, refresh, throttle, sink };
}

type Harness = ReturnType<typeof buildHarness>;

/** Run the endpoint and return the thrown error (or null on success). */
async function run(h: Harness): Promise<unknown> {
  try {
    await h.service.adminResetPassword(CALLER, ORG, TARGET, NEW_PW);
    return null;
  } catch (err) {
    return err;
  }
}

function expect404(err: unknown): HttpException {
  expect(err).toBeInstanceOf(HttpException);
  const http = err as HttpException;
  expect(http.getStatus()).toBe(404);
  return http;
}

/** Nothing at all happened to the target's account. */
function expectNoEffect(h: Harness): void {
  expect(h.tx.user.update).not.toHaveBeenCalled();
  expect(h.client.user.update).not.toHaveBeenCalled();
  // (ซ) — a blocked call must not touch sessions or the backoff counter.
  expect(h.refresh.revokeAllForUser).not.toHaveBeenCalled();
  expect(h.throttle.clearAccount).not.toHaveBeenCalled();
}

/**
 * M-2 — every TARGET fact and the write run on the transaction.
 *
 * Exactly ONE read is allowed on the root client: the caller pre-check that
 * gates the argon2 hash before the transaction opens (security review of
 * f66451f, Medium-3 — hashing inside the tx held a `FOR UPDATE` lock for the
 * duration of a 19 MiB argon2 on a shared threadpool). It is an optimisation,
 * never the authority: the caller is re-read inside the tx and re-decided
 * after the write.
 *
 * Asserting the exact call list — not just "≤ 1 root call" — is the point. A
 * second root read creeping in is precisely how a decision starts being made
 * on data from before the lock.
 */
function expectDecisionRanOnTheTransaction(h: Harness): void {
  expect(h.client.membership.count).not.toHaveBeenCalled();
  expect(h.client.user.update).not.toHaveBeenCalled();
  expect(h.calls.filter((c) => c.startsWith("root:"))).toEqual([
    `root:membership.findUnique(${ORG},${CALLER})`,
  ]);
}

describe("U-API-07 · adminResetPassword — fail-closed × 2 conditions, one transaction", () => {
  let h: Harness;
  beforeEach(() => {
    h = buildHarness();
  });

  it("(ก) target active only here and not an Owner → succeeds (F-001 behaviour survives)", async () => {
    expect(await run(h)).toBeNull();
    expect(h.tx.user.update).toHaveBeenCalledWith({
      where: { id: TARGET },
      data: { passwordHash: NEW_HASH },
    });
    expect(h.refresh.revokeAllForUser).toHaveBeenCalledWith(TARGET);
    // Backoff cleared on the NORMALIZED email (throttle:acct:{emailNorm}).
    expect(h.throttle.clearAccount).toHaveBeenCalledWith(TARGET_EMAIL.toLowerCase());
    expect(h.sink.types()).toEqual(["auth.password.admin_reset"]);
    expect(h.state.committed).toBe(true);
    expectDecisionRanOnTheTransaction(h);
  });

  it("(ข)+(จ) C-2 · target is active in another org → 404, NO write, emits blocked_multi_org", async () => {
    h = buildHarness({ otherOrgActiveCounts: [1, 1] });
    expect404(await run(h));
    expectNoEffect(h);
    expect(h.sink.types()).toEqual(["auth.password.admin_reset_blocked_multi_org"]);
    expect(h.sink.ofType("auth.password.admin_reset_blocked_multi_org")[0].payload).toEqual({
      actorUserId: CALLER,
      orgId: ORG,
      targetUserId: TARGET,
    });
    expect(h.state.rolledBack).toBe(true);
    expectDecisionRanOnTheTransaction(h);
  });

  it("(ค) target's OTHER membership is not active (revoked/invited) → still succeeds", async () => {
    // `count` filters on status:'active', so a revoked row elsewhere is a 0.
    h = buildHarness({ otherOrgActiveCounts: [0, 0] });
    expect(await run(h)).toBeNull();
    expect(h.tx.user.update).toHaveBeenCalledTimes(1);
    const countArgs = h.tx.membership.count.mock.calls[0][0];
    expect(countArgs.where).toEqual({
      userId: TARGET,
      status: "active",
      organizationId: { not: ORG },
    });
  });

  it("(ง) caller lacks manage_members → 404 as before, and NO event is emitted", async () => {
    h = buildHarness({
      caller: { status: "active", capabilities: ["manage_products"] },
      target: { status: "active", capabilities: [CAPABILITY_FULL_ACCESS] },
      otherOrgActiveCounts: [5, 5],
    });
    expect404(await run(h));
    expectNoEffect(h);
    // Anyone with a token could otherwise spray "someone attacked the Owner"
    // alerts into an org they have nothing to do with.
    expect(h.sink.types()).toEqual([]);
  });

  it("target is not an ACTIVE member of this org → 404, no write (F-001 H-2)", async () => {
    for (const status of ["revoked", "invited", null] as const) {
      h = buildHarness({ target: { status, capabilities: [] } });
      expect404(await run(h));
      expectNoEffect(h);
      expect(h.sink.types()).toEqual([]);
    }
  });

  it("(ฉ) NEW-1 · target is an Owner, caller has manage_members only → 404, NO write, blocked_owner_target", async () => {
    h = buildHarness({ target: { status: "active", capabilities: [CAPABILITY_FULL_ACCESS] } });
    expect404(await run(h));
    expectNoEffect(h);
    expect(h.sink.types()).toEqual(["auth.password.admin_reset_blocked_owner_target"]);
    expect(h.sink.ofType("auth.password.admin_reset_blocked_owner_target")[0].payload).toEqual({
      actorUserId: CALLER,
      orgId: ORG,
      targetUserId: TARGET,
    });
    expect(h.state.rolledBack).toBe(true);
  });

  it("(ช) NEW-1 control · Owner resets another Owner → succeeds (the endpoint is not just broken)", async () => {
    h = buildHarness({
      caller: { status: "active", capabilities: [CAPABILITY_FULL_ACCESS] },
      target: { status: "active", capabilities: [CAPABILITY_FULL_ACCESS] },
    });
    expect(await run(h)).toBeNull();
    expect(h.tx.user.update).toHaveBeenCalledTimes(1);
    expect(h.sink.types()).toEqual(["auth.password.admin_reset"]);
  });

  it("(1) NEW-5ก · SELECT … FOR UPDATE is the first statement IN the tx, and every target fact is on `tx`", async () => {
    await run(h);
    // The caller pre-check is the only thing allowed to precede the lock — it
    // reads nothing about the target, so it cannot make a stale decision.
    expect(h.calls[0]).toBe(`root:membership.findUnique(${ORG},${CALLER})`);
    expect(h.calls[1]).toMatch(/^tx:\$executeRawUnsafe\(SET LOCAL lock_timeout = '\d+ms'\)$/);
    expect(h.calls[2]).toBe(`tx:$queryRawUnsafe(SELECT id, email FROM "User" WHERE id = $1 FOR UPDATE|${TARGET})`);
    // Nothing about the TARGET was read or written before the lock was taken.
    expect(h.calls.slice(3).every((c) => c.startsWith("tx:"))).toBe(true);
    expectDecisionRanOnTheTransaction(h);
    // …and the transaction is bounded (a $transaction with no timeout/maxWait
    // queues on the shared pool forever).
    expect(h.state.txOptions).toEqual({ timeout: expect.any(Number), maxWait: expect.any(Number) });
  });

  it("(1b) the User row could not be locked (no such user) → 404, no write", async () => {
    h = buildHarness({ targetUserRow: false });
    expect404(await run(h));
    expectNoEffect(h);
  });

  it("(2) NEW-5ก TOCTOU · a membership in another org appears AFTER the write → rollback + 404", async () => {
    // count() answers 0 first (decision: allowed) and 1 on the re-read.
    h = buildHarness({ otherOrgActiveCounts: [0, 1] });
    expect404(await run(h));
    // The write DID happen inside the transaction…
    expect(h.tx.user.update).toHaveBeenCalledTimes(1);
    // …and the transaction was rolled back, so it never became durable.
    expect(h.state.rolledBack).toBe(true);
    expect(h.state.committed).toBe(false);
    // The rolled-back path must not revoke sessions / clear the backoff either.
    expect(h.refresh.revokeAllForUser).not.toHaveBeenCalled();
    expect(h.throttle.clearAccount).not.toHaveBeenCalled();
    expect(h.sink.types()).toEqual(["auth.password.admin_reset_blocked_multi_org"]);
    // Both reads happened: two count()s, four findUnique()s (2 per decision).
    expect(h.tx.membership.count).toHaveBeenCalledTimes(2);
    expect(h.tx.membership.findUnique).toHaveBeenCalledTimes(4);
  });

  it("(2b) the target BECOMES an Owner after the write → rollback + 404 + blocked_owner_target", async () => {
    h = buildHarness();
    // Flip the target's role between the two decisions.
    let seen = 0;
    h.tx.membership.findUnique.mockImplementation(async (args: {
      where: { organizationId_userId: { userId: string } };
    }) => {
      const { userId } = args.where.organizationId_userId;
      if (userId === CALLER) {
        return { status: "active", role: { capabilities: [CAPABILITY_MANAGE_MEMBERS] } };
      }
      seen += 1;
      return {
        status: "active",
        role: { capabilities: seen > 1 ? [CAPABILITY_FULL_ACCESS] : ["manage_products"] },
      };
    });
    expect404(await run(h));
    expect(h.state.rolledBack).toBe(true);
    expect(h.sink.types()).toEqual(["auth.password.admin_reset_blocked_owner_target"]);
  });

  it("(3) neither blocked event carries a password or a hash — anywhere in the payload", async () => {
    for (const scenario of [
      { otherOrgActiveCounts: [1, 1] },
      { target: { status: "active" as const, capabilities: [CAPABILITY_FULL_ACCESS] } },
    ]) {
      h = buildHarness(scenario);
      await run(h);
      const blocked = h.sink.events.filter((e) => e.type.startsWith("auth.password.admin_reset_blocked"));
      expect(blocked.length).toBe(1);
      const serialized = JSON.stringify(blocked[0].payload);
      expect(serialized).not.toContain(NEW_PW);
      expect(serialized).not.toContain(NEW_HASH);
      expect(Object.keys(blocked[0].payload).sort()).toEqual(["actorUserId", "orgId", "targetUserId"]);
    }
  });

  it("(4) every refusal returns a BYTE-IDENTICAL 404 — no oracle for 'is this person the Owner?'", async () => {
    const scenarios: Array<[string, Scenario]> = [
      ["caller not a member", { caller: { status: null, capabilities: [] } }],
      ["caller without manage_members", { caller: { status: "active", capabilities: ["manage_products"] } }],
      ["target not a member", { target: { status: null, capabilities: [] } }],
      ["target revoked here", { target: { status: "revoked", capabilities: [] } }],
      ["target user row missing", { targetUserRow: false }],
      ["C-2 target active elsewhere", { otherOrgActiveCounts: [1, 1] }],
      ["NEW-1 target is an Owner", { target: { status: "active", capabilities: [CAPABILITY_FULL_ACCESS] } }],
      ["NEW-5ก concurrent membership", { otherOrgActiveCounts: [0, 1] }],
    ];
    const bodies: string[] = [];
    for (const [, scenario] of scenarios) {
      const harness = buildHarness(scenario);
      const err = expect404(await run(harness));
      bodies.push(JSON.stringify(err.getResponse()));
    }
    for (const body of bodies) {
      expect(body).toBe(bodies[0]);
    }
    // …and it is the ordinary NOT_FOUND envelope, not a special one.
    expect(JSON.parse(bodies[0]).error.code).toBe("NOT_FOUND");
  });

  it("a weak password is 422 for EVERY target — the 422 must not classify the target", async () => {
    // REVERSED deliberately (security review of f66451f, Medium-1). The policy
    // check used to run after the decision, which made the 422 an oracle: send
    // "short" and a 422 meant "this target was allowed", a 404 meant "this
    // target is an Owner or belongs to another org". The uniform 404 exists to
    // refuse exactly that question, and the caller got it answered for free —
    // without touching the password, and with no event emitted on the 422 side.
    //
    // Now the policy runs first, so the 422 depends ONLY on the password the
    // caller typed. Nothing about the target leaks, and nothing is lost: the
    // policy is already public through signup.
    const scenarios: Array<[string, Harness]> = [
      ["plain member (would have been allowed)", buildHarness()],
      ["Owner target — NEW-1 would refuse", buildHarness({
        target: { status: "active", capabilities: [CAPABILITY_FULL_ACCESS] },
      })],
      ["multi-org target — C-2 would refuse", buildHarness({ otherOrgActiveCounts: [1, 1] })],
      ["caller lacks manage_members", buildHarness({
        caller: { status: "active", capabilities: ["manage_products"] },
      })],
    ];

    for (const [label, harness] of scenarios) {
      let thrown: unknown;
      try {
        await harness.service.adminResetPassword(CALLER, ORG, TARGET, "short");
      } catch (err) {
        thrown = err;
      }
      expect((thrown as HttpException).getStatus(), label).toBe(422);
      // …and no target fact was ever read, so there was nothing to leak.
      expect(harness.client.membership.count, label).not.toHaveBeenCalled();
      expect(harness.tx.membership.count, label).not.toHaveBeenCalled();
      expect(harness.hashing.hash, label).not.toHaveBeenCalled();
    }
    // No transaction was ever opened for any of them — the policy check is
    // pure and happens before we reach for the database at all.
    for (const [label, harness] of scenarios) {
      expect(harness.tx.user.update, label).not.toHaveBeenCalled();
      expect(harness.client.$transaction, label).not.toHaveBeenCalled();
    }
  });

  // ── High-2 + §15 row 6b (user decisions 2026-08-03) ──────────────────────

  it("self-reset (caller === target) → the same 404, no write, no session revoke", async () => {
    // A stolen ACCESS token must not become a permanent account takeover:
    // admin-reset asks for no current password, and `revokeAllForUser` would
    // throw the real owner off every device on the way out.
    const h2 = buildHarness();
    let thrown: unknown;
    try {
      await h2.service.adminResetPassword(CALLER, ORG, CALLER, NEW_PW);
    } catch (err) {
      thrown = err;
    }
    expect404(thrown);
    expect(h2.tx.user.update).not.toHaveBeenCalled();
    expect(h2.refresh.revokeAllForUser).not.toHaveBeenCalled();
    expect(h2.state.rolledBack).toBe(true);
  });

  it("§15 row 6b · lock contention → 409 busy, NOT 500", async () => {
    // `SET LOCAL lock_timeout` firing is the database telling us to back off.
    // Unmapped it was a 500: on-call paged for ordinary contention, and a
    // status that stands out against this endpoint's otherwise uniform 404.
    const busy = buildHarness();
    const lockTimeout = Object.assign(new Error("lock timeout"), { code: "55P03" });
    busy.tx.$queryRawUnsafe.mockRejectedValueOnce(lockTimeout);

    let thrown: unknown;
    try {
      await busy.service.adminResetPassword(CALLER, ORG, TARGET, NEW_PW);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(OrgBusyError);
    const busyErr = thrown as OrgBusyError;
    expect(busyErr.httpStatus).toBe(409);
    expect(busyErr.details).toEqual({ reason: "busy" });
    // Nothing was written, and the caller is told to retry rather than told
    // "not found" — contention is not an authorization answer.
    expect(busy.tx.user.update).not.toHaveBeenCalled();
  });

  it("a NON-contention error is rethrown untouched (the mapper must not swallow bugs)", async () => {
    const broken = buildHarness();
    const bug = new Error("column does not exist");
    broken.tx.$queryRawUnsafe.mockRejectedValueOnce(bug);
    await expect(broken.service.adminResetPassword(CALLER, ORG, TARGET, NEW_PW)).rejects.toBe(bug);
  });
});