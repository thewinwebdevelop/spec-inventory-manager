// F-001 · T-001-06 — throttle & rate-limit (Redis). arch §8, data-model §4.
// - IP sliding-window on login/signup/refresh (throttle:ip:{ip}); trip → 429.
// - account consecutive-failure backoff (throttle:acct:{key}): login keys on the
//   SUBMITTED normalized email whether or not a user exists (M-1 — no 429
//   differential oracle); change-password keys on the authenticated userId (N-2).
// - ALWAYS 429 + Retry-After (never folded into a 401) — the caller raises the
//   429 based on `retryAfter > 0`.
// - fail-open on Redis-down (M-7): allow the attempt, but (a) a degraded
//   in-process limiter still bites — IP window AND account backoff (the
//   authenticated change-password / admin-reset paths have no IP check, so the
//   account dimension needs its own backstop), (b) emit auth.throttle.fail_open
//   for every fail-open decision, IP or account.
//   "Down" includes HUNG: every Redis call is raced against
//   THROTTLE_REDIS_TIMEOUT_MS, so a dead server can never hold login hostage.
//
// The backoff CURVE is the core-domain pure fn `backoffSeconds` (golden rule #6).
//
// T-002-11 (N-3): the IP bucket is NOT the raw address — it is
// `clientIpKey()` from common/client-ip.ts (IPv6 collapsed to /64, IPv4
// unchanged). Same helper as the F-002 org rate-limit guard; never inline it.
import { Injectable, Logger } from "@nestjs/common";
import type { Redis } from "ioredis";
import { backoffSeconds } from "@omnistock/core-domain";
import {
  THROTTLE_IP_PREFIX,
  THROTTLE_ACCT_PREFIX,
  IP_WINDOW_MAX,
  IP_WINDOW_SECONDS,
  ACCT_COUNTER_TTL_SECONDS,
  DEGRADED_IP_MAX,
  DEGRADED_IP_WINDOW_MS,
  DEGRADED_ACCT_MAX_KEYS,
  THROTTLE_REDIS_TIMEOUT_MS,
} from "./auth.constants";
import { SecurityEventsService } from "./security-events.service";
import { clientIpKey } from "../common/client-ip";

/** A throttle Redis call that lost the race against its deadline. */
class ThrottleRedisTimeoutError extends Error {
  constructor(step: string) {
    super(`throttle redis ${step} exceeded ${THROTTLE_REDIS_TIMEOUT_MS}ms`);
    this.name = "ThrottleRedisTimeoutError";
  }
}

/**
 * Settles with `work` or rejects at {@link THROTTLE_REDIS_TIMEOUT_MS}, whichever
 * is first. `Promise.race` keeps a handler on `work`, so a late rejection is not
 * an unhandledRejection. The timer is cleared on settle and unref'd.
 */
function withDeadline<T>(step: string, work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ThrottleRedisTimeoutError(step)), THROTTLE_REDIS_TIMEOUT_MS);
    (timer as { unref?: () => void }).unref?.();
  });
  return Promise.race([work, deadline]).finally(() => clearTimeout(timer));
}

/** In-process degraded IP limiter state (per API instance). */
interface DegradedBucket {
  count: number;
  windowStart: number;
}

/** In-process degraded account-failure counter (per API instance). */
interface DegradedAccount {
  failures: number;
  /** Last failure, epoch ms — the counter lives ACCT_COUNTER_TTL from here,
   *  like the Redis key whose TTL every failure refreshes. */
  lastFailureAt: number;
}

const ACCT_COUNTER_TTL_MS = ACCT_COUNTER_TTL_SECONDS * 1000;

@Injectable()
export class ThrottleService {
  private readonly logger = new Logger("Throttle");
  private readonly degraded = new Map<string, DegradedBucket>();
  private readonly degradedAcct = new Map<string, DegradedAccount>();

