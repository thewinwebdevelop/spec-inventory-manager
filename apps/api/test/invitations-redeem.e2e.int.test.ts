// F-002 · T-002-20 ★ — redeeming an invitation, through the REAL stack
// (api-spec §3.14/§3.15).
//
// These are the only two F-002 routes a stranger can reach, so this suite is
// less about response shapes than about five properties that can ONLY be
// observed end to end:
//
//   * the token travels in the BODY. A request that puts it in the query string
//     is refused — proven by sending it there and watching the endpoint not see
//     it (I-6);
//   * the public quota really bites, and preview and accept share ONE per-IP
//     bucket, so switching endpoints buys an enumerator no extra budget;
//   * an unknown token and a rotated one are byte-for-byte the same refusal,
//     while a token that DID resolve gets its precise state;
//   * `accept` writes into the invitation's shop even when the caller sends
//     `X-Organization-Id` for a different one they legitimately belong to (I-3);
//   * accepting the same link twice AT THE SAME TIME produces one membership.
//
// ── The rate-limit connection is NAMESPACED, on purpose ────────────────────
// `org-rate-limit.e2e.int.test.ts` deletes every `orgrl:*` key in its
// `beforeEach`, and vitest runs these files in parallel against ONE Redis. A
// counter that a neighbouring suite can reset mid-loop is a flake generator, so
// this suite binds a connection with its own `keyPrefix`. Everything else is
// real: the real guard, real INCR/EXPIRE/TTL, real 429 mapping. The exact key
// STRING is pinned by that other suite, which is where it belongs.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { Redis } from "ioredis";
import { PrismaClient } from "@omnistock/db";
import { ORG_RATE_LIMIT_DEFAULTS } from "@omnistock/config";
import { AccessTokenService } from "../src/auth/access-token.service";
import { collectSecurityEvents } from "../src/auth";
import type { SecurityEventCollector } from "../src/auth/security-events.service";
import { ORG_RATE_LIMIT_PREFIX } from "../src/common/org-rate-limit.guard";
import { INVITATION_RESPONSE_HEADERS } from "../src/orgs";
import {
  assertErrorEnvelope,
  assertIdenticalErrorBodies,
  assertNoForeignValues,
  assertNoSecretFields,
  assertResponseHeaders,
} from "./assertions.kit";
import { INT_LANE_ENABLED, applyTestEnv, createTestApp, type TestApp } from "./app.kit";
import {
  createSeedKit,
  type SeedKit,
  type SeededOrg,
  type SeededRole,
  type SeededUser,
} from "./f002-seed.kit";
import { createF003SeedKit, type F003SeedKit } from "./f003-seed.kit";

const d = INT_LANE_ENABLED ? describe : describe.skip;

/** Private key space for this suite's counters — see the header note. */
const REDIS_KEY_PREFIX = "t20redeem:";
/** The quota comes from config; never a number typed into this file. */
const PUBLIC_RULE = ORG_RATE_LIMIT_DEFAULTS.publicInvitationEntry;

