import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Redis } from "ioredis";
import { ThrottleService } from "./throttle.service";
import { SecurityEventsService } from "./security-events.service";
import {
  IP_WINDOW_MAX,
  IP_WINDOW_SECONDS,
  ACCT_COUNTER_TTL_SECONDS,
  DEGRADED_IP_MAX,
  DEGRADED_ACCT_MAX_KEYS,
  THROTTLE_REDIS_TIMEOUT_MS,
} from "./auth.constants";
import { createAuthRedisConnection, createRedisConnection } from "../health/redis.provider";

// Throttle logic with a fake Redis. Covers: IP window → 429, account backoff
// curve, clear-on-success, and fail-open (M-7) degraded limiter + fail_open event.

/** Minimal in-memory Redis stand-in for the ops ThrottleService uses. */
class FakeRedis {
  store = new Map<string, number>();
  ttls = new Map<string, number>();
  down = false;
  /** Reads work, writes rejected (maxmemory noeviction → OOM / READONLY replica). */
  writesDown = false;
  /** Replace what a MULTI exec resolves to (null / per-command error tuples). */
  execOverride: (() => Promise<unknown>) | undefined = undefined;
  async incr(key: string): Promise<number> {
    if (this.down) throw new Error("redis down");
    if (this.writesDown) throw new Error("OOM command not allowed when used memory > 'maxmemory'.");
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
  /** MULTI/EXEC: queued ops run together on exec, or not at all when down. */
  multiExecs = 0;
  multi() {
    const ops: Array<() => Promise<unknown>> = [];
    const chain = {
      incr: (key: string) => (ops.push(() => this.incr(key)), chain),
      expire: (key: string, seconds: number) => (ops.push(() => this.expire(key, seconds)), chain),
      exec: async (): Promise<Array<[Error | null, unknown]>> => {
        if (this.down) throw new Error("redis down");
        if (this.execOverride) return (await this.execOverride()) as Array<[Error | null, unknown]>;
        this.multiExecs++;
        const out: Array<[Error | null, unknown]> = [];
        for (const op of ops) out.push([null, await op()]);
        return out;
      },
    };
    return chain;
  }
}

interface Emitted {
  type: string;
  payload: Record<string, unknown>;
}

function make(now = () => 1_000_000): {
  svc: ThrottleService;
  redis: FakeRedis;
  events: string[];
  emitted: Emitted[];
} {
  const redis = new FakeRedis();
  const events: string[] = [];
  const emitted: Emitted[] = [];
  const securityEvents = new SecurityEventsService();
  securityEvents.emitter.on("*", (e: Emitted) => {
    events.push(e.type);
    emitted.push(e);
  });
  const svc = new ThrottleService(redis as unknown as Redis, securityEvents, now);
  return { svc, redis, events, emitted };
}

/** Which 1-based attempts of `n` came back > 0 (blocked). */
async function blockedAttempts(n: number, attempt: () => Promise<number>): Promise<number[]> {
  const blocked: number[] = [];
  for (let i = 1; i <= n; i++) if ((await attempt()) > 0) blocked.push(i);
  return blocked;
}

/** Attempts DEGRADED_IP_MAX+1 … DEGRADED_IP_MAX+5 — exactly the ones over the cap. */
const OVER_DEGRADED_CAP = [1, 2, 3, 4, 5].map((i) => DEGRADED_IP_MAX + i);

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
    expect(await svc.accountRetryAfter(key, "1.2.3.4")).toBeGreaterThan(0);
  });

  it("clearAccount resets the counter (self-heal on success)", async () => {
    const { svc } = make();
    const key = "acct";
    for (let i = 0; i < 6; i++) await svc.recordAccountFailure(key);
    await svc.clearAccount(key);
    expect(await svc.accountRetryAfter(key, "1.2.3.4")).toBe(0);
  });
});

describe("ThrottleService fail-open (M-7)", () => {
  it("fails open on Redis-down (allows) but emits auth.throttle.fail_open + degraded limiter still bites", async () => {
    const { svc, redis, events } = make();
    redis.down = true;
    // First DEGRADED_IP_MAX attempts allowed (0), then EXACTLY the rest blocked.
    const blocked = await blockedAttempts(DEGRADED_IP_MAX + 5, () => svc.checkIp("9.9.9.9"));
    expect(blocked).toEqual(OVER_DEGRADED_CAP);
    // One fail-open decision → one event, every time.
    expect(events.filter((t) => t === "auth.throttle.fail_open")).toHaveLength(DEGRADED_IP_MAX + 5);
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
    expect(await svc.accountRetryAfter("acct", "1.2.3.4")).toBe(0);
    expect(await svc.recordAccountFailure("acct")).toBe(0);
  });
});