  constructor(
    private readonly redis: Redis,
    private readonly securityEvents: SecurityEventsService,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /**
   * Check + increment the IP sliding window for a pre-auth endpoint. Returns
   * `retryAfter` seconds (>0 ⇒ the caller must 429) or 0 (allowed).
   * Fail-open on Redis error, but the degraded in-process limiter still applies.
   *
   * `ip` is the express-resolved client address (TRUST_PROXY_HOPS decides which
   * one that is); the bucket it maps to is `clientIpKey`'s business.
   */
  async checkIp(ip: string): Promise<number> {
    const bucket = clientIpKey(ip);
    const key = `${THROTTLE_IP_PREFIX}${bucket}`;
    let count: number;
    try {
      count = await withDeadline("incr", this.redis.incr(key));
    } catch (err) {
      // A timed-out INCR may still land later (slow, not dead, Redis). Queue an
      // EXPIRE behind it so that late INCR can never leave a TTL-less key —
      // which would turn this IP's window into a lifetime counter. Best-effort.
      this.redis.expire(key, IP_WINDOW_SECONDS).catch(() => undefined);
      return this.failOpenIp(ip, bucket, err);
    }
    try {
      if (count === 1) {
        await withDeadline("expire", this.redis.expire(key, IP_WINDOW_SECONDS));
      }
      if (count > IP_WINDOW_MAX) {
        const ttl = await withDeadline("ttl", this.redis.ttl(key));
        if (ttl > 0) return ttl;
        // No TTL on an over-cap key = an orphan from a lost EXPIRE: heal it,
        // otherwise this bucket stays 429 forever.
        await withDeadline("expire", this.redis.expire(key, IP_WINDOW_SECONDS));
        return IP_WINDOW_SECONDS;
      }
      return 0;
    } catch (err) {
      return this.failOpenIp(ip, bucket, err);
    }
  }

  /**
   * Peek/record an ACCOUNT failure for backoff. Call AFTER a failed credential
   * check (`recordFailure`) and BEFORE the credential check to see if already
   * backed off (`accountRetryAfter`). Keyed on `acctKey` (emailNorm for login,
   * userId for change-pw / admin-reset).
   *
   * `ip` is only for the fail-open signal (`auth.throttle.fail_open { ip }`):
   * the bucket is the account, never the address.
   */
  async accountRetryAfter(acctKey: string, ip: string): Promise<number> {
    const key = `${THROTTLE_ACCT_PREFIX}${acctKey}`;
    try {
      const raw = await withDeadline("get", this.redis.get(key));
      const failures = raw ? Number(raw) : 0;
      // The in-process counter only exists if a WRITE failed in the last
      // ACCT_COUNTER_TTL (recordAccountFailure's catch). Take the larger of the
      // two, so a Redis that serves reads but rejects writes (maxmemory
      // noeviction → OOM, a demoted replica → READONLY), or one that came back
      // mid-attack, cannot reset a guesser's budget. Empty when healthy → no-op.
      const degraded = this.liveDegradedAccount(acctKey)?.failures ?? 0;
      return backoffSeconds(Math.max(failures, degraded));
    } catch (err) {
      return this.failOpenAccount(acctKey, ip, err);
    }
  }

  /** Record one account failure → returns the NEW retryAfter for the next try. */
  async recordAccountFailure(acctKey: string): Promise<number> {
    const key = `${THROTTLE_ACCT_PREFIX}${acctKey}`;
    try {
      // MULTI/EXEC: INCR and EXPIRE apply together or not at all. Two separate
      // commands could leave a TTL-less counter (connection drops between them,
      // or a timed-out INCR lands late) — and since a backed-off login never
      // reaches recordAccountFailure/clearAccount again, that is a PERMANENT 429.
      const replies = await withDeadline(
        "incr",
        this.redis.multi().incr(key).expire(key, ACCT_COUNTER_TTL_SECONDS).exec(),
      );
      const [incrErr, count] = replies?.[0] ?? [new Error("throttle multi aborted"), null];
      if (incrErr) throw incrErr;
      return backoffSeconds(Number(count));
    } catch (err) {
      // Redis down / rejecting writes: keep counting in-process so the degraded
      // backstop in accountRetryAfter has something to bite on (on BOTH its
      // read paths). The fail-open event is emitted where the attempt is
      // allowed; this log covers a write-only failure, where the read succeeds
      // and no event fires. No acctKey in the log (login: the email = PII).
      this.logger.warn(`redis write failed — account failure counted in-process: ${String(err)}`);
      return backoffSeconds(this.recordDegradedAccountFailure(acctKey));
    }
  }

  /** Clear an account's failure counter (successful login / admin reset). */
  async clearAccount(acctKey: string): Promise<void> {
    this.degradedAcct.delete(acctKey);
    try {
      await withDeadline("del", this.redis.del(`${THROTTLE_ACCT_PREFIX}${acctKey}`));
    } catch {
      // best-effort; a stale counter self-heals via TTL.
    }
  }

  // ─── fail-open degraded in-process account backoff (M-7) ──────────────────

  /** Account read failed → allowed, logged, but the in-process counter's
   *  backoff (same `backoffSeconds` curve as Redis) still applies. */
  private failOpenAccount(acctKey: string, ip: string, err: unknown): number {
    // No acctKey in the log: for login it is the submitted email (PII).
    this.logger.warn(`redis down — account throttle failing open for ip=${ip}: ${String(err)}`);
    this.securityEvents.emit("auth.throttle.fail_open", { ip });
    const entry = this.liveDegradedAccount(acctKey);
    return entry ? backoffSeconds(entry.failures) : 0;
  }

  private recordDegradedAccountFailure(acctKey: string): number {
    const nowMs = this.now();
    const failures = (this.liveDegradedAccount(acctKey)?.failures ?? 0) + 1;
    // delete + set keeps Map order = least-recently-failed first (for eviction).
    this.degradedAcct.delete(acctKey);
    this.evictDegradedAccounts(nowMs);
    this.degradedAcct.set(acctKey, { failures, lastFailureAt: nowMs });
    return failures;
  }

  private liveDegradedAccount(acctKey: string): DegradedAccount | undefined {
    const entry = this.degradedAcct.get(acctKey);
    if (entry && this.now() - entry.lastFailureAt > ACCT_COUNTER_TTL_MS) {
      this.degradedAcct.delete(acctKey);
      return undefined;
    }
    return entry;
  }

  /** Login account keys are attacker-chosen emails: bound the map. Expired
   *  entries go first, then the least-recently-failed. */
  private evictDegradedAccounts(nowMs: number): void {
    if (this.degradedAcct.size < DEGRADED_ACCT_MAX_KEYS) return;
    for (const [key, entry] of this.degradedAcct) {
      if (nowMs - entry.lastFailureAt > ACCT_COUNTER_TTL_MS) this.degradedAcct.delete(key);
    }
    while (this.degradedAcct.size >= DEGRADED_ACCT_MAX_KEYS) {
      const oldest = this.degradedAcct.keys().next().value;
      if (oldest === undefined) break;
      this.degradedAcct.delete(oldest);
    }
  }

  // ─── fail-open degraded in-process IP limiter (M-7) ────────────────────────

  private failOpenIp(ip: string, ipBucket: string, err: unknown): number {
    this.logger.warn(`redis down — throttle failing open for ip=${ip} bucket=${ipBucket}: ${String(err)}`);
    // Event payload stays `{ ip }` (the shipped F-001 registry field) = the raw
    // client address, which is what incident response wants; the bucket is a
    // derived detail and lives in the log line above.
    this.securityEvents.emit("auth.throttle.fail_open", { ip });
    // Degraded, per-process best-effort IP cap so an outage is not a fully
    // unthrottled brute-force window. Keyed on the SAME bucket as Redis,
    // otherwise IPv6 rotation would walk straight through this fallback too.
    const nowMs = this.now();
    const bucket = this.degraded.get(ipBucket);
    if (!bucket || nowMs - bucket.windowStart > DEGRADED_IP_WINDOW_MS) {
      this.degraded.set(ipBucket, { count: 1, windowStart: nowMs });
      return 0;
    }
    bucket.count += 1;
    if (bucket.count > DEGRADED_IP_MAX) {
      const elapsed = nowMs - bucket.windowStart;
      const remainingMs = Math.max(DEGRADED_IP_WINDOW_MS - elapsed, 0);
      return Math.ceil(remainingMs / 1000) || 1;
    }
    return 0;
  }
}
