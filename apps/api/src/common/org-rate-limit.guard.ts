// F-002 · T-002-14 — the CENTRAL org rate-limit guard (architecture §8).
//
// backend.md calls `auth/throttle.service.ts` an F-001-only exception ("ห้ามลอก
// inline"): every feature from F-002 onward rate-limits through THIS guard
// instead of hand-rolling a limiter in a controller. Same Redis sliding-window
// shape, one implementation, declared per route with `@OrgRateLimit(action)`.
//
// ── Fail-OPEN, on purpose (architecture §8) ────────────────────────────────
// Redis down ⇒ the request is allowed and `auth.throttle.fail_open` is emitted.
// That is the opposite of the authz layers next door, and the difference is
// deliberate: a rate limit is abuse control, not authorization. Nothing here
// holds an invariant — the org-per-user cap is enforced fail-closed in the
// service (§6.3, finding I-10), so this layer can be lost without any bound
// being violated. Failing closed instead would mean one Redis outage takes down
// sign-up, invitations and everything else that carries a quota.
//
// ── Retry-After (qa Q11) ───────────────────────────────────────────────────
// Always an INTEGER number of seconds, always ≥ 1. Never 0, never a decimal,
// never an HTTP-date: mobile computes its backoff straight off this value, and
// `Retry-After: 0` would turn a limiter into a tight retry loop.
import {
  Injectable,
  Inject,
  Logger,
  Optional,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Redis } from "ioredis";
import {
  ORG_RATE_LIMITS,
  type OrgRateLimitAction,
  type OrgRateLimitRule,
} from "@omnistock/config";
import { domainError } from "./domain-exception";
import { clientIpKey } from "./client-ip";
import { ORG_RATE_LIMIT_KEY } from "./org-rate-limit.decorator";
import {
  ORG_RATE_LIMIT_REDIS,
  ORG_RATE_LIMIT_EVENT_SINK,
  ORG_RATE_LIMIT_FAIL_OPEN_EVENT,
  type RateLimitEventSink,
} from "./org-rate-limit.tokens";

/** Redis key prefix — one namespace, greppable in redis-cli. */
export const ORG_RATE_LIMIT_PREFIX = "orgrl:";

/**
 * Minimal request shape this guard reads. It deliberately does NOT read
 * `req.user`: like `OrgScopeGuard` (finding I-4), this is a global guard that
 * runs before any controller-level `JwtAuthGuard`, so `req.user` is always
 * `undefined` here. The identity comes from `req.orgAuth`, which the tenancy
 * middleware fills in from the verified bearer token.
 */
interface RateLimitedRequest {
  method?: string;
  route?: { path?: string };
  url?: string;
  ip?: string;
  params?: Record<string, string>;
  orgAuth?: { userId?: string; tokenValid: boolean };
}

/** Resolved bucket, or the reason we could not build one. */
type BucketResolution =
  | { readonly kind: "bucket"; readonly value: string }
  | { readonly kind: "unidentified"; readonly dimension: string };

@Injectable()
export class OrgRateLimitGuard implements CanActivate {
  private readonly logger = new Logger("OrgRateLimit");

  // ⚠️ `@Inject(Reflector)` is NOT decoration — it is the difference between an
  // app that boots and one that does not. `main.ts` runs under `tsx`, which
  // emits no `design:paramtypes` metadata, so a type-only constructor param
  // resolves to `undefined` at runtime and Nest refuses to build the guard.
  // Every test passed without it (vitest compiles the metadata) while
  // `tsx src/main.ts` died on boot — the failure mode `org-context.middleware.ts`
  // already warned about, and CI is where it finally showed up.
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Optional()
    @Inject(ORG_RATE_LIMIT_REDIS)
    private readonly redis: Redis | null = null,
    @Optional()
    @Inject(ORG_RATE_LIMIT_EVENT_SINK)
    private readonly events: RateLimitEventSink | null = null,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const action = this.reflector.getAllAndOverride<OrgRateLimitAction | undefined>(
      ORG_RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    // Undeclared ⇒ unlimited. See the decorator for why this default is open
    // while the authz layers next door are closed.
    if (!action) return true;

    // ⚠️ `ORG_RATE_LIMITS`, not `ORG_RATE_LIMIT_DEFAULTS`. The first is a LIVE
    // view whose getters read `process.env` on every access; the second is the
    // frozen fallback the zod schema uses when a variable is absent. Reading the
    // frozen one meant architecture §8's "env-tunable" was false in practice:
    // setting `ORG_RATE_LIMIT_INVITE_PUBLIC_PER_HOUR` changed nothing at
    // runtime, and nobody would have found out until an incident where turning
    // a quota down was the response.
    const rule = ORG_RATE_LIMITS[action];
    const req = context.switchToHttp().getRequest<RateLimitedRequest>();
    const route = `${req.method ?? "?"} ${req.route?.path ?? req.url ?? "?"}`;
    const resolved = this.resolveBucket(rule, req);

    if (resolved.kind === "unidentified") {
      // We cannot count what we cannot name. Refusing here would be
      // fail-CLOSED on an abuse control — and worse, it would 429 requests
      // whose only fault is arriving before the layer that establishes
      // identity. It is logged so a route wired in the wrong order is visible.
      this.logger.warn(
        `${route} declares @OrgRateLimit(${action}) keyed by '${rule.key}', but ` +
          `${resolved.dimension} is not available on this request — not counted`,
      );
      return true;
    }

    const key = `${ORG_RATE_LIMIT_PREFIX}${action}:${resolved.value}`;
    const retryAfter = await this.consume(key, rule, action, route);
    if (retryAfter > 0) {
      throw domainError("RATE_LIMITED", {
        headers: { "Retry-After": String(retryAfter) },
      });
    }
    return true;
  }