// The authenticated password paths (change-password, admin-reset) have only the
// account dimension — no checkIp — so without these a Redis outage left them
// with no backstop and no signal (security review of the hang fix, Medium).
describe("ThrottleService account fail-open: signalled + degraded backstop (M-7)", () => {
  it("an account fail-open emits auth.throttle.fail_open with ONLY { ip } (no email/acctKey)", async () => {
    const { svc, redis, emitted } = make();
    redis.down = true;
    await svc.accountRetryAfter("victim@example.com", "7.7.7.7");
    expect(emitted).toEqual([
      { type: "auth.throttle.fail_open", payload: { ip: "7.7.7.7" }, at: expect.any(Number) },
    ]);
  });

  it("control: a healthy account read emits nothing", async () => {
    const { svc, emitted } = make();
    await svc.accountRetryAfter("acct", "7.7.7.7");
    expect(emitted).toEqual([]);
  });

  it("degraded backoff follows the SAME curve as Redis (5th failure → 1s, 6th → 2s)", async () => {
    const healthy = make();
    const healthyCurve: number[] = [];
    for (let i = 0; i < 6; i++) healthyCurve.push(await healthy.svc.recordAccountFailure("acct"));
    const { svc, redis } = make();
    redis.down = true;
    const curve: number[] = [];
    for (let i = 0; i < 6; i++) curve.push(await svc.recordAccountFailure("acct"));
    expect(curve).toEqual(healthyCurve);
    expect(curve).toEqual([0, 0, 0, 0, 1, 2]); // and the curve is not trivially flat
  });

  it("reads OK but writes rejected (OOM/READONLY): the in-process count still backs the guesser off", async () => {
    const { svc, redis } = make();
    redis.writesDown = true;
    for (let i = 0; i < 6; i++) await svc.recordAccountFailure("user-1");
    // GET succeeds and returns 0 — the degraded count must still win.
    expect(await svc.accountRetryAfter("user-1", "7.7.7.7")).toBe(2);
    expect(await svc.accountRetryAfter("user-2", "7.7.7.7")).toBe(0);
  });

  it("Redis recovering mid-attack does not reset the budget counted during the outage", async () => {
    const { svc, redis } = make();
    redis.down = true;
    for (let i = 0; i < 6; i++) await svc.recordAccountFailure("acct");
    redis.down = false; // back, with an empty counter for this account
    expect(await svc.accountRetryAfter("acct", "7.7.7.7")).toBe(2);
  });

  it("control: healthy Redis with no degraded entry → the Redis count alone decides", async () => {
    const { svc } = make();
    for (let i = 0; i < 4; i++) await svc.recordAccountFailure("acct");
    expect(await svc.accountRetryAfter("acct", "7.7.7.7")).toBe(0);
    await svc.recordAccountFailure("acct");
    expect(await svc.accountRetryAfter("acct", "7.7.7.7")).toBe(1);
  });

  it("MULTI exec resolving null (aborted) is counted in-process", async () => {
    const { svc, redis } = make();
    redis.execOverride = async () => null;
    const curve: number[] = [];
    for (let i = 0; i < 5; i++) curve.push(await svc.recordAccountFailure("acct"));
    expect(curve).toEqual([0, 0, 0, 0, 1]);
  });

  it("MULTI exec with a per-command INCR error is counted in-process (not read as a count)", async () => {
    const { svc, redis } = make();
    redis.execOverride = async () => [
      [new Error("OOM command not allowed"), null],
      [null, 1],
    ];
    const curve: number[] = [];
    for (let i = 0; i < 5; i++) curve.push(await svc.recordAccountFailure("acct"));
    expect(curve).toEqual([0, 0, 0, 0, 1]);
  });

  it("a guesser is backed off while Redis is down (change-password with a stolen token)", async () => {
    const { svc, redis } = make();
    redis.down = true;
    expect(await svc.accountRetryAfter("user-1", "7.7.7.7")).toBe(0);
    for (let i = 0; i < 6; i++) await svc.recordAccountFailure("user-1");
    expect(await svc.accountRetryAfter("user-1", "7.7.7.7")).toBeGreaterThan(0);
    // per-account: another account is unaffected
    expect(await svc.accountRetryAfter("user-2", "7.7.7.7")).toBe(0);
  });

  it("clearAccount wipes the degraded counter too, even with Redis still down", async () => {
    const { svc, redis } = make();
    redis.down = true;
    for (let i = 0; i < 6; i++) await svc.recordAccountFailure("acct");
    await svc.clearAccount("acct");
    expect(await svc.accountRetryAfter("acct", "7.7.7.7")).toBe(0);
  });

  it("the degraded counter expires ACCT_COUNTER_TTL after the last failure (like the Redis TTL)", async () => {
    let now = 1_000_000;
    const { svc, redis } = make(() => now);
    redis.down = true;
    for (let i = 0; i < 6; i++) await svc.recordAccountFailure("acct");
    now += ACCT_COUNTER_TTL_SECONDS * 1000;
    expect(await svc.accountRetryAfter("acct", "7.7.7.7")).toBeGreaterThan(0); // at the edge: still live
    now += 1;
    expect(await svc.accountRetryAfter("acct", "7.7.7.7")).toBe(0);
  });

  it("the degraded account map is bounded (attacker-chosen emails); least-recently-failed goes first", async () => {
    const { svc, redis } = make();
    redis.down = true;
    for (let i = 0; i < 6; i++) await svc.recordAccountFailure("first");
    for (let i = 0; i < 6; i++) await svc.recordAccountFailure("recent");
    // Fill to the cap with other keys; "recent" is refreshed so it stays newer than "first".
    for (let i = 0; i < DEGRADED_ACCT_MAX_KEYS - 2; i++)
      await svc.recordAccountFailure(`spray-${i}`);
    await svc.recordAccountFailure("recent"); // map is now exactly full
    await svc.recordAccountFailure("one-more"); // a NEW key over the cap → evict the oldest
    expect(await svc.accountRetryAfter("first", "7.7.7.7")).toBe(0); // evicted
    expect(await svc.accountRetryAfter("recent", "7.7.7.7")).toBeGreaterThan(0); // kept
  });

  it("healthy path: account INCR+EXPIRE go as ONE MULTI (atomic — no TTL-less counter)", async () => {
    const { svc, redis } = make();
    const incr = vi.spyOn(redis, "incr");
    await svc.recordAccountFailure("acct");
    expect(redis.multiExecs).toBe(1);
    expect(incr).toHaveBeenCalledTimes(1); // only from inside the MULTI
    expect(redis.ttls.get("throttle:acct:acct")).toBe(ACCT_COUNTER_TTL_SECONDS);
  });
});

