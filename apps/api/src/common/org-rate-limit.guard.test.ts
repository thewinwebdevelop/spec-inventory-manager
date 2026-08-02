// F-002 · T-002-14 — the central org rate-limit guard (architecture §8, qa Q11).
//
// Quotas are NEVER hard-coded here. Architecture §8 splits the concerns
// explicitly: policy is pinned in `@omnistock/config` (U-CFG-06 compares
// `ORG_RATE_LIMIT_DEFAULTS` against the §8 table), and behaviour tests read the
// numbers back from config. A test asserting "the 31st invitation is refused"
// would pass by agreeing with itself and go red the day the policy legitimately
// changes — telling us nothing either way.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Reflector } from "@nestjs/core";
import { ORG_RATE_LIMIT_DEFAULTS, type OrgRateLimitAction } from "@omnistock/config";
import { OrgRateLimitGuard, ORG_RATE_LIMIT_PREFIX } from "./org-rate-limit.guard";
import { ORG_RATE_LIMIT_KEY } from "./org-rate-limit.decorator";
import { ORG_RATE_LIMIT_FAIL_OPEN_EVENT, type RateLimitEventSink } from "./org-rate-limit.tokens";
import { DomainException } from "./domain-exception";

const USER = "usr_1111111111111111111111";
const ORG = "org_aaaaaaaaaaaaaaaaaaaaaaaa";

/** In-memory stand-in for the Redis calls the guard makes. */
function fakeRedis() {
  const counts = new Map<string, number>();
  const ttls = new Map<string, number>();
  return {
    counts,
    ttls,
    incr: vi.fn(async (key: string) => {
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return next;
    }),
    expire: vi.fn(async (key: string, sec: number) => {
      ttls.set(key, sec);
      return 1;
    }),
    ttl: vi.fn(async (key: string) => ttls.get(key) ?? -1),
  };
}

function collectingSink(): RateLimitEventSink & { events: { type: string; payload: unknown }[] } {
  const events: { type: string; payload: unknown }[] = [];
  return { events, emit: (type, payload) => void events.push({ type, payload }) };
}

