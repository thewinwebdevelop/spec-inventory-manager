/**
 * Unit tests for the pure withTimeout helper (D-014 — first api unit test,
 * proves the test wiring runs real tests without a DB/Nest bootstrap).
 * The AC15 behavior (health probe bounded by this helper) was verified live;
 * this pins the helper's contract so a refactor can't silently unbound it.
 */
import { describe, expect, it } from "vitest";
import { HealthService, withTimeout } from "./health.service";
import type { PrismaService } from "../prisma/prisma.service";

describe("withTimeout", () => {
  it("resolves with the value when the promise settles before the deadline", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 100)).resolves.toBe("ok");
  });

  it("rejects with a timeout error when the promise is slower than the deadline", async () => {
    const slow = new Promise((resolve) => setTimeout(() => resolve("late"), 100));
    await expect(withTimeout(slow, 10)).rejects.toThrow(/timed out after 10ms/);
  });

  it("propagates the original rejection (does not mask real errors as timeouts)", async () => {
    const failing = Promise.reject(new Error("redis down"));
    await expect(withTimeout(failing, 100)).rejects.toThrow("redis down");
  });
});

/**
 * Unit tests for HealthService.check() — the aggregation logic (AC3/AC15).
 * D-014 backfill: the pure `withTimeout` helper already had coverage; this
 * fills the gap on "how db/redis probe results combine into overall status".
 * HealthService takes its three deps via plain constructor injection (no
 * Nest test harness needed), so we instantiate it directly with fakes.
 */
type FakePrisma = Pick<PrismaService, "ping">;
interface FakeRedis {
  ping: () => Promise<string>;
}
interface FakeQueue {
  getJobCounts: () => Promise<Record<string, number>>;
}

function makeService(prisma: FakePrisma, redis: FakeRedis, queue: FakeQueue): HealthService {
  // Cast through `unknown` — these fakes intentionally only implement the
  // single method each dependency is actually used for (ping / getJobCounts),
  // not the full PrismaService/Redis/Queue surface.
  return new HealthService(
    prisma as unknown as ConstructorParameters<typeof HealthService>[0],
    redis as unknown as ConstructorParameters<typeof HealthService>[1],
    queue as unknown as ConstructorParameters<typeof HealthService>[2],
  );
}

describe("HealthService.check", () => {
  it("all deps healthy -> status ok, checks.db ok, checks.redis ok", async () => {
    const service = makeService(
      { ping: async () => true },
      { ping: async () => "PONG" },
      { getJobCounts: async () => ({ active: 0 }) },
    );

    await expect(service.check()).resolves.toEqual({
      status: "ok",
      checks: { db: "ok", redis: "ok" },
    });
  });

  it("redis ping rejects -> status degraded, checks.redis fail, checks.db ok", async () => {
    const service = makeService(
      { ping: async () => true },
      { ping: async () => Promise.reject(new Error("redis down")) },
      { getJobCounts: async () => ({ active: 0 }) },
    );

    await expect(service.check()).resolves.toEqual({
      status: "degraded",
      checks: { db: "ok", redis: "fail" },
    });
  });

  it("db ping rejects -> status degraded, checks.db fail", async () => {
    const service = makeService(
      { ping: async () => Promise.reject(new Error("connection refused")) },
      { ping: async () => "PONG" },
      { getJobCounts: async () => ({ active: 0 }) },
    );

    const result = await service.check();
    expect(result.status).toBe("degraded");
    expect(result.checks.db).toBe("fail");
  });

  it("a hung dependency is bounded by the timeout and reported as fail", async () => {
    const hang = new Promise<never>(() => {
      /* never resolves/rejects — simulates a dropped connection */
    });
    const service = makeService(
      { ping: () => hang },
      { ping: async () => "PONG" },
      { getJobCounts: async () => ({ active: 0 }) },
    );

    const result = await service.check();
    expect(result.status).toBe("degraded");
    expect(result.checks.db).toBe("fail");
    expect(result.checks.redis).toBe("ok");
  }, 3000);

  it("queue.getJobCounts rejects -> redis check fails (per implementation, even though PING succeeded)", async () => {
    const service = makeService(
      { ping: async () => true },
      { ping: async () => "PONG" },
      { getJobCounts: async () => Promise.reject(new Error("queue unreachable")) },
    );

    const result = await service.check();
    expect(result.status).toBe("degraded");
    expect(result.checks.redis).toBe("fail");
    expect(result.checks.db).toBe("ok");
  });
});