// ─── M-7 fail-open must hold against a Redis that HANGS, not only one that
// throws. A connection with BullMQ's options (`maxRetriesPerRequest: null` +
// offline queue — what AUTH_REDIS used before createAuthRedisConnection) never
// rejects while Redis is down: commands wait in the offline queue, the `catch`
// alone never fires, and every login/signup/refresh request hangs. A half-open
// socket does the same on any connection — hence the per-command deadline.

/** A Redis whose commands never settle (a dead server behind the offline queue). */
class HangingRedis {
  calls: string[] = [];
  private never<T>(name: string): Promise<T> {
    this.calls.push(name);
    return new Promise<T>(() => {});
  }
  incr(): Promise<number> {
    return this.never("incr");
  }
  expire(): Promise<number> {
    return this.never("expire");
  }
  ttl(): Promise<number> {
    return this.never("ttl");
  }
  get(): Promise<string | null> {
    return this.never("get");
  }
  del(): Promise<number> {
    return this.never("del");
  }
  multi() {
    const ops: string[] = [];
    const chain = {
      incr: () => (ops.push("incr"), chain),
      expire: () => (ops.push("expire"), chain),
      exec: () => this.never<Array<[Error | null, unknown]>>(`multi:${ops.join(",")}`),
    };
    return chain;
  }
}

