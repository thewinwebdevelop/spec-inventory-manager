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
import { createSeedKit, type SeedKit } from "./f002-seed.kit";

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
      membership: { roleId: staff.id, roleName: "Staff", roleKey: "staff", status: "active" },
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
    const { orgId } = await newOrg();
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
    expect(memberships[0]).toMatchObject({ status: "active", revokedAt: null, revokedByUserId: null });
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
});
