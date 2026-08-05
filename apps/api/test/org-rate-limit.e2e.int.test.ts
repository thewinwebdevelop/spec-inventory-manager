// F-002 · T-002-14 ★ — the org rate-limit guard, proven through the REAL stack.
//
// WHY THIS FILE EXISTS
// `org-rate-limit.guard.test.ts` covers the guard thoroughly — with a fake
// Redis, a hand-built `ExecutionContext` and a hand-built request. Every one of
// those inputs is something we imagined. Nothing had ever asserted that a real
// HTTP request to a real decorated endpoint, counted in a real Redis, comes back
// 429.
//
// That distinction is not academic here. The same gap — a unit test feeding a
// constructed input while the real path produced a different shape — is exactly
// how `describeOrgBusy` shipped claiming to answer 409 on lock contention while
// actually answering 500 for weeks. The unit suite was green throughout.
//
// So this file drives the guard the way production does: Nest app, global guard
// chain in registration order, `@OrgRateLimit("createOrganization")` on
// `POST /organizations`, ioredis against the test server.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { Redis } from "ioredis";
import { PrismaClient } from "@omnistock/db";
import { ORG_RATE_LIMIT_DEFAULTS } from "@omnistock/config";
import { AccessTokenService } from "../src/auth/access-token.service";
import { collectSecurityEvents } from "../src/auth";
import { ORG_RATE_LIMIT_PREFIX } from "../src/common/org-rate-limit.guard";
import { INT_LANE_ENABLED, applyTestEnv, createTestApp, type TestApp } from "./app.kit";
import { createSeedKit, type SeedKit } from "./f002-seed.kit";

const d = INT_LANE_ENABLED ? describe : describe.skip;