  /**
   * Increment the window and report `retryAfter` seconds (0 = allowed).
   *
   * `INCR` + `EXPIRE` on first hit is the same fixed-window-with-TTL shape
   * F-001 shipped. Choosing it again is deliberate: two limiters that behave
   * differently under load are two limiters to reason about, and this one
   * guards actions measured per HOUR, where the window-edge burst a true
   * sliding window would prevent is not worth a second algorithm.
   */
  private async consume(
    key: string,
    rule: OrgRateLimitRule,
    action: OrgRateLimitAction,
    route: string,
  ): Promise<number> {
    if (!this.redis) return this.failOpen(action, route, "redis provider not bound");
    try {
      const count = await this.redis.incr(key);
      if (count === 1) await this.redis.expire(key, rule.windowSec);
      if (count <= rule.limit) return 0;
      const ttl = await this.redis.ttl(key);
      // A key with no TTL (`-1`) would keep the caller locked out forever, and
      // a missing key (`-2`) means it expired between INCR and TTL. Both fall
      // back to a full window rather than to 0 — `Retry-After: 0` is a tight
      // retry loop wearing a 429.
      return Math.max(1, Math.ceil(ttl > 0 ? ttl : rule.windowSec));
    } catch (err) {
      return this.failOpen(action, route, err);
    }
  }

  /** Redis unavailable → allow, but leave a trail (§8). */
  private failOpen(action: OrgRateLimitAction, route: string, cause: unknown): number {
    this.logger.error(
      `rate limit fail-open on ${route} (${action}): ${cause instanceof Error ? cause.message : String(cause)}`,
    );
    this.events?.emit(ORG_RATE_LIMIT_FAIL_OPEN_EVENT, { action, route });
    return 0;
  }

  /**
   * Build the bucket identity for this rule's dimension.
   *
   * `organizationId` comes from the path param rather than the ALS context so
   * the guard does not depend on guard-vs-middleware ordering; the request only
   * reaches a handler at all if `OrgScopeGuard` already proved the caller is an
   * active member of that org, so the value is not attacker-chosen by the time
   * it is counted.
   */
  private resolveBucket(rule: OrgRateLimitRule, req: RateLimitedRequest): BucketResolution {
    const userId = req.orgAuth?.tokenValid ? req.orgAuth.userId : undefined;
    const orgId = req.params?.orgId;

    switch (rule.key) {
      case "userId":
        return userId ? { kind: "bucket", value: `u:${userId}` } : { kind: "unidentified", dimension: "userId" };

      case "organizationId":
        return orgId
          ? { kind: "bucket", value: `o:${orgId}` }
          : { kind: "unidentified", dimension: "organizationId (:orgId path param)" };

      case "userId+organizationId":
        return userId && orgId
          ? { kind: "bucket", value: `u:${userId}|o:${orgId}` }
          : { kind: "unidentified", dimension: "userId and/or organizationId" };

      case "ip":
        // Never the raw address: `clientIpKey` collapses IPv6 to /64 (N-3),
        // otherwise one subscriber mints unlimited buckets and the per-IP quota
        // on the PUBLIC invitation endpoints means nothing. It is fail-closed —
        // anything unparseable shares one `unknown` bucket — so this branch
        // always yields a bucket and never falls through to "not counted".
        return { kind: "bucket", value: `i:${clientIpKey(req.ip ?? "")}` };
    }
  }
}