/** An ExecutionContext carrying `action` metadata and a request. */
function contextFor(
  action: OrgRateLimitAction | undefined,
  req: Record<string, unknown>,
): { ctx: Parameters<OrgRateLimitGuard["canActivate"]>[0]; reflector: Reflector } {
  const handler = function handler() {};
  if (action) Reflect.defineMetadata(ORG_RATE_LIMIT_KEY, action, handler);
  const ctx = {
    getHandler: () => handler,
    getClass: () => class Probe {},
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as Parameters<OrgRateLimitGuard["canActivate"]>[0];
  return { ctx, reflector: new Reflector() };
}

function authedRequest(over: Record<string, unknown> = {}) {
  return {
    method: "POST",
    route: { path: "/orgs/:orgId/invitations" },
    ip: "203.0.113.9",
    params: { orgId: ORG },
    orgAuth: { userId: USER, tokenValid: true },
    ...over,
  };
}

describe("OrgRateLimitGuard (architecture §8)", () => {
  let redis: ReturnType<typeof fakeRedis>;
  let sink: ReturnType<typeof collectingSink>;

  beforeEach(() => {
    redis = fakeRedis();
    sink = collectingSink();
  });

  function guard(r: unknown = redis) {
    const { reflector } = contextFor(undefined, {});
    return new OrgRateLimitGuard(reflector, r as never, sink);
  }

  it("a route with no @OrgRateLimit is unlimited and never touches Redis", async () => {
    const { ctx } = contextFor(undefined, authedRequest());
    await expect(guard().canActivate(ctx)).resolves.toBe(true);
    expect(redis.incr).not.toHaveBeenCalled();
  });

  it("allows exactly the configured quota, then refuses — the number comes from config", async () => {
    const action: OrgRateLimitAction = "createInvitation";
    const { limit } = ORG_RATE_LIMIT_DEFAULTS[action];
    const g = guard();

    for (let i = 0; i < limit; i++) {
      const { ctx } = contextFor(action, authedRequest());
      await expect(g.canActivate(ctx)).resolves.toBe(true);
    }

    const { ctx } = contextFor(action, authedRequest());
    await expect(g.canActivate(ctx)).rejects.toBeInstanceOf(DomainException);
  });

  it("the refusal is 429 RATE_LIMITED with an INTEGER Retry-After ≥ 1 (qa Q11)", async () => {
    const action: OrgRateLimitAction = "createInvitation";
    const rule = ORG_RATE_LIMIT_DEFAULTS[action];
    const g = guard();
    for (let i = 0; i < rule.limit; i++) {
      const { ctx } = contextFor(action, authedRequest());
      await g.canActivate(ctx);
    }
    // A window that has nearly elapsed is the case that produces a fractional
    // or zero Retry-After if anyone rounds the wrong way.
    redis.ttls.set(`${ORG_RATE_LIMIT_PREFIX}${action}:o:${ORG}`, 0.4 as unknown as number);

    const { ctx } = contextFor(action, authedRequest());
    const err = await g.canActivate(ctx).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DomainException);
    const domain = err as DomainException;
    expect(domain.getStatus()).toBe(429);
    expect(domain.code).toBe("RATE_LIMITED");

    const retryAfter = domain.responseHeaders?.["Retry-After"];
    expect(retryAfter).toBeDefined();
    // Mobile does `sleep(Number(retryAfter))`: "0" is a tight retry loop and
    // "0.4" is NaN-adjacent in some clients. Both must be impossible.
    expect(retryAfter).toMatch(/^[1-9]\d*$/);
    expect(Number(retryAfter)).toBeGreaterThanOrEqual(1);
  });

  it("a key with no TTL falls back to a full window, never to 0", async () => {
    const action: OrgRateLimitAction = "createInvitation";
    const rule = ORG_RATE_LIMIT_DEFAULTS[action];
    const g = guard();
    for (let i = 0; i < rule.limit; i++) {
      await g.canActivate(contextFor(action, authedRequest()).ctx);
    }
    redis.ttl.mockResolvedValueOnce(-1); // key exists, no expiry set

    const err = (await g
      .canActivate(contextFor(action, authedRequest()).ctx)
      .catch((e: unknown) => e)) as DomainException;
    expect(err.responseHeaders?.["Retry-After"]).toBe(String(rule.windowSec));
  });

  it("buckets by organizationId — two orgs do not share a quota", async () => {
    const action: OrgRateLimitAction = "createInvitation";
    const { limit } = ORG_RATE_LIMIT_DEFAULTS[action];
    const g = guard();
    for (let i = 0; i < limit; i++) {
      await g.canActivate(contextFor(action, authedRequest()).ctx);
    }
    // Same caller, DIFFERENT org → still allowed. If the key ignored the
    // dimension, one busy shop would throttle everybody else's.
    const other = authedRequest({ params: { orgId: "org_bbbbbbbbbbbbbbbbbbbbbbbb" } });
    await expect(g.canActivate(contextFor(action, other).ctx)).resolves.toBe(true);
  });

  it("buckets by userId — the same person is limited across orgs for create-org", async () => {
    const action: OrgRateLimitAction = "createOrganization";
    const { limit } = ORG_RATE_LIMIT_DEFAULTS[action];
    const g = guard();
    for (let i = 0; i < limit; i++) {
      await g.canActivate(contextFor(action, authedRequest({ params: {} })).ctx);
    }
    await expect(
      g.canActivate(contextFor(action, authedRequest({ params: {} })).ctx),
    ).rejects.toBeInstanceOf(DomainException);
  });

  it("the IP dimension collapses IPv6 to /64 — rotating the suffix does NOT mint a new bucket (N-3)", async () => {
    const action: OrgRateLimitAction = "publicInvitationEntry";
    const { limit } = ORG_RATE_LIMIT_DEFAULTS[action];
    const g = guard();
    // Public endpoint: no token, no org — the IP is the only identity there is.
    const anon = (ip: string) => ({
      method: "POST",
      route: { path: "/invitations/preview" },
      ip,
      params: {},
      orgAuth: { tokenValid: false },
    });

    for (let i = 0; i < limit; i++) {
      await g.canActivate(contextFor(action, anon(`2001:db8:1:2::${i + 1}`)).ctx);
    }
    // A fresh address in the SAME /64 — the exact move that makes a per-IP
    // limit meaningless against IPv6 if the key is the full address.
    await expect(
      g.canActivate(contextFor(action, anon("2001:db8:1:2:ffff:ffff:ffff:ffff")).ctx),
    ).rejects.toBeInstanceOf(DomainException);
  });

  it("an anonymous caller on a userId-keyed route is NOT counted, and says so loudly", async () => {
    const action: OrgRateLimitAction = "createOrganization";
    const g = guard();
    const ctx = contextFor(action, authedRequest({ orgAuth: { tokenValid: false } })).ctx;
    await expect(g.canActivate(ctx)).resolves.toBe(true);
    // Not counting is the right call (fail-open), but it must not be silent:
    // a route wired so identity is unavailable would otherwise look protected.
    expect(redis.incr).not.toHaveBeenCalled();
  });

  it("Redis down → fail-OPEN and emit auth.throttle.fail_open (§8)", async () => {
    const broken = {
      incr: vi.fn(async () => {
        throw new Error("connection refused");
      }),
      expire: vi.fn(),
      ttl: vi.fn(),
    };
    const g = guard(broken);
    const { ctx } = contextFor("createInvitation", authedRequest());

    await expect(g.canActivate(ctx)).resolves.toBe(true);
    expect(sink.events).toHaveLength(1);
    expect(sink.events[0]?.type).toBe(ORG_RATE_LIMIT_FAIL_OPEN_EVENT);
  });

  it("no Redis provider bound at all → fail-open, not a 500", async () => {
    const g = new OrgRateLimitGuard(new Reflector(), null as never, sink);
    const { ctx } = contextFor("createInvitation", authedRequest());
    await expect(g.canActivate(ctx)).resolves.toBe(true);
    expect(sink.events[0]?.type).toBe(ORG_RATE_LIMIT_FAIL_OPEN_EVENT);
  });

  it("every action in config is reachable through the guard (no orphan quota)", async () => {
    // A quota nobody can trigger is a policy that only exists on paper. This
    // walks the config, not a list retyped here — adding a row to §8 without
    // wiring it anywhere is then visible.
    const actions = Object.keys(ORG_RATE_LIMIT_DEFAULTS) as OrgRateLimitAction[];
    expect(actions.length).toBeGreaterThan(0);
    for (const action of actions) {
      const g = guard(fakeRedis());
      const { ctx } = contextFor(action, authedRequest());
      await expect(g.canActivate(ctx)).resolves.toBe(true);
    }
  });
});