d("org rate limit through the real stack (architecture §8)", () => {
  let app: TestApp;
  let redis: Redis;
  let prisma: PrismaClient;
  let kit: SeedKit;
  const createdOrgIds: string[] = [];

  /** The quota comes from config — never a number typed into this file. */
  const RULE = ORG_RATE_LIMIT_DEFAULTS.createOrganization;

  const token = (userId: string): string =>
    app.app.get(AccessTokenService, { strict: false }).sign(userId);

  async function newUser() {
    const user = await kit.createUser();
    return { ...user, accessToken: token(user.id) };
  }

  async function createOrg(accessToken: string, name = "ร้านโควตา") {
    const res = await request(app.server())
      .post("/organizations")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send({ name });
    const id = (res.body as { organization?: { id?: string } })?.organization?.id;
    if (typeof id === "string") createdOrgIds.push(id);
    return res;
  }

  beforeAll(async () => {
    applyTestEnv();
    prisma = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
    await prisma.$connect();
    // The kit opens no socket it does not own, so this suite owns this one and
    // closes it in `afterAll`.
    redis = new Redis(process.env.TEST_REDIS_URL as string);
    app = await createTestApp({ rateLimitRedis: redis });
    kit = createSeedKit(prisma, { label: "t14rl" });
  });

  afterAll(async () => {
    // Delete exactly what this suite created, in FK order, by id — vitest runs
    // these files in parallel against one Postgres, so a table-wide sweep would
    // take a neighbour's fixtures with it.
    if (prisma && createdOrgIds.length > 0) {
      const where = { organizationId: { in: createdOrgIds } };
      await prisma.warehouse.deleteMany({ where });
      await prisma.orgEntitlement.deleteMany({ where });
      await prisma.invitation.deleteMany({ where });
      await prisma.membership.deleteMany({ where });
      await prisma.role.deleteMany({ where });
      await prisma.organization.deleteMany({ where: { id: { in: createdOrgIds } } });
    }
    if (kit) await kit.cleanup();
    if (app) await app.close();
    if (redis) {
      const keys = await redis.keys(`${ORG_RATE_LIMIT_PREFIX}*`);
      if (keys.length > 0) await redis.del(...keys);
      redis.disconnect();
    }
    if (prisma) await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Each case gets a clean window; the counters are this suite's own
    // namespace, so clearing them cannot disturb another suite's throttle keys
    // (those live under `throttle:`).
    const keys = await redis.keys(`${ORG_RATE_LIMIT_PREFIX}*`);
    if (keys.length > 0) await redis.del(...keys);
  });

  it("★ the quota actually bites: request N+1 is 429 with a usable Retry-After", async () => {
    const user = await newUser();
    for (let i = 0; i < RULE.limit; i++) {
      const res = await createOrg(user.accessToken, `ร้าน ${i}`);
      expect(res.status, `request ${i + 1} of ${RULE.limit} should be allowed`).toBe(201);
    }

    const refused = await createOrg(user.accessToken, "ร้านเกินโควตา");
    expect(refused.status).toBe(429);
    expect(refused.body.error.code).toBe("RATE_LIMITED");
    // Mobile does `sleep(Number(retryAfter))`, so "0" is a tight retry loop and
    // a decimal is NaN-adjacent in some clients.
    const retryAfter = refused.headers["retry-after"];
    expect(retryAfter).toMatch(/^[1-9]\d*$/);
    expect(Number(retryAfter)).toBeLessThanOrEqual(RULE.windowSec);
  });

  it("★ the refusal happens BEFORE the shop is created — no half-charged quota", async () => {
    // A 429 that still wrote a row would be worse than no limit at all: the
    // caller is told to back off while the resource was consumed anyway.
    const user = await newUser();
    for (let i = 0; i < RULE.limit; i++) await createOrg(user.accessToken, `ร้าน ${i}`);
    const before = await prisma.organization.count({
      where: { memberships: { some: { userId: user.id } } },
    });

    const refused = await createOrg(user.accessToken, "ร้านที่ไม่ควรเกิด");
    expect(refused.status).toBe(429);

    const after = await prisma.organization.count({
      where: { memberships: { some: { userId: user.id } } },
    });
    expect(after).toBe(before);
  });

  it("★ the bucket is per USER — one person's quota cannot lock everyone out", async () => {
    const heavy = await newUser();
    for (let i = 0; i < RULE.limit; i++) await createOrg(heavy.accessToken, `ร้าน ${i}`);
    expect((await createOrg(heavy.accessToken, "เกิน")).status).toBe(429);

    // `createOrganization` is keyed by userId (§8). If the key collapsed to
    // something shared — an IP, or a constant — the first busy tenant would
    // take the endpoint down for everybody, and nothing else in the suite would
    // notice.
    const bystander = await newUser();
    expect((await createOrg(bystander.accessToken, "ร้านคนอื่น")).status).toBe(201);
  });

  it("★ Redis down → fail OPEN, and say so (abuse control is not authorization)", async () => {
    // §8 is explicit that this layer may be lost without any invariant
    // breaking: the 50-shop cap is enforced fail-CLOSED in the service (I-10).
    // Failing closed here would mean one Redis outage stops shop creation
    // entirely.
    const broken = new Redis({ port: 1, host: "127.0.0.1", lazyConnect: true, retryStrategy: () => null });
    const degraded = await createTestApp({ rateLimitRedis: broken });
    const events = collectSecurityEvents(degraded.events);
    try {
      const user = await newUser();
      const res = await request(degraded.server())
        .post("/organizations")
        .set("Authorization", `Bearer ${token(user.id)}`)
        .set("Content-Type", "application/json")
        .send({ name: "ร้านตอน redis ล่ม" });
      const id = (res.body as { organization?: { id?: string } })?.organization?.id;
      if (typeof id === "string") createdOrgIds.push(id);

      expect(res.status).toBe(201);
      // Allowed, but never silently: an operator has to be able to answer
      // "were we enforcing quotas at 03:00?".
      expect(events.ofType("auth.throttle.fail_open").length).toBeGreaterThan(0);
    } finally {
      events.stop();
      await degraded.close();
      broken.disconnect();
    }
  });

  it("the counter is namespaced, so it cannot collide with F-001's throttle keys", async () => {
    const user = await newUser();
    await createOrg(user.accessToken, "ร้านคีย์");
    const ours = await redis.keys(`${ORG_RATE_LIMIT_PREFIX}*`);
    expect(ours.length).toBeGreaterThan(0);
    // F-001's login/signup limiter lives under `throttle:`; two limiters sharing
    // a key space would let one reset the other's window.
    expect(ours.every((k) => !k.startsWith("throttle:"))).toBe(true);
  });

  it("★ the quota is genuinely env-tunable — turning it down takes effect", async () => {
    // architecture §8 and api-spec §19 both advertise these limits as
    // env-tunable, and `@omnistock/config` exports the variables and a live
    // resolver for exactly that. The guard was reading the FROZEN defaults
    // instead, so setting `ORG_RATE_LIMIT_CREATE_ORG_PER_HOUR` changed nothing
    // at runtime — a gap nobody would have found until the incident where
    // turning a quota down was the response.
    const previous = process.env.ORG_RATE_LIMIT_CREATE_ORG_PER_HOUR;
    process.env.ORG_RATE_LIMIT_CREATE_ORG_PER_HOUR = "1";
    try {
      const user = await newUser();
      expect((await createOrg(user.accessToken, "ร้านแรก")).status).toBe(201);
      // With the default of 10 this would still be allowed; it is refused only
      // because the env value is the one actually in force.
      expect(RULE.limit).toBeGreaterThan(1);
      const refused = await createOrg(user.accessToken, "ร้านที่สอง");
      expect(refused.status).toBe(429);
    } finally {
      if (previous === undefined) delete process.env.ORG_RATE_LIMIT_CREATE_ORG_PER_HOUR;
      else process.env.ORG_RATE_LIMIT_CREATE_ORG_PER_HOUR = previous;
    }
  });
});