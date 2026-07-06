import { describe, it, expect } from "vitest";
import type { Redis } from "ioredis";
import { ThrottleService } from "./throttle.service";
import { SecurityEventsService } from "./security-events.service";
import { IP_WINDOW_MAX } from "./auth.constants";

// Throttle logic with a fake Redis. Covers: IP window → 429, account backoff
// curve, clear-on-success, and fail-open (M-7) degraded limiter + fail_open event.

/** Minimal in-memory Redis stand-in for the ops ThrottleService uses. */
class FakeRedis {
  store = new Map<string, number>();
  ttls = new Map<string, number>();
  down = false;
  async incr(key: string): Promise<number> {
    if (this.down) throw new Error("redis down");
    const v = (this.store.get(key) ?? 0) + 1;
    this.store.set(key, v);
    return v;
  }
  async expire(key: string, seconds: number): Promise<number> {
    if (this.down) throw new Error("redis down");
    this.ttls.set(key, seconds);
    return 1;
  }
  async ttl(key: string): Promise<number> {
    if (this.down) throw new Error("redis down");
    return this.ttls.get(key) ?? -1;
  }
  async get(key: string): Promise<string | null> {
    if (this.down) throw new Error("redis down");
    const v = this.store.get(key);
    return v === undefined ? null : String(v);
  }
  async del(key: string): Promise<number> {
    if (this.down) throw new Error("redis down");
    this.store.delete(key);
    return 1;
  }
}

function make(now = () => 1_000_000): { svc: ThrottleService; redis: FakeRedis; events: string[] } {
  const redis = new FakeRedis();
  const events: string[] = [];
  const securityEvents = new SecurityEventsService();
  securityEvents.emitter.on("*", (e: { type: string }) => events.push(e.type));
  const svc = new ThrottleService(redis as unknown as Redis, securityEvents, now);
  return { svc, redis, events };
}

describe("ThrottleService IP window", () => {
  it("allows up to the cap, then returns retryAfter (429)", async () => {
    const { svc } = make();
    for (let i = 0; i < IP_WINDOW_MAX; i++) {
      expect(await svc.checkIp("1.2.3.4")).toBe(0);
    }
    // The (cap+1)th attempt → retryAfter > 0.
    expect(await svc.checkIp("1.2.3.4")).toBeGreaterThan(0);
  });

  it("keys per-IP — a different IP is unaffected", async () => {
    const { svc } = make();
    for (let i = 0; i < IP_WINDOW_MAX + 1; i++) await svc.checkIp("1.1.1.1");
    expect(await svc.checkIp("2.2.2.2")).toBe(0);
  });
});

describe("ThrottleService account backoff", () => {
  it("no backoff below 5 failures, then exponential", async () => {
    const { svc } = make();
    const key = "user@example.com";
    for (let i = 0; i < 4; i++) {
      const r = await svc.recordAccountFailure(key);
      expect(r).toBe(0);
    }
    expect(await svc.recordAccountFailure(key)).toBe(1); // 5th → 1s
    expect(await svc.recordAccountFailure(key)).toBe(2); // 6th → 2s
  });

  it("accountRetryAfter reads the current count", async () => {
    const { svc } = make();
    const key = "acct";
    for (let i = 0; i < 6; i++) await svc.recordAccountFailure(key);
    expect(await svc.accountRetryAfter(key)).toBeGreaterThan(0);
  });

  it("clearAccount resets the counter (self-heal on success)", async () => {
    const { svc } = make();
    const key = "acct";
    for (let i = 0; i < 6; i++) await svc.recordAccountFailure(key);
    await svc.clearAccount(key);
    expect(await svc.accountRetryAfter(key)).toBe(0);
  });
});

describe("ThrottleService fail-open (M-7)", () => {
  it("fails open on Redis-down (allows) but emits auth.throttle.fail_open + degraded limiter still bites", async () => {
    const { svc, redis, events } = make();
    redis.down = true;
    // First DEGRADED_IP_MAX attempts allowed (0), event emitted each time.
    let allowed = 0;
    let blocked = 0;
    for (let i = 0; i < 25; i++) {
      const r = await svc.checkIp("9.9.9.9");
      if (r === 0) allowed++;
      else blocked++;
    }
    expect(allowed).toBeGreaterThan(0); // fail-open: some allowed
    expect(blocked).toBeGreaterThan(0); // degraded limiter eventually bites
    expect(events).toContain("auth.throttle.fail_open");
  });

  it("account backoff fails open (returns 0) when Redis is down", async () => {
    const { svc, redis } = make();
    redis.down = true;
    expect(await svc.accountRetryAfter("acct")).toBe(0);
    expect(await svc.recordAccountFailure("acct")).toBe(0);
  });
});
