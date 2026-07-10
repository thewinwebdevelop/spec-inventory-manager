// F-001 · T-001-06 — throttle & rate-limit (Redis). arch §8, data-model §4.
// - IP sliding-window on login/signup/refresh (throttle:ip:{ip}); trip → 429.
// - account consecutive-failure backoff (throttle:acct:{key}): login keys on the
//   SUBMITTED normalized email whether or not a user exists (M-1 — no 429
//   differential oracle); change-password keys on the authenticated userId (N-2).
// - ALWAYS 429 + Retry-After (never folded into a 401) — the caller raises the
//   429 based on `retryAfter > 0`.
// - fail-open on Redis-down (M-7): allow the attempt, but (a) a degraded
//   in-process IP limiter still bites, (b) emit auth.throttle.fail_open.
//
// The backoff CURVE is the core-domain pure fn `backoffSeconds` (golden rule #6).
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
} from "./auth.constants";
import { SecurityEventsService } from "./security-events.service";

/** In-process degraded IP limiter state (per API instance). */
interface DegradedBucket {
  count: number;
  windowStart: number;
}

@Injectable()
export class ThrottleService {
  private readonly logger = new Logger("Throttle");
  private readonly degraded = new Map<string, DegradedBucket>();

  constructor(
    private readonly redis: Redis,
    private readonly securityEvents: SecurityEventsService,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /**
   * Check + increment the IP sliding window for a pre-auth endpoint. Returns
   * `retryAfter` seconds (>0 ⇒ the caller must 429) or 0 (allowed).
   * Fail-open on Redis error, but the degraded in-process limiter still applies.
   */
  async checkIp(ip: string): Promise<number> {
    const key = `${THROTTLE_IP_PREFIX}${ip}`;
    try {
      const count = await this.redis.incr(key);
      if (count === 1) {
        await this.redis.expire(key, IP_WINDOW_SECONDS);
      }
      if (count > IP_WINDOW_MAX) {
        const ttl = await this.redis.ttl(key);
        return ttl > 0 ? ttl : IP_WINDOW_SECONDS;
      }
      return 0;
    } catch (err) {
      return this.failOpenIp(ip, err);
    }
  }

  /**
   * Peek/record an ACCOUNT failure for backoff. Call AFTER a failed credential
   * check (`recordFailure`) and BEFORE the credential check to see if already
   * backed off (`accountRetryAfter`). Keyed on `acctKey` (emailNorm for login,
   * userId for change-pw / admin-reset).
   */
  async accountRetryAfter(acctKey: string): Promise<number> {
    const key = `${THROTTLE_ACCT_PREFIX}${acctKey}`;
    try {
      const raw = await this.redis.get(key);
      const failures = raw ? Number(raw) : 0;
      return backoffSeconds(failures);
    } catch {
      // Fail-open: no account backoff when Redis is down (IP degraded limiter
      // is the backstop). Logged via the IP path when that is hit.
      return 0;
    }
  }

  /** Record one account failure → returns the NEW retryAfter for the next try. */
  async recordAccountFailure(acctKey: string): Promise<number> {
    const key = `${THROTTLE_ACCT_PREFIX}${acctKey}`;
    try {
      const count = await this.redis.incr(key);
      await this.redis.expire(key, ACCT_COUNTER_TTL_SECONDS);
      return backoffSeconds(count);
    } catch {
      return 0;
    }
  }

  /** Clear an account's failure counter (successful login / admin reset). */
  async clearAccount(acctKey: string): Promise<void> {
    try {
      await this.redis.del(`${THROTTLE_ACCT_PREFIX}${acctKey}`);
    } catch {
      // best-effort; a stale counter self-heals via TTL.
    }
  }

  // ─── fail-open degraded in-process IP limiter (M-7) ────────────────────────

  private failOpenIp(ip: string, err: unknown): number {
    this.logger.warn(`redis down — throttle failing open for ip=${ip}: ${String(err)}`);
    this.securityEvents.emit("auth.throttle.fail_open", { ip });
    // Degraded, per-process best-effort IP cap so an outage is not a fully
    // unthrottled brute-force window.
    const nowMs = this.now();
    const bucket = this.degraded.get(ip);
    if (!bucket || nowMs - bucket.windowStart > DEGRADED_IP_WINDOW_MS) {
      this.degraded.set(ip, { count: 1, windowStart: nowMs });
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