function makeHanging(): { svc: ThrottleService; redis: HangingRedis; events: string[] } {
  const redis = new HangingRedis();
  const events: string[] = [];
  const securityEvents = new SecurityEventsService();
  securityEvents.emitter.on("*", (e: { type: string }) => events.push(e.type));
  return { svc: new ThrottleService(redis as unknown as Redis, securityEvents), redis, events };
}

/** Starts `work` and reports whether it has settled (without awaiting it). */
function track<T>(work: Promise<T>): { settled: () => boolean; value: () => T | undefined } {
  let settled = false;
  let value: T | undefined;
  void work.then((v) => {
    settled = true;
    value = v;
  });
  return { settled: () => settled, value: () => value };
}

describe("ThrottleService fail-open on a HANGING Redis (M-7)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("the deadline is 200–300 ms (bounded, short enough to sit in front of login)", () => {
    expect(THROTTLE_REDIS_TIMEOUT_MS).toBeGreaterThanOrEqual(200);
    expect(THROTTLE_REDIS_TIMEOUT_MS).toBeLessThanOrEqual(300);
  });

  it("checkIp fails open (0) exactly AT the deadline and emits auth.throttle.fail_open", async () => {
    const { svc, redis, events } = makeHanging();
    const run = track(svc.checkIp("9.9.9.9"));
    await vi.advanceTimersByTimeAsync(THROTTLE_REDIS_TIMEOUT_MS - 1);
    expect(run.settled()).toBe(false); // not before the deadline…
    expect(events).not.toContain("auth.throttle.fail_open");
    await vi.advanceTimersByTimeAsync(1);
    expect(run.settled()).toBe(true); // …but exactly at it
    expect(run.value()).toBe(0);
    expect(events).toContain("auth.throttle.fail_open");
    // It tried Redis, then queued an EXPIRE behind the timed-out INCR.
    expect(redis.calls).toEqual(["incr", "expire"]);
  });

  it("the degraded in-process limiter still bites while Redis hangs (exactly the over-cap attempts)", async () => {
    const { svc } = makeHanging();
    const blocked = await blockedAttempts(DEGRADED_IP_MAX + 5, async () => {
      const run = track(svc.checkIp("9.9.9.9"));
      await vi.advanceTimersByTimeAsync(THROTTLE_REDIS_TIMEOUT_MS);
      expect(run.settled()).toBe(true);
      return run.value() ?? 0;
    });
    expect(blocked).toEqual(OVER_DEGRADED_CAP);
  });

  it("account backoff read/record/clear all settle at the deadline (fail-open 0, signalled)", async () => {
    const { svc, events } = makeHanging();
    const peek = track(svc.accountRetryAfter("acct", "9.9.9.9"));
    const rec = track(svc.recordAccountFailure("acct"));
    const clr = track(svc.clearAccount("acct"));
    await vi.advanceTimersByTimeAsync(THROTTLE_REDIS_TIMEOUT_MS - 1);
    expect([peek.settled(), rec.settled(), clr.settled()]).toEqual([false, false, false]);
    await vi.advanceTimersByTimeAsync(1);
    expect(peek.settled()).toBe(true);
    expect(peek.value()).toBe(0);
    expect(rec.settled()).toBe(true);
    expect(rec.value()).toBe(0);
    expect(clr.settled()).toBe(true);
    expect(events).toEqual(["auth.throttle.fail_open"]); // the read is the fail-open decision
  });

  it("recordAccountFailure sends INCR+EXPIRE as one MULTI, so a late INCR cannot orphan the counter", async () => {
    const { svc, redis } = makeHanging();
    const rec = track(svc.recordAccountFailure("acct"));
    // One atomic unit on the wire — no standalone INCR that could land alone.
    expect(redis.calls).toEqual(["multi:incr,expire"]);
    await vi.advanceTimersByTimeAsync(THROTTLE_REDIS_TIMEOUT_MS);
    expect(rec.value()).toBe(0);
  });
});

