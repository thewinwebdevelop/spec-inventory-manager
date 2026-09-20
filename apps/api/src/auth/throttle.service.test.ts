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

  // ── N-3 (T-002-11): the bucket is the client-ip helper's key ───────────────
  it("IPv4: the redis key is unchanged from F-001 (throttle:ip:<ip> verbatim)", async () => {
    const { svc, redis } = make();
    await svc.checkIp("1.2.3.4");
    expect([...redis.store.keys()]).toEqual(["throttle:ip:1.2.3.4"]);
  });

  it("IPv6: two addresses in the SAME /64 share ONE window (rotation cannot bypass)", async () => {
    const { svc, redis } = make();
    // Spend the whole quota by rotating the low 64 bits — same subscriber.
    for (let i = 0; i < IP_WINDOW_MAX; i++) {
      expect(await svc.checkIp(`2001:db8:85a3:1::${i + 1}`)).toBe(0);
    }
    expect(await svc.checkIp("2001:db8:85a3:1:ffff:ffff:ffff:ffff")).toBeGreaterThan(0);
    // …and all of it lived in a single /64 bucket.
    expect([...redis.store.keys()]).toEqual(["throttle:ip:2001:db8:85a3:1::/64"]);
  });

  it("IPv6: a different /64 is a different bucket (not one global v6 bucket)", async () => {
    const { svc } = make();
    for (let i = 0; i < IP_WINDOW_MAX + 1; i++) await svc.checkIp("2001:db8:85a3:1::1");
    expect(await svc.checkIp("2001:db8:85a3:2::1")).toBe(0);
  });

  it("IPv4-mapped IPv6 shares the plain-IPv4 bucket (one client, one quota)", async () => {
    const { svc, redis } = make();
    await svc.checkIp("::ffff:203.0.113.5");
    await svc.checkIp("203.0.113.5");
    expect([...redis.store.keys()]).toEqual(["throttle:ip:203.0.113.5"]);
    expect(redis.store.get("throttle:ip:203.0.113.5")).toBe(2);
  });

  it("unparseable IPs fail CLOSED into one shared bucket (garbage cannot mint buckets)", async () => {
    const { svc, redis } = make();
    for (const bad of ["unknown", "not-an-ip", "999.1.1.1", ""]) await svc.checkIp(bad);
    expect([...redis.store.keys()]).toEqual(["throttle:ip:unknown"]);
    expect(redis.store.get("throttle:ip:unknown")).toBe(4);
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

  it("the DEGRADED in-process limiter is also keyed on the /64 (no v6 bypass while Redis is down)", async () => {
    const { svc, redis } = make();
    redis.down = true;
    let blocked = 0;
    // Rotate the low 64 bits on every attempt: if the degraded bucket keyed on
    // the full address, every attempt would be a fresh bucket → never blocked.
    for (let i = 0; i < 40; i++) {
      if ((await svc.checkIp(`2001:db8:85a3:7::${i + 1}`)) > 0) blocked++;
    }
    expect(blocked).toBeGreaterThan(0);
  });

  it("account backoff fails open (returns 0) when Redis is down", async () => {
    const { svc, redis } = make();
    redis.down = true;
    expect(await svc.accountRetryAfter("acct")).toBe(0);
    expect(await svc.recordAccountFailure("acct")).toBe(0);
  });
});