d("F-002 redeeming an invitation (E2E, DB)", () => {
  let app: TestApp;
  let prisma: PrismaClient;
  let kit: SeedKit;
  let redis: Redis;
  const createdOrgIds: string[] = [];
  /** Buckets this suite filled, deleted BY NAME in afterAll. */
  const usedIps: string[] = [];
  /** Random per RUN — see `freshIp`. Max 254 addresses, far more than needed. */
  const runOctets = [1 + Math.floor(Math.random() * 254), 1 + Math.floor(Math.random() * 254)];

  const token = (userId: string): string =>
    app.app.get(AccessTokenService, { strict: false }).sign(userId);

  /**
   * A fresh, unshared rate-limit bucket for one request.
   *
   * The /16 is RANDOM PER RUN, and that is not decoration. A counter lives for
   * a whole hour (`windowSec`), so with a fixed address sequence a run that
   * ends early — or one whose cleanup misses a bucket because the addresses
   * shifted — leaves a full quota behind for the NEXT run to walk into. The
   * symptom is a 429 in a case that never mentioned rate limiting, an hour
   * after the run that caused it. Randomising the prefix makes runs disjoint;
   * `afterAll` still deletes every bucket this run touched, by name.
   */
  function freshIp(): string {
    const ip = `10.${runOctets[0]}.${runOctets[1]}.${1 + usedIps.length}`;
    usedIps.push(ip);
    return ip;
  }

  async function newUser(options: { email?: string; createdAt?: Date } = {}) {
    const user = await kit.createUser(options);
    return { ...user, accessToken: token(user.id) };
  }

  /** An org created through the REAL endpoint, with its Owner. */
  async function newOrg(name = "ร้านรับคำเชิญ") {
    const owner = await newUser();
    const res = await request(app.server())
      .post("/organizations")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .set("Content-Type", "application/json")
      .send({ name });
    expect(res.status).toBe(201);
    const orgId = res.body.organization.id as string;
    createdOrgIds.push(orgId);
    return { owner, orgId };
  }

  const roleNamed = (orgId: string, name: string) =>
    prisma.role.findFirstOrThrow({ where: { organizationId: orgId, name } });

  /** Invite through the real endpoint, so the token is a real one-time token. */
  async function invite(orgId: string, accessToken: string, email: string, roleId: string) {
    const res = await request(app.server())
      .post(`/orgs/${orgId}/invitations`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send({ email, roleId });
    expect(res.status).toBe(201);
    return {
      token: res.body.token as string,
      invitationId: res.body.invitation.id as string,
      createdAt: new Date(res.body.invitation.createdAt as string),
    };
  }

  function previewReq(body: unknown, ip = freshIp()) {
    return request(app.server())
      .post("/invitations/preview")
      .set("X-Forwarded-For", ip)
      .set("Content-Type", "application/json")
      .send(body as object);
  }

  function acceptReq(body: unknown, accessToken?: string, ip = freshIp()) {
    const req = request(app.server())
      .post("/invitations/accept")
      .set("X-Forwarded-For", ip)
      .set("Content-Type", "application/json");
    if (accessToken) req.set("Authorization", `Bearer ${accessToken}`);
    return req.send(body as object);
  }

  beforeAll(async () => {
    applyTestEnv();
    prisma = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
    await prisma.$connect();
    // The kit opens no socket it does not own, so this suite owns this one.
    redis = new Redis(process.env.TEST_REDIS_URL as string, { keyPrefix: REDIS_KEY_PREFIX });
    app = await createTestApp({ rateLimitRedis: redis });
    kit = createSeedKit(prisma, { label: "t20" });
  });

  afterAll(async () => {
    // Delete exactly what this suite created, in FK order, by id — never a
    // sweep: vitest runs these files in parallel against one Postgres.
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
      // Everything under THIS SUITE'S prefix — the per-IP buckets and the
      // `createOrganization` / `createInvitation` counters the real endpoints
      // increment on the way. Scoped by a prefix nobody else uses, so it is
      // still "delete exactly what I created", not a sweep of `orgrl:*`.
      //
      // ⚠️ `KEYS` takes a PATTERN, not a key, so ioredis does NOT apply
      // `keyPrefix` to it and returns FULL names — while `DEL` does apply it.
      // Hence the strip: without it every delete would ask for
      // `t20redeem:t20redeem:…` and silently remove nothing.
      const keys = await redis.keys(`${REDIS_KEY_PREFIX}*`);
      if (keys.length > 0) {
        await redis.del(...keys.map((key) => key.slice(REDIS_KEY_PREFIX.length)));
      }
      redis.disconnect();
    }
    if (prisma) await prisma.$disconnect();
  });

  // ── §3.14 preview ────────────────────────────────────────────────────────

  it("★ shows the shop, the role and a MASKED address — with no token to sign in", async () => {
    const { owner, orgId } = await newOrg();
    const staff = await roleNamed(orgId, "Staff");
    const invitee = await newUser();
    const invited = await invite(orgId, owner.accessToken, invitee.email, staff.id);

    // No Authorization header anywhere: this is the @Public() route.
    const res = await previewReq({ token: invited.token });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      organizationName: "ร้านรับคำเชิญ",
      roleName: "Staff",
      roleKey: "staff",
      roleNameCustomized: false, // F-003 (AC-1.5)
      emailMasked: `${invitee.email[0]}***@seed.test`,
      expiresAt: expect.any(String),
      status: "pending",
    });
    // Never the shop's id, never the full address, never the token back.
    assertNoForeignValues(res.body, [orgId, invitee.email, invited.token]);
    assertNoSecretFields(res.body);
    assertResponseHeaders(res, INVITATION_RESPONSE_HEADERS);
  });

  it("★ I-6: the token in the QUERY STRING is not read — the body is the only source", async () => {
    // A token in a query string is written to the access log, to every proxy in
    // front of us, and to the `Referer` of anything the invite page loads from
    // another origin. The endpoint must behave as if it were not sent at all.
    const { owner, orgId } = await newOrg();
    const staff = await roleNamed(orgId, "Staff");
    const invitee = await newUser();
    const invited = await invite(orgId, owner.accessToken, invitee.email, staff.id);

    const res = await request(app.server())
      .post(`/invitations/preview?token=${encodeURIComponent(invited.token)}`)
      .set("X-Forwarded-For", freshIp())
      .set("Content-Type", "application/json")
      .send({});
    assertErrorEnvelope(res, { status: 422, code: "VALIDATION_FAILED" });
    expect(res.body.error.fieldErrors.token).toBeTruthy();
    // …and the refusal does not echo the credential back.
    assertNoForeignValues(res.body, [invited.token]);

    // The control: the SAME token in the body works, so the 422 above is about
    // where it was, not about the token being bad.
    expect((await previewReq({ token: invited.token })).status).toBe(200);
  });

  it("★ an unknown token and a ROTATED one are the same refusal, byte for byte", async () => {
    const { owner, orgId } = await newOrg();
    const staff = await roleNamed(orgId, "Staff");
    const invitee = await newUser();
    const invited = await invite(orgId, owner.accessToken, invitee.email, staff.id);

    // Rotate: §3.12 overwrites `tokenHash`, so the old link resolves to nothing.
    const reissued = await request(app.server())
      .post(`/orgs/${orgId}/invitations/${invited.invitationId}/link`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send();
    // api-spec §3.12 — 200: an existing invitation's token is rotated, nothing
    // is created. (T-002-19 shipped 201; corrected to the locked contract.)
    expect(reissued.status).toBe(200);

    const rotated = await previewReq({ token: invited.token });
    const invented = await previewReq({ token: "this-token-was-never-issued-at-all" });
    assertErrorEnvelope(rotated, { status: 404, code: "INVITATION_INVALID" });
    // Same status, same body, DIFFERENT traceId — nothing here says "this
    // secret used to be real", which is the only fact a miner could collect.
    assertIdenticalErrorBodies(rotated, invented);

    // The control: the NEW token works, so the two 404s are not "the endpoint is
    // broken".
    expect((await previewReq({ token: reissued.body.token as string })).status).toBe(200);
  });

  it("★ a token that DID resolve gets its precise state (cancelled ≠ expired ≠ accepted)", async () => {
    const { owner, orgId } = await newOrg();
    const staff = await roleNamed(orgId, "Staff");
    const invitee = await newUser();
    const invited = await invite(orgId, owner.accessToken, invitee.email, staff.id);

    const cancelled = await request(app.server())
      .delete(`/orgs/${orgId}/invitations/${invited.invitationId}`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(cancelled.status).toBe(200);

    const res = await previewReq({ token: invited.token });
    // Not a leak: the caller presented a 256-bit secret that matched a stored
    // HMAC, so they learn nothing they did not hold — and AC US-4 needs the
    // distinction, because each state has a different next step on screen.
    assertErrorEnvelope(res, { status: 409, code: "INVITATION_CANCELLED" });
  });

  it("★ an EXPIRED link says so — expiry is derived, with no job to lag behind", async () => {
    const org = await kit.createOrg();
    const invitee = await kit.createUser();
    const issuedAt = new Date(Date.now() - 8 * 86_400_000);
    const seeded = await kit.createInvitation({
      organizationId: org.id,
      email: invitee.email,
      roleId: org.roles.Staff.id,
      tokenIssuedAt: issuedAt,
      expiresAt: new Date(issuedAt.getTime() + 168 * 3_600_000), // already past
    });
    const res = await previewReq({ token: seeded.rawToken });
    assertErrorEnvelope(res, { status: 409, code: "INVITATION_EXPIRED" });
    // The stored status is still `pending` — nothing wrote to say it died.
    const row = await prisma.invitation.findUniqueOrThrow({ where: { id: seeded.id } });
    expect(row.status).toBe("pending");
  });

  // ── the public quota (architecture §8 · api-spec §19) ────────────────────

  it("★ the per-IP quota bites, is SHARED with accept, and binds only that IP", async () => {
    // ONE exhaustion loop, three properties. The loop is the expensive part of
    // this suite (every request is a real HTTP round trip against a real
    // Redis), and running it three times to assert three things would add load
    // to a lane that already runs five int suites in parallel.
    const ip = freshIp();
    const user = await newUser();
    for (let i = 0; i < PUBLIC_RULE.limit; i++) {
      const res = await previewReq({ token: `guess-number-${i}` }, ip);
      // 404s count: guessing IS the traffic this quota exists to stop.
      expect(res.status, `request ${i + 1} of ${PUBLIC_RULE.limit}`).toBe(404);
    }

    // (1) it bites — the only bound there is on an unauthenticated route.
    const refused = await previewReq({ token: "guess-one-too-many" }, ip);
    assertErrorEnvelope(refused, { status: 429, code: "RATE_LIMITED" });
    // Mobile does `sleep(Number(retryAfter))`: "0" is a tight retry loop and a
    // decimal is NaN-adjacent in some clients.
    expect(refused.headers["retry-after"]).toMatch(/^[1-9]\d*$/);
    expect(Number(refused.headers["retry-after"])).toBeLessThanOrEqual(PUBLIC_RULE.windowSec);

    // (2) preview and accept share ONE bucket (api-spec §19: "preview+accept
    // 30/ชม./IP"). Two separate quotas would double an enumerator's allowance
    // for free.
    assertErrorEnvelope(await acceptReq({ token: "anything" }, user.accessToken, ip), {
      status: 429,
      code: "RATE_LIMITED",
    });

    // …and BOTH endpoints counted into the SAME key, which is the mechanical
    // form of "one bucket". `KEYS` takes a pattern, so ioredis does not apply
    // the client's prefix to it — the full name is spelled out here, which also
    // pins that the bucket is keyed by the raw IPv4 address (`clientIpKey`
    // collapses IPv6 to /64 and leaves IPv4 alone).
    const buckets = await redis.keys(
      `${REDIS_KEY_PREFIX}${ORG_RATE_LIMIT_PREFIX}publicInvitationEntry:i:${ip}`,
    );
    expect(buckets).toHaveLength(1);
    expect(Number(await redis.get(`${ORG_RATE_LIMIT_PREFIX}publicInvitationEntry:i:${ip}`))).toBe(
      PUBLIC_RULE.limit + 2,
    );

    // (3) …and it is PER IP. If the key collapsed to something shared, the
    // first enumerator would take the invite page down for every invitee in the
    // world, and nothing else in the suite would notice.
    expect((await previewReq({ token: "a-bystander-clicks-their-link" }, freshIp())).status).toBe(
      404,
    );
  });

  // ── §3.15 accept ─────────────────────────────────────────────────────────

  it("★ joins the shop, and records the account-age snapshot (§3.10 flag)", async () => {
    const { owner, orgId } = await newOrg();
    const staff = await roleNamed(orgId, "Staff");
    // Invite FIRST, then make the account — the "someone signed up to claim a
    // link" ordering the flag exists to expose (I-7/NEW-9). Explicit timestamps,
    // no fake timers (Postgres' now() ignores them anyway).
    const placeholderEmail = `t20-late-${Date.now()}@seed.test`;
    const invited = await invite(orgId, owner.accessToken, placeholderEmail, staff.id);
    const invitee = await newUser({
      email: placeholderEmail,
      createdAt: new Date(invited.createdAt.getTime() + 1000),
    });

    const events = collectSecurityEvents(app.events);
    let res;
    try {
      res = await acceptReq({ token: invited.token }, invitee.accessToken);
      expect(res.status).toBe(200);
      const accepted = events.ofType("org.invitation.accepted");
      expect(accepted).toHaveLength(1);
      // Assert on the PAYLOAD, never the whole event: the envelope carries an
      // epoch-millis `at` that collides with numeric fragments at random.
      expect(accepted[0].payload).toMatchObject({
        userId: invitee.id,
        organizationId: orgId,
        invitationId: invited.invitationId,
        roleId: staff.id,
      });
      // Nobody was revoked, so this must NOT be reported as a comeback.
      expect(events.ofType("org.member.reactivated")).toHaveLength(0);
    } finally {
      events.stop();
    }

    expect(res.body).toEqual({
      organization: { id: orgId, name: "ร้านรับคำเชิญ" },
      membership: {
        roleId: staff.id,
        roleName: "Staff",
        roleKey: "staff",
        roleNameCustomized: false, // F-003 (AC-1.5)
        status: "active",
      },
    });
    assertResponseHeaders(res, INVITATION_RESPONSE_HEADERS);
    assertNoSecretFields(res.body);

    const membership = await prisma.membership.findUniqueOrThrow({
      where: { organizationId_userId: { organizationId: orgId, userId: invitee.id } },
    });
    expect(membership).toMatchObject({ status: "active", roleId: staff.id, revokedAt: null });

    const row = await prisma.invitation.findUniqueOrThrow({ where: { id: invited.invitationId } });
    expect(row.status).toBe("accepted");
    expect(row.acceptedByUserId).toBe(invitee.id);
    // A SNAPSHOT, not a join: it must still answer after the user is deleted
    // under PDPA.
    expect(row.acceptedUserCreatedAt?.toISOString()).toBe(
      (await prisma.user.findUniqueOrThrow({ where: { id: invitee.id } })).createdAt.toISOString(),
    );

    // …and the inviter can SEE it, flag included (api-spec §3.10 / I-17e).
    const list = await request(app.server())
      .get(`/orgs/${orgId}/invitations?status=accepted`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body.items[0]).toMatchObject({
      id: invited.invitationId,
      status: "accepted",
      acceptedByUserId: invitee.id,
      acceptedUserCreatedAfterInvite: true,
    });
  });

  it("★ I-3: `X-Organization-Id` for ANOTHER shop changes nothing at all", async () => {
    // The exact attack I-3 was written against: the caller is a legitimate
    // member of `other`, and asks for the membership to be written there. The
    // org must come from the invitation ROW, and only from it.
    const { owner, orgId } = await newOrg("ร้านคำเชิญจริง");
    const staff = await roleNamed(orgId, "Staff");
    const other = await newOrg("ร้านที่ผู้เรียกเลือกเอง");
    const invitee = { ...other.owner };
    const invited = await invite(orgId, owner.accessToken, invitee.email, staff.id);

    const withHeader = await request(app.server())
      .post("/invitations/accept")
      .set("X-Forwarded-For", freshIp())
      .set("Authorization", `Bearer ${invitee.accessToken}`)
      .set("X-Organization-Id", other.orgId)
      .set("Content-Type", "application/json")
      .send({ token: invited.token });

    expect(withHeader.status).toBe(200);
    expect(withHeader.body.organization.id).toBe(orgId);
    expect(JSON.stringify(withHeader.body)).not.toContain(other.orgId);
    // One new membership, in the invitation's shop. The caller's role in the
    // shop they NAMED is untouched (they are still its Owner).
    const memberships = await prisma.membership.findMany({
      where: { userId: invitee.id },
      select: { organizationId: true, roleId: true, status: true },
    });
    expect(memberships).toHaveLength(2);
    expect(memberships.find((m) => m.organizationId === orgId)).toMatchObject({
      roleId: staff.id,
      status: "active",
    });
    const ownerRoleInOther = await roleNamed(other.orgId, "Owner");
    expect(memberships.find((m) => m.organizationId === other.orgId)).toMatchObject({
      roleId: ownerRoleInOther.id,
      status: "active",
    });
  });

  it("★ 409 ALREADY_MEMBER does NOT overwrite the caller's role (I-9)", async () => {
    // The draft this replaced upserted, which made "accept a Staff invitation" a
    // way for the last Owner to demote themselves — leaving a shop with zero
    // Owners, which is unrecoverable in Phase 0.
    const { owner, orgId } = await newOrg();
    const staff = await roleNamed(orgId, "Staff");
    const ownerRole = await roleNamed(orgId, "Owner");
    const seeded = await kit.createInvitation({
      organizationId: orgId,
      email: owner.email,
      roleId: staff.id,
    });

    const res = await acceptReq({ token: seeded.rawToken }, owner.accessToken);
    assertErrorEnvelope(res, { status: 409, code: "ALREADY_MEMBER" });

    const membership = await prisma.membership.findUniqueOrThrow({
      where: { organizationId_userId: { organizationId: orgId, userId: owner.id } },
    });
    expect(membership.roleId).toBe(ownerRole.id);
    expect(membership.status).toBe("active");
    // …and the dead invitation is closed rather than left offering a link that
    // can never do anything.
    const row = await prisma.invitation.findUniqueOrThrow({ where: { id: seeded.id } });
    expect(row.status).toBe("cancelled");
    expect(row.acceptedAt).toBeNull();
  });

  it("★ 409 INVITATION_SUPERSEDED when the link was issued BEFORE the removal (I-1)", async () => {
    const { orgId } = await newOrg();
    const staff = await roleNamed(orgId, "Staff");
    const removed = await newUser();
    const revokedAt = new Date(Date.now() - 60_000);
    await kit.addMember({
      organizationId: orgId,
      userId: removed.id,
      roleId: staff.id,
      status: "revoked",
      activatedAt: new Date(revokedAt.getTime() - 86_400_000),
      revokedAt,
    });
    const seeded = await kit.createInvitation({
      organizationId: orgId,
      email: removed.email,
      roleId: staff.id,
      // Handed out BEFORE they were removed — a link they kept.
      tokenIssuedAt: new Date(revokedAt.getTime() - 3_600_000),
    });

    const res = await acceptReq({ token: seeded.rawToken }, removed.accessToken);
    assertErrorEnvelope(res, { status: 409, code: "INVITATION_SUPERSEDED" });
    const membership = await prisma.membership.findUniqueOrThrow({
      where: { organizationId_userId: { organizationId: orgId, userId: removed.id } },
    });
    expect(membership.status).toBe("revoked");
    expect(membership.revokedAt?.toISOString()).toBe(revokedAt.toISOString());
  });

  it("★ a link issued AFTER the removal works, and says so with its own event", async () => {
    // I-1's other half: rotating/re-inviting after a removal is a conscious
    // decision by somebody holding `manage_members`, and it must be usable.
    const { owner, orgId } = await newOrg();
    const staff = await roleNamed(orgId, "Staff");
    const returning = await newUser();
    const revokedAt = new Date(Date.now() - 3_600_000);
    await kit.addMember({
      organizationId: orgId,
      userId: returning.id,
      roleId: staff.id,
      status: "revoked",
      activatedAt: new Date(revokedAt.getTime() - 86_400_000),
      revokedAt,
    });
    const seeded = await kit.createInvitation({
      organizationId: orgId,
      email: returning.email,
      roleId: staff.id,
      tokenIssuedAt: new Date(revokedAt.getTime() + 60_000),
      // F-003 D-035: the link is re-checked against whoever issued it — here
      // the Owner who re-invited. A row with NO issuer fails closed (I3-38 h).
      issuedByUserId: owner.id,
      invitedByUserId: owner.id,
    });

    const events = collectSecurityEvents(app.events);
    try {
      const res = await acceptReq({ token: seeded.rawToken }, returning.accessToken);
      expect(res.status).toBe(200);
      const reactivated = events.ofType("org.member.reactivated");
      expect(reactivated).toHaveLength(1);
      expect(reactivated[0].payload).toMatchObject({
        userId: returning.id,
        organizationId: orgId,
        roleId: staff.id,
        previousRevokedAt: revokedAt.toISOString(),
      });
      // BOTH events: "a removed person came back" is not the same signal as
      // "a new person joined", and one type cannot answer which happened.
      expect(events.ofType("org.invitation.accepted")).toHaveLength(1);
    } finally {
      events.stop();
    }

    const memberships = await prisma.membership.findMany({
      where: { organizationId: orgId, userId: returning.id },
    });
    expect(memberships).toHaveLength(1); // woken up, never duplicated
    expect(memberships[0]).toMatchObject({
      status: "active",
      revokedAt: null,
      revokedByUserId: null,
    });
  });

  it("★ B-1 · a cross-org invitation can no longer EXIST — the state M-6 guarded against is unrepresentable", async () => {
    // This test used to seed an invitation pointing at another shop's role and
    // then prove the service refused it with `INVITATION_ROLE_UNAVAILABLE`.
    // Its comment said: "`Role.id` is a single-column foreign key, so the
    // database would happily accept a membership pointing at another tenant's
    // role. This check is the only thing that does not."
    //
    // That is no longer true, and the change is the point. Security review B-1
    // added a composite foreign key `(organizationId, roleId)` →
    // `Role(organizationId, id)`, so the row cannot be written at all — by the
    // service, by a seed, or by anything else holding a connection.
    //
    // A guard whose precondition has become unreachable should say so rather
    // than keep testing a state nobody can produce. So this now asserts the
    // unreachability, which is the stronger property.
    const { orgId } = await newOrg("ร้านที่ถูกเชิญ");
    const elsewhere = await newOrg("ร้านอื่น");
    const foreignRole = await roleNamed(elsewhere.orgId, "Staff");
    const invitee = await newUser();

    await expect(
      kit.createInvitation({
        organizationId: orgId,
        email: invitee.email,
        roleId: foreignRole.id,
      }),
    ).rejects.toThrow();

    expect(
      await prisma.invitation.count({ where: { organizationId: orgId, email: invitee.email } }),
    ).toBe(0);

    // The service's `INVITATION_ROLE_UNAVAILABLE` branch is NOT dead code: it
    // still answers "the role this invitation names no longer exists", which
    // F-003 makes reachable the day roles can be deleted. It simply no longer
    // has to be the only thing standing between a shop and another tenant's
    // capabilities.
  });

  it("★ the wrong account gets 403 + a MASKED address, never the address", async () => {
    const { owner, orgId } = await newOrg();
    const staff = await roleNamed(orgId, "Staff");
    const invitee = await newUser();
    const stranger = await newUser();
    const invited = await invite(orgId, owner.accessToken, invitee.email, staff.id);

    const res = await acceptReq({ token: invited.token }, stranger.accessToken);
    assertErrorEnvelope(res, { status: 403, code: "INVITATION_EMAIL_MISMATCH" });
    expect(res.body.error.details.emailMasked).toBe(`${invitee.email[0]}***@seed.test`);
    // Whoever holds this link may not be its owner (architecture §7.6): the mask
    // is enough to pick the right account, and is not an address.
    assertNoForeignValues(res.body, [invitee.email]);
    expect(
      await prisma.membership.count({ where: { organizationId: orgId, userId: stranger.id } }),
    ).toBe(0);
  });

  it("★ accept requires a token — @UserScoped(), so 401 without one", async () => {
    const res = await acceptReq({ token: "anything-at-all" });
    assertErrorEnvelope(res, { status: 401, code: "UNAUTHENTICATED" });
  });

  it("★ I-6 on accept too: the token in the query string is not read", async () => {
    const { owner, orgId } = await newOrg();
    const staff = await roleNamed(orgId, "Staff");
    const invitee = await newUser();
    const invited = await invite(orgId, owner.accessToken, invitee.email, staff.id);

    const res = await request(app.server())
      .post(`/invitations/accept?token=${encodeURIComponent(invited.token)}`)
      .set("X-Forwarded-For", freshIp())
      .set("Authorization", `Bearer ${invitee.accessToken}`)
      .set("Content-Type", "application/json")
      .send({});
    assertErrorEnvelope(res, { status: 422, code: "VALIDATION_FAILED" });
    assertNoForeignValues(res.body, [invited.token]);
    expect(
      await prisma.membership.count({ where: { organizationId: orgId, userId: invitee.id } }),
    ).toBe(0);
  });

  // ── concurrency (test-plan I-C-02) ───────────────────────────────────────

  it("★ the same link accepted TWICE AT ONCE produces exactly ONE membership", async () => {
    // Both requests want the same org anchor, so the second one evaluates the
    // invitation on the state the first one COMMITTED. No sleeps, no ordering
    // assumptions — that is the point.
    const { owner, orgId } = await newOrg();
    const staff = await roleNamed(orgId, "Staff");
    const invitee = await newUser();
    const invited = await invite(orgId, owner.accessToken, invitee.email, staff.id);

    const [a, b] = await Promise.all([
      acceptReq({ token: invited.token }, invitee.accessToken),
      acceptReq({ token: invited.token }, invitee.accessToken),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);
    const loser = a.status === 409 ? a : b;
    // Either answer is correct depending on which fact the loser read first;
    // what must NOT happen is two memberships or a 500.
    expect(["INVITATION_ALREADY_ACCEPTED", "ALREADY_MEMBER"]).toContain(loser.body.error.code);

    const memberships = await prisma.membership.findMany({
      where: { organizationId: orgId, userId: invitee.id },
    });
    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({ status: "active", roleId: staff.id });
    // …and the invitation is not left `pending` either way.
    const row = await prisma.invitation.findUniqueOrThrow({ where: { id: invited.invitationId } });
    expect(row.status).toBe("accepted");
  });

  // ── F-003 · T-003-B19 ★ D-035 (+ Addendum) — the issuer is re-checked ────
  // arch §6.1 / §13.7 · test-plan I3-38 (a)–(k), I3-40, I3-43. Every refusal
  // reads the row, the memberships and the event back; every block has an
  // allowed control, so a route that refuses everything cannot pass.
  describe("D-035 · accept re-checks whoever issued the CURRENT link (I3-38 · I3-40 · I3-43)", () => {
    const BLOCKED = "org.invitation.accept_blocked_inviter";
    let f3: F003SeedKit;
    let sink: SecurityEventCollector;

    beforeAll(() => {
      f3 = createF003SeedKit(prisma, { label: "b19" });
      sink = collectSecurityEvents(app.events);
    });
    afterAll(async () => {
      sink?.stop();
      if (f3) await f3.cleanup();
    });

    const bearer = (u: SeededUser) => `Bearer ${token(u.id)}`;
    const blockedFor = (invitationId: string) =>
      sink.ofType(BLOCKED).filter((e) => e.payload.invitationId === invitationId);

    async function member(org: SeededOrg, role: SeededRole): Promise<SeededUser> {
      const user = await f3.createUser();
      await f3.addMember({ organizationId: org.id, userId: user.id, roleId: role.id });
      return user;
    }
    async function shop() {
      const org = await f3.createOrg();
      const owner = await member(org, org.roles.Owner);
      const adminA = await member(org, org.roles.Admin);
      return { org, owner, adminA };
    }
    /** An invitation for a fresh invitee; `issuedBy` is required — null is a decision. */
    async function inviteFrom(
      org: SeededOrg,
      role: SeededRole,
      issuedBy: SeededUser | null,
      extra: { invitedBy?: SeededUser | null; tokenIssuedAt?: Date; expiresAt?: Date } = {},
    ) {
      const invitee = await f3.createUser();
      const inv = await f3.createInvitation({
        organizationId: org.id,
        email: invitee.email,
        roleId: role.id,
        issuedByUserId: issuedBy?.id ?? null,
        ...(extra.invitedBy !== undefined ? { invitedByUserId: extra.invitedBy?.id ?? null } : {}),
        ...(extra.tokenIssuedAt ? { tokenIssuedAt: extra.tokenIssuedAt } : {}),
        ...(extra.expiresAt ? { expiresAt: extra.expiresAt } : {}),
      });
      return { invitee, inv };
    }
    const acceptAs = (u: SeededUser, rawToken: string) =>
      acceptReq({ token: rawToken }, token(u.id));
    const patchMember = (org: SeededOrg, actor: SeededUser, target: SeededUser, roleId: string) =>
      request(app.server())
        .patch(`/orgs/${org.id}/members/${target.id}`)
        .set("Authorization", bearer(actor))
        .set("Content-Type", "application/json")
        .send({ roleId });
    const removeMember = (org: SeededOrg, actor: SeededUser, target: SeededUser) =>
      request(app.server())
        .delete(`/orgs/${org.id}/members/${target.id}`)
        .set("Authorization", bearer(actor));
    const reissue = (org: SeededOrg, actor: SeededUser, invitationId: string) =>
      request(app.server())
        .post(`/orgs/${org.id}/invitations/${invitationId}/link`)
        .set("Authorization", bearer(actor));
    const cancelInvitation = (org: SeededOrg, actor: SeededUser, invitationId: string) =>
      request(app.server())
        .delete(`/orgs/${org.id}/invitations/${invitationId}`)
        .set("Authorization", bearer(actor));
    async function demote(org: SeededOrg, owner: SeededUser, who: SeededUser, roleId: string) {
      const res = await patchMember(org, owner, who, roleId);
      expect(res.status, res.text).toBe(200);
    }

    /** The DATABASE's answer, never a status code's. */
    const rowOf = (id: string) =>
      prisma.invitation.findUniqueOrThrow({
        where: { id },
        select: { status: true, cancelledAt: true, issuedByUserId: true, invitedByUserId: true },
      });
    const activeIn = (orgId: string, userId: string) =>
      prisma.membership.count({ where: { organizationId: orgId, userId, status: "active" } });

    async function expectBlocked(
      org: SeededOrg,
      invitee: SeededUser,
      inv: { id: string; rawToken: string },
      reason: "inviter_not_active" | "inviter_not_authorized" | "inviter_exceeds",
      issuerUserId: string | null,
    ) {
      const res = await acceptAs(invitee, inv.rawToken);
      assertErrorEnvelope(res, { status: 409, code: "INVITATION_CANCELLED" });
      const row = await rowOf(inv.id);
      expect(row.status).toBe("cancelled");
      expect(row.cancelledAt).not.toBeNull();
      expect(await activeIn(org.id, invitee.id)).toBe(0);
      const events = blockedFor(inv.id);
      expect(events).toHaveLength(1);
      expect(events[0]!.payload).toMatchObject({
        actorUserId: invitee.id,
        organizationId: org.id,
        invitationId: inv.id,
        issuerUserId,
        reason,
      });
      return res;
    }
    async function expectAccepted(
      org: SeededOrg,
      invitee: SeededUser,
      inv: { id: string; rawToken: string },
    ) {
      const res = await acceptAs(invitee, inv.rawToken);
      expect(res.status, res.text).toBe(200);
      expect((await rowOf(inv.id)).status).toBe("accepted");
      expect(await activeIn(org.id, invitee.id)).toBe(1);
      expect(blockedFor(inv.id)).toEqual([]);
    }

    it("I3-38(a) ★ D-035: issuer demoted to Staff → 409 INVITATION_CANCELLED byte-identical to an Owner-cancelled invitation · row cancelled · no membership · one event", async () => {
      const { org, owner, adminA } = await shop();
      const { invitee, inv } = await inviteFrom(org, org.roles.Admin, adminA);
      await demote(org, owner, adminA, org.roles.Staff.id);
      // Staff has no manage_members, and the floor is checked first (Addendum P2).
      const blocked = await expectBlocked(org, invitee, inv, "inviter_not_authorized", adminA.id);

      // The baseline: the SAME answer for an invitation the shop cancelled itself.
      const other = await inviteFrom(org, org.roles.Admin, owner);
      expect((await cancelInvitation(org, owner, other.inv.id)).status).toBe(200);
      const plain = await acceptAs(other.invitee, other.inv.rawToken);
      assertIdenticalErrorBodies(blocked, plain);
      expect(blocked.headers["content-length"]).toBe(plain.headers["content-length"]);
      expect(blocked.headers["content-type"]).toBe(plain.headers["content-type"]);
      expect(blockedFor(other.inv.id)).toEqual([]);
    });

    it("I3-38(a′) D-035: issuer moved to a role that keeps manage_members but ⊉ the invitation's role → inviter_exceeds + excess keys", async () => {
      const { org, owner, adminA } = await shop();
      const mm = await f3.createCustomRole({
        organizationId: org.id,
        name: "b19-mm",
        capabilities: ["manage_members", "manage_products"],
      });
      const { invitee, inv } = await inviteFrom(org, org.roles.Admin, adminA);
      await demote(org, owner, adminA, mm.id);
      await expectBlocked(org, invitee, inv, "inviter_exceeds", adminA.id);
      expect(blockedFor(inv.id)[0]!.payload.excessCapabilities).toContain("manage_orders");
    });

    it("I3-38(b) D-035: issuer removed by the Owner, or left on their own → inviter_not_active", async () => {
      const { org, owner, adminA } = await shop();
      const adminB = await member(org, org.roles.Admin);
      const byA = await inviteFrom(org, org.roles.Staff, adminA);
      const byB = await inviteFrom(org, org.roles.Staff, adminB);
      expect((await removeMember(org, owner, adminA)).status).toBe(200); // removed
      expect((await removeMember(org, adminB, adminB)).status).toBe(200); // left
      await expectBlocked(org, byA.invitee, byA.inv, "inviter_not_active", adminA.id);
      await expectBlocked(org, byB.invitee, byB.inv, "inviter_not_active", adminB.id);
    });

    it("I3-38(c) D-035: the issuer's ROLE loses a cap (membership untouched) → refused", async () => {
      const { org, adminA } = await shop();
      const adminCopy = await f3.createCustomRole({
        organizationId: org.id,
        name: "b19-admin-copy",
        capabilities: org.roles.Admin.capabilities,
      });
      await f3.setMembershipRole(org.id, adminA.id, adminCopy.id);
      const { invitee, inv } = await inviteFrom(org, org.roles.Admin, adminA);
      const membershipBefore = await prisma.membership.findUniqueOrThrow({
        where: { organizationId_userId: { organizationId: org.id, userId: adminA.id } },
      });
      await prisma.role.update({
        where: { id: adminCopy.id },
        data: { capabilities: adminCopy.capabilities.filter((c) => c !== "manage_orders") },
      });
      await expectBlocked(org, invitee, inv, "inviter_exceeds", adminA.id);
      expect(
        await prisma.membership.findUniqueOrThrow({
          where: { organizationId_userId: { organizationId: org.id, userId: adminA.id } },
        }),
      ).toEqual(membershipBefore);
    });

    it("I3-38(d) D-035: an Owner-issued link always passes (Owner and Admin invitations)", async () => {
      const { org, owner } = await shop();
      const ownerInv = await inviteFrom(org, org.roles.Owner, owner);
      const adminInv = await inviteFrom(org, org.roles.Admin, owner);
      await expectAccepted(org, ownerInv.invitee, ownerInv.inv);
      await expectAccepted(org, adminInv.invitee, adminInv.inv);
    });

    it("I3-38(e) ★ D-035 (MUT-05): A creates → A demoted → OWNER reissues → accept passes (issuedByUserId = Owner)", async () => {
      const { org, owner, adminA } = await shop();
      const { invitee, inv } = await inviteFrom(org, org.roles.Admin, adminA);
      await demote(org, owner, adminA, org.roles.Staff.id);
      const re = await reissue(org, owner, inv.id);
      expect(re.status, re.text).toBe(200);
      expect(await rowOf(inv.id)).toMatchObject({
        issuedByUserId: owner.id,
        invitedByUserId: adminA.id,
      });
      await expectAccepted(org, invitee, { id: inv.id, rawToken: re.body.token as string });
    });

    it("I3-38(f) D-035: wrong email + demoted issuer → INVITATION_EMAIL_MISMATCH and the invitation stays PENDING (a link holder cannot cancel it)", async () => {
      const { org, owner, adminA } = await shop();
      const { inv } = await inviteFrom(org, org.roles.Admin, adminA);
      await demote(org, owner, adminA, org.roles.Staff.id);
      const stranger = await f3.createUser();
      const res = await acceptAs(stranger, inv.rawToken);
      assertErrorEnvelope(res, { status: 403, code: "INVITATION_EMAIL_MISMATCH" });
      expect((await rowOf(inv.id)).status).toBe("pending");
      expect(blockedFor(inv.id)).toEqual([]);
    });

    it("I3-38(g) D-035: already a member + demoted issuer → the F-002 ALREADY_MEMBER answer, role untouched, no blocked event", async () => {
      const { org, owner, adminA } = await shop();
      const staff = await member(org, org.roles.Staff);
      const inv = await f3.createInvitation({
        organizationId: org.id,
        email: staff.email,
        roleId: org.roles.Admin.id,
        issuedByUserId: adminA.id,
      });
      await demote(org, owner, adminA, org.roles.Staff.id);
      const res = await acceptAs(staff, inv.rawToken);
      assertErrorEnvelope(res, { status: 409, code: "ALREADY_MEMBER" });
      expect(
        (
          await prisma.membership.findUniqueOrThrow({
            where: { organizationId_userId: { organizationId: org.id, userId: staff.id } },
          })
        ).roleId,
      ).toBe(org.roles.Staff.id);
      expect(blockedFor(inv.id)).toEqual([]);
    });

    it("I3-38(h) D-035: issuedByUserId AND invitedByUserId both null → refused (fail closed), issuerUserId null", async () => {
      const { org } = await shop();
      const { invitee, inv } = await inviteFrom(org, org.roles.Staff, null, { invitedBy: null });
      expect(await rowOf(inv.id)).toMatchObject({ issuedByUserId: null, invitedByUserId: null });
      await expectBlocked(org, invitee, inv, "inviter_not_active", null);
    });

    it("I3-38(i) ★ D-035 Addendum P2: issuer ⊇ the role but lost manage_members → inviter_not_authorized · control: keeps manage_members → passes", async () => {
      const { org, owner, adminA } = await shop();
      const adminB = await member(org, org.roles.Admin);
      const noMembers = await f3.createCustomRole({
        organizationId: org.id,
        name: "b19-staff-plus",
        capabilities: [...org.roles.Staff.capabilities, "view_financials"],
      });
      const withMembers = await f3.createCustomRole({
        organizationId: org.id,
        name: "b19-staff-mm",
        capabilities: [...org.roles.Staff.capabilities, "manage_members"],
      });
      const refused = await inviteFrom(org, org.roles.Staff, adminA);
      const allowed = await inviteFrom(org, org.roles.Staff, adminB);
      await demote(org, owner, adminA, noMembers.id);
      await demote(org, owner, adminB, withMembers.id);
      await expectBlocked(org, refused.invitee, refused.inv, "inviter_not_authorized", adminA.id);
      await expectAccepted(org, allowed.invitee, allowed.inv);
    });

    it("I3-38(j) ★ D-035 (MUT-05): Owner creates → A reissues → A demoted → accept REFUSED (the latest issuer is judged)", async () => {
      const { org, owner, adminA } = await shop();
      const { invitee, inv } = await inviteFrom(org, org.roles.Admin, owner);
      const re = await reissue(org, adminA, inv.id);
      expect(re.status, re.text).toBe(200);
      expect(await rowOf(inv.id)).toMatchObject({
        issuedByUserId: adminA.id,
        invitedByUserId: owner.id,
      });
      await demote(org, owner, adminA, org.roles.Staff.id);
      await expectBlocked(
        org,
        invitee,
        { id: inv.id, rawToken: re.body.token as string },
        "inviter_not_authorized",
        adminA.id,
      );
    });

    it("I3-38(k) D-035 control: an issuer who still may grant the role → accepted", async () => {
      const { org, adminA } = await shop();
      const admin = await inviteFrom(org, org.roles.Admin, adminA);
      const staff = await inviteFrom(org, org.roles.Staff, adminA);
      await expectAccepted(org, admin.invitee, admin.inv);
      await expectAccepted(org, staff.invitee, staff.inv);
    });

    it("I3-40 D-035: preview does not re-check — pending, then accept = INVITATION_CANCELLED (same copy), then preview agrees", async () => {
      const { org, owner, adminA } = await shop();
      const { invitee, inv } = await inviteFrom(org, org.roles.Admin, adminA);
      await demote(org, owner, adminA, org.roles.Staff.id);
      const before = await previewReq({ token: inv.rawToken });
      expect(before.status, before.text).toBe(200);
      expect(before.body.status).toBe("pending");
      const blocked = await expectBlocked(org, invitee, inv, "inviter_not_authorized", adminA.id);

      const other = await inviteFrom(org, org.roles.Staff, owner);
      expect((await cancelInvitation(org, owner, other.inv.id)).status).toBe(200);
      assertIdenticalErrorBodies(blocked, await acceptAs(other.invitee, other.inv.rawToken));

      const after = await previewReq({ token: inv.rawToken });
      assertErrorEnvelope(after, { status: 409, code: "INVITATION_CANCELLED" });
      assertIdenticalErrorBodies(after, await previewReq({ token: other.inv.rawToken }));
    });

    it("I3-43 layer 2: stored expiry past the clamp + elevated role + token older than 24h → INVITATION_EXPIRED (still pending) · control: Staff with the same clock → 200", async () => {
      const { org, owner } = await shop();
      const issuedAt = new Date(Date.now() - 25 * 3_600_000);
      const farFuture = new Date(Date.now() + 5 * 24 * 3_600_000);
      const admin = await inviteFrom(org, org.roles.Admin, owner, { tokenIssuedAt: issuedAt });
      const staff = await inviteFrom(org, org.roles.Staff, owner, { tokenIssuedAt: issuedAt });
      await f3.setInvitationExpiry(org.id, admin.inv.id, farFuture);
      await f3.setInvitationExpiry(org.id, staff.inv.id, farFuture);

      const res = await acceptAs(admin.invitee, admin.inv.rawToken);
      assertErrorEnvelope(res, { status: 409, code: "INVITATION_EXPIRED" });
      expect((await rowOf(admin.inv.id)).status).toBe("pending");
      expect(await activeIn(org.id, admin.invitee.id)).toBe(0);
      expect(blockedFor(admin.inv.id)).toEqual([]);

      await expectAccepted(org, staff.invitee, staff.inv);
    });
  });
});