describe("ThrottleService · TTL-less keys (late INCR after a timeout)", () => {
  it("an over-cap IP key with NO TTL is healed (EXPIRE set), not 429 forever", async () => {
    const { svc, redis } = make();
    redis.store.set("throttle:ip:5.5.5.5", IP_WINDOW_MAX + 3); // orphan: no ttl entry
    expect(await svc.checkIp("5.5.5.5")).toBe(IP_WINDOW_SECONDS);
    expect(redis.ttls.get("throttle:ip:5.5.5.5")).toBe(IP_WINDOW_SECONDS);
  });

  it("control: an over-cap key WITH a TTL keeps its TTL (window not extended)", async () => {
    const { svc, redis } = make();
    redis.store.set("throttle:ip:5.5.5.5", IP_WINDOW_MAX + 3);
    redis.ttls.set("throttle:ip:5.5.5.5", 42);
    expect(await svc.checkIp("5.5.5.5")).toBe(42);
    expect(redis.ttls.get("throttle:ip:5.5.5.5")).toBe(42);
  });

  it("healthy path is unchanged: EXPIRE only on the first hit of a window", async () => {
    const { svc, redis } = make();
    const expire = vi.spyOn(redis, "expire");
    for (let i = 0; i < 3; i++) await svc.checkIp("6.6.6.6");
    expect(expire).toHaveBeenCalledTimes(1);
    expect(expire).toHaveBeenCalledWith("throttle:ip:6.6.6.6", IP_WINDOW_SECONDS);
  });

  it("healthy path: every account failure still refreshes the counter TTL", async () => {
    const { svc, redis } = make();
    await svc.recordAccountFailure("acct");
    await svc.recordAccountFailure("acct");
    expect(redis.store.get("throttle:acct:acct")).toBe(2);
    expect(redis.ttls.get("throttle:acct:acct")).toBe(ACCT_COUNTER_TTL_SECONDS);
  });
});

describe("ThrottleService · real ioredis, Redis down", () => {
  /** checkIp against a refused port; returns the outcome + elapsed ms. */
  async function againstDeadPort(
    redis: Redis,
  ): Promise<{ outcome: number | "hung"; ms: number; events: string[] }> {
    redis.on("error", () => {}); // reconnect noise is expected here
    try {
      const events: string[] = [];
      const securityEvents = new SecurityEventsService();
      securityEvents.emitter.on("*", (e: { type: string }) => events.push(e.type));
      const svc = new ThrottleService(redis, securityEvents);
      const t0 = Date.now();
      const outcome = await Promise.race([
        svc.checkIp("9.9.9.9"),
        new Promise<"hung">((r) => setTimeout(() => r("hung"), 3_000)),
      ]);
      return { outcome, ms: Date.now() - t0, events };
    } finally {
      redis.disconnect();
    }
  }

  it("the AUTH connection (createAuthRedisConnection) → dead port: fails open, fast", async () => {
    // Port 1 on loopback: connection refused. No offline queue → rejects at
    // once, well inside the per-command deadline.
    const r = await againstDeadPort(
      createAuthRedisConnection({ REDIS_URL: "redis://127.0.0.1:1" }),
    );
    expect(r.outcome).toBe(0);
    expect(r.events).toContain("auth.throttle.fail_open");
    expect(r.ms).toBeLessThan(THROTTLE_REDIS_TIMEOUT_MS);
  }, 10_000);

  it("even on the BullMQ-style connection (offline queue, retries:null) the deadline bounds it", async () => {
    // The connection that used to back AUTH_REDIS: the INCR is queued forever,
    // the failure mode a thrown-error fake cannot reproduce.
    const r = await againstDeadPort(createRedisConnection({ REDIS_URL: "redis://127.0.0.1:1" }));
    expect(r.outcome).toBe(0);
    expect(r.events).toContain("auth.throttle.fail_open");
    expect(r.ms).toBeGreaterThanOrEqual(THROTTLE_REDIS_TIMEOUT_MS - 5);
    expect(r.ms).toBeLessThan(THROTTLE_REDIS_TIMEOUT_MS + 1_000);
  }, 10_000);

  it("createAuthRedisConnection: no offline queue + bounded retries; BullMQ connection untouched", () => {
    const auth = createAuthRedisConnection({ REDIS_URL: "redis://127.0.0.1:1" });
    const shared = createRedisConnection({ REDIS_URL: "redis://127.0.0.1:1" });
    auth.on("error", () => {});
    shared.on("error", () => {});
    try {
      expect(auth.options.enableOfflineQueue).toBe(false);
      expect(auth.options.maxRetriesPerRequest).toBe(1);
      expect(shared.options.enableOfflineQueue).toBe(true);
      expect(shared.options.maxRetriesPerRequest).toBeNull();
    } finally {
      auth.disconnect();
      shared.disconnect();
    }
  });
});
