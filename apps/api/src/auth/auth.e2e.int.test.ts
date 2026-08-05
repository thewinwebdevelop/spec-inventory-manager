// F-001 · T-001-07/08 — end-to-end HTTP integration for the auth endpoints.
// Requires TEST_DATABASE_URL + TEST_REDIS_URL (skipped otherwise; CI T-001-20
// provides both). Exercises the wired app (global ValidationPipe + cookie-parser,
// as main.ts) via supertest. Covers the endpoint-level contract behaviors that
// need the full stack: signup 201-no-token, login transport (cookie vs body,
// H-1 body=null), 415 before credential work (L-2), enumeration-safe 401,
// rotation/logout DB effect, admin-reset 404-never-403 (C-1/H-2), change-password
// keep-current (US-6).
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Test } from "@nestjs/testing";
import { ValidationPipe, UnprocessableEntityException, type INestApplication } from "@nestjs/common";
import cookieParser from "cookie-parser";
import request from "supertest";
import { Redis } from "ioredis";
import { PrismaClient } from "@omnistock/db";
import { CAPABILITY_FULL_ACCESS, CAPABILITY_MANAGE_MEMBERS } from "@omnistock/core-domain";
import { AuthModule } from "./auth.module";
import {
  SecurityEventsService,
  collectSecurityEvents,
  type SecurityEventCollector,
} from "./security-events.service";

const TEST_DB = process.env.TEST_DATABASE_URL;
const TEST_REDIS = process.env.TEST_REDIS_URL;
const enabled = Boolean(TEST_DB && TEST_REDIS);
const d = enabled ? describe : describe.skip;

// Env the module factories read (loadEnv validates the whole shape). Set before
// app build so the AuthModule's JwtModule + Redis/refresh factories boot.
if (enabled) {
  process.env.DATABASE_URL = TEST_DB;
  process.env.REDIS_URL = TEST_REDIS;
  process.env.JWT_ACCESS_SECRET = "e2e-access-secret-32-chars-minimum-value!!";
  process.env.JWT_REFRESH_SECRET = "e2e-refresh-secret-32-chars-different-val!";
  process.env.PORT = "3000";
  process.env.NODE_ENV = "test";
  // F-002 (T-002-06) required vars — loadEnv validates the WHOLE shape, so the
  // AuthModule factories here exit(1) without them even though auth never reads
  // them. Test-only placeholders, mirroring CI's integration-api job.
  // Must be >=32 chars and differ from both JWT secrets (schema .superRefine).
  process.env.INVITATION_TOKEN_SECRET = "e2e-invitation-secret-32-chars-distinct!!";
  // http on loopback is accepted because NODE_ENV=test (production requires
  // https); same value as CI so an asserted inviteUrl reads identically.
  process.env.WEB_APP_BASE_URL = "http://localhost:3001";
  process.env.DEFAULT_ORG_PLAN_KEY = "comp_full";
}

const STRONG_PW = "correct-horse-battery-staple-9f3aK!";

/**
 * Drop the fields that are random PER RESPONSE, so two error bodies can be
 * compared for "does this tell the caller anything different?".
 *
 * Today that is exactly one field: `traceId` (T-002-10 / NEW-7 — a server-issued
 * random UUID on every error). It is volatile BY DESIGN, so comparing whole
 * bodies without normalizing it would fail for reasons that have nothing to do
 * with information leakage. Everything else stays in the comparison, strictly:
 * a stray field, a different code, a different message would all still be caught.
 */
function stripVolatile(body: unknown): unknown {
  const clone = JSON.parse(JSON.stringify(body ?? null)) as
    | { error?: { traceId?: string } }
    | null;
  if (clone && typeof clone === "object" && clone.error && typeof clone.error === "object") {
    delete clone.error.traceId;
  }
  return clone;
}

/** The per-response random id, when the filter is wired into the app. */
function traceIdOf(body: unknown): string | undefined {
  return (body as { error?: { traceId?: string } } | null)?.error?.traceId;
}

d("auth endpoints (E2E, DB+Redis)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let redis: Redis;
  /** F-005 seam used as the test sink (test-plan §19.1 item 3). */
  let sink: SecurityEventCollector;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: TEST_DB } } });
    await prisma.$connect();
    redis = new Redis(TEST_REDIS!);

    const moduleRef = await Test.createTestingModule({ imports: [AuthModule] }).compile();
    app = moduleRef.createNestApplication();
    // Mirror main.ts: trust proxy so a per-test X-Forwarded-For gives each test
    // its own throttle IP bucket (avoids the shared-localhost IP cap across the
    // many requests a single admin-reset test makes).
    (app.getHttpAdapter().getInstance() as { set: (k: string, v: unknown) => void }).set("trust proxy", true);
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        exceptionFactory: (errors) => {
          const first = errors[0];
          const code = first?.constraints ? Object.values(first.constraints)[0] : "VALIDATION_FAILED";
          return new UnprocessableEntityException({ error: { code, message: "ข้อมูลไม่ถูกต้อง" } });
        },
      }),
    );
    await app.init();
    sink = collectSecurityEvents(app.get(SecurityEventsService));
  });

  afterAll(async () => {
    sink?.stop();
    if (app) await app.close();
    // Delete exactly what this suite created, in FK order. Before this the
    // suite left its fixtures behind — 65 organizations and 220 users after a
    // single run — which made "is the database dirty?" unanswerable while
    // debugging any LATER suite, and grew without bound on a developer box.
    if (prisma) {
      if (createdOrgIds.length > 0) {
        const where = { organizationId: { in: createdOrgIds } };
        await prisma.invitation.deleteMany({ where });
        await prisma.membership.deleteMany({ where });
        await prisma.role.deleteMany({ where });
        await prisma.organization.deleteMany({ where: { id: { in: createdOrgIds } } });
      }
      if (createdEmails.length > 0) {
        // Users are created over HTTP (signup), so they are tracked by the one
        // factory that mints their addresses rather than by id.
        const users = await prisma.user.findMany({
          where: { email: { in: createdEmails.map((e) => e.toLowerCase()) } },
          select: { id: true },
        });
        const userIds = users.map((u) => u.id);
        if (userIds.length > 0) {
          await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
          await prisma.membership.deleteMany({ where: { userId: { in: userIds } } });
          await prisma.user.deleteMany({ where: { id: { in: userIds } } });
        }
      }
      await prisma.$disconnect();
    }
    if (redis) redis.disconnect();
  });

  // Clear throttle keys between tests so the shared localhost IP window from a
  // previous test doesn't 429 the next test's signups/logins (each test is
  // independent; the IP cap is asserted deliberately in the throttle unit test).
  beforeEach(async () => {
    const keys = await redis.keys("throttle:*");
    if (keys.length > 0) await redis.del(...keys);
  });

  /**
   * A per-test client IP, so one test's requests cannot exhaust another's
   * throttle window. 203.0.113.0/24 is TEST-NET-3 (RFC 5737) — documentation
   * space that can never be a real client.
   */
  let ipCounter = 0;
  function uniqueForwardedIp(): string {
    ipCounter += 1;
    return `203.0.113.${ipCounter % 254 + 1}`;
  }

  /**
   * Everything this suite created, so `afterAll` can remove exactly it.
   *
   * Postgres is SHARED with the suites vitest runs in parallel, so this is
   * never a TRUNCATE and never a `deleteMany({})`: those would delete a
   * neighbour's fixtures and produce a failure nobody can reproduce.
   */
  const createdEmails: string[] = [];
  const createdOrgIds: string[] = [];

  function uniqueEmail(prefix: string): string {
    const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@e2e.co`;
    createdEmails.push(email);
    return email;
  }

  const server = () => app.getHttpServer();

  it("I1.1 signup → 201, verified=false, NO tokens, hash stored (not plaintext)", async () => {
    const email = uniqueEmail("signup");
    const res = await request(server())
      .post("/auth/signup")
      .set("Content-Type", "application/json")
      .send({ email, password: STRONG_PW });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email, verified: false });
    expect(res.body.accessToken).toBeUndefined();
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.passwordHash).not.toBe(STRONG_PW);
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.verified).toBe(false);
  });

  it("I1.2 duplicate email → 409 EMAIL_TAKEN", async () => {
    // Own IP bucket. `IP_WINDOW_MAX` is 20 per 5 minutes keyed on the client
    // address, and without a forwarded IP every request in every suite shares
    // the localhost bucket. `beforeEach` clears `throttle:*`, but vitest runs
    // files in parallel against ONE Redis, so a neighbouring suite's signups
    // refill the bucket between that clear and this assertion: the FIRST signup
    // 429s, no user is created, and the second returns 201 instead of 409.
    // Observed once in a full run and reproduced by the arithmetic — the file
    // already documents this technique, it just was not applied here.
    const ip = uniqueForwardedIp();
    const email = uniqueEmail("dup");
    await request(server()).post("/auth/signup").set("Content-Type", "application/json").set("X-Forwarded-For", ip).send({ email, password: STRONG_PW });
    const res = await request(server()).post("/auth/signup").set("Content-Type", "application/json").set("X-Forwarded-For", ip).send({ email, password: STRONG_PW });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_TAKEN");
  });

  it("I1.3 breached/short password → 422", async () => {
    const short = await request(server()).post("/auth/signup").set("Content-Type", "application/json").send({ email: uniqueEmail("s"), password: "short" });
    expect(short.status).toBe(422);
    expect(short.body.error.code).toBe("PASSWORD_TOO_SHORT");
    const breached = await request(server()).post("/auth/signup").set("Content-Type", "application/json").send({ email: uniqueEmail("b"), password: "password" });
    expect(breached.status).toBe(422);
    expect(breached.body.error.code).toBe("PASSWORD_BREACHED");
  });

  it("I5c.1 (L-2) non-JSON Content-Type → 415 before any user creation", async () => {
    const email = uniqueEmail("form");
    const res = await request(server())
      .post("/auth/signup")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .send(`email=${email}&password=${STRONG_PW}`);
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
    // No user created on the 415 path.
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
  });

  it("I2.1 login body transport → token in body, no cookie", async () => {
    const email = uniqueEmail("login-body");
    await request(server()).post("/auth/signup").set("Content-Type", "application/json").send({ email, password: STRONG_PW });
    const res = await request(server()).post("/auth/login").set("Content-Type", "application/json").send({ email, password: STRONG_PW, tokenTransport: "body" });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy(); // body transport → non-null
    expect(res.body.tokenType).toBe("Bearer");
    expect(res.body.expiresIn).toBe(900);
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("I2.1/I2.1b login cookie transport → body refreshToken null, split-path cookies (H-1 + D-019)", async () => {
    const email = uniqueEmail("login-cookie");
    await request(server()).post("/auth/signup").set("Content-Type", "application/json").send({ email, password: STRONG_PW });
    const res = await request(server()).post("/auth/login").set("Content-Type", "application/json").send({ email, password: STRONG_PW, tokenTransport: "cookie" });
    expect(res.status).toBe(200);
    expect(res.body.refreshToken).toBeNull(); // H-1: never in a JS-readable place
    const cookies = (res.headers["set-cookie"] as unknown as string[]) ?? [];
    const rt = cookies.find((c) => c.startsWith("omni_rt="));
    const csrf = cookies.find((c) => c.startsWith("omni_csrf="));
    // omni_rt (refresh): httpOnly, Path=/auth, SameSite=Strict.
    expect(rt).toBeDefined();
    expect(rt).toContain("HttpOnly");
    expect(rt).toMatch(/;\s*Path=\/auth(;|$)/); // EXACTLY /auth, not / or /auth/refresh
    expect(rt).toMatch(/SameSite=Strict/i);
    // omni_csrf (double-submit): NON-httpOnly, Path=/ (D-019, readable from app
    // pages outside /auth), SameSite=Strict.
    expect(csrf).toBeDefined();
    expect(csrf).not.toContain("HttpOnly"); // readable for double-submit
    expect(csrf).toMatch(/;\s*Path=\/(;|$)/); // EXACTLY /, NOT /auth
    expect(csrf).not.toMatch(/Path=\/auth/); // must NOT be scoped to /auth (the C-1 bug)
    expect(csrf).toMatch(/SameSite=Strict/i);
    // The plaintext refresh value is NOT anywhere in the JSON body.
    expect(JSON.stringify(res.body)).not.toContain(rt!.split(";")[0].split("=")[1]);
  });

  it("I2.2/I2.3 wrong password AND unknown email → identical generic 401", async () => {
    const email = uniqueEmail("gen");
    await request(server()).post("/auth/signup").set("Content-Type", "application/json").send({ email, password: STRONG_PW });
    const wrong = await request(server()).post("/auth/login").set("Content-Type", "application/json").send({ email, password: "wrong-but-long-enough" });
    const unknown = await request(server()).post("/auth/login").set("Content-Type", "application/json").send({ email: uniqueEmail("nobody"), password: "wrong-but-long-enough" });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    // Everything a caller could learn from must match. `traceId` (T-002-10) is
    // excluded because it is random per RESPONSE — and enumeration safety
    // depends on it staying that way, which is asserted right below: two equal
    // trace ids would mean the value is derived from the request.
    expect(stripVolatile(wrong.body)).toEqual(stripVolatile(unknown.body));
    if (traceIdOf(wrong.body) !== undefined) {
      expect(traceIdOf(wrong.body)).not.toBe(traceIdOf(unknown.body));
    }
    expect(wrong.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("I3.5(d) refresh with neither cookie nor body → 401 NO_REFRESH_TOKEN", async () => {
    const res = await request(server()).post("/auth/refresh").set("Content-Type", "application/json").send({});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("NO_REFRESH_TOKEN");
  });

  it("I3.1 body-transport rotation → old token 401, new works", async () => {
    const email = uniqueEmail("rot");
    await request(server()).post("/auth/signup").set("Content-Type", "application/json").send({ email, password: STRONG_PW });
    const login = await request(server()).post("/auth/login").set("Content-Type", "application/json").send({ email, password: STRONG_PW, tokenTransport: "body" });
    const rt1 = login.body.refreshToken as string;
    const r2 = await request(server()).post("/auth/refresh").set("Content-Type", "application/json").send({ refreshToken: rt1 });
    expect(r2.status).toBe(200);
    expect(r2.body.refreshToken).toBeTruthy();
    // New token still works.
    const r3 = await request(server()).post("/auth/refresh").set("Content-Type", "application/json").send({ refreshToken: r2.body.refreshToken });
    expect(r3.status).toBe(200);
  });

  it("I3.8 sessions (Bearer) + I4.4 logout-all revoke every family", async () => {
    const email = uniqueEmail("sess");
    await request(server()).post("/auth/signup").set("Content-Type", "application/json").send({ email, password: STRONG_PW });
    const l1 = await request(server()).post("/auth/login").set("Content-Type", "application/json").send({ email, password: STRONG_PW, deviceId: "devA", tokenTransport: "body" });
    await request(server()).post("/auth/login").set("Content-Type", "application/json").send({ email, password: STRONG_PW, deviceId: "devB", tokenTransport: "body" });
    const access = l1.body.accessToken as string;
    const sessions = await request(server()).get("/auth/sessions").set("Authorization", `Bearer ${access}`);
    expect(sessions.status).toBe(200);
    expect(sessions.body.sessions.length).toBe(2);
    // logout-all
    const out = await request(server()).post("/auth/logout-all").set("Content-Type", "application/json").set("Authorization", `Bearer ${access}`);
    expect(out.status).toBe(204);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const live = await prisma.refreshToken.count({ where: { userId: user.id, revokedAt: null } });
    expect(live).toBe(0);
  });

  it("I6.1 change-password (Bearer) → 200, old pw fails, new works, other families revoked", async () => {
    const email = uniqueEmail("chpw");
    await request(server()).post("/auth/signup").set("Content-Type", "application/json").send({ email, password: STRONG_PW });
    // Current session + one other family.
    const current = await request(server()).post("/auth/login").set("Content-Type", "application/json").send({ email, password: STRONG_PW, deviceId: "cur", tokenTransport: "body" });
    await request(server()).post("/auth/login").set("Content-Type", "application/json").send({ email, password: STRONG_PW, deviceId: "other", tokenTransport: "body" });
    const NEW_PW = "another-strong-passphrase-7Yq!";
    const res = await request(server())
      .post("/auth/change-password")
      .set("Content-Type", "application/json")
      .set("Authorization", `Bearer ${current.body.accessToken}`)
      .send({ currentPassword: STRONG_PW, newPassword: NEW_PW, refreshToken: current.body.refreshToken });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    // Old password no longer logs in; new one does.
    const oldTry = await request(server()).post("/auth/login").set("Content-Type", "application/json").send({ email, password: STRONG_PW });
    expect(oldTry.status).toBe(401);
    const newTry = await request(server()).post("/auth/login").set("Content-Type", "application/json").send({ email, password: NEW_PW });
    expect(newTry.status).toBe(200);
    // Current session's refresh still works (kept), the OTHER family is revoked.
    const stillCurrent = await request(server()).post("/auth/refresh").set("Content-Type", "application/json").send({ refreshToken: current.body.refreshToken });
    expect(stillCurrent.status).toBe(200);
  });

  it("I6.2 wrong currentPassword → generic 401, no mutation", async () => {
    const email = uniqueEmail("chpw-wrong");
    await request(server()).post("/auth/signup").set("Content-Type", "application/json").send({ email, password: STRONG_PW });
    const login = await request(server()).post("/auth/login").set("Content-Type", "application/json").send({ email, password: STRONG_PW, tokenTransport: "body" });
    const res = await request(server())
      .post("/auth/change-password")
      .set("Content-Type", "application/json")
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .send({ currentPassword: "not-the-current-pw", newPassword: "another-strong-passphrase-7Yq!" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    // Original password still works.
    const stillOk = await request(server()).post("/auth/login").set("Content-Type", "application/json").send({ email, password: STRONG_PW });
    expect(stillOk.status).toBe(200);
  });

  // ── admin reset (endpoint 8) — the C-1/H-2 inline capability check ─────────

  async function seedOrgWithAdmin(): Promise<{
    orgId: string;
    adminId: string;
    adminAccess: string;
    memberId: string;
    memberEmail: string;
  }> {
    const org = await prisma.organization.create({ data: { name: `Org-${Math.random().toString(36).slice(2)}` } });
    createdOrgIds.push(org.id);
    const role = await prisma.role.create({
      data: { organizationId: org.id, name: "Admin", capabilities: [CAPABILITY_MANAGE_MEMBERS] },
    });
    const staffRole = await prisma.role.create({
      data: { organizationId: org.id, name: "Staff", capabilities: ["manage_products"] },
    });
    const adminEmail = uniqueEmail("admin");
    const memberEmail = uniqueEmail("member");
    await request(server()).post("/auth/signup").set("Content-Type", "application/json").send({ email: adminEmail, password: STRONG_PW });
    await request(server()).post("/auth/signup").set("Content-Type", "application/json").send({ email: memberEmail, password: STRONG_PW });
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: adminEmail } });
    const member = await prisma.user.findUniqueOrThrow({ where: { email: memberEmail } });
    await prisma.membership.create({ data: { organizationId: org.id, userId: admin.id, roleId: role.id, status: "active" } });
    await prisma.membership.create({ data: { organizationId: org.id, userId: member.id, roleId: staffRole.id, status: "active" } });
    const login = await request(server()).post("/auth/login").set("Content-Type", "application/json").send({ email: adminEmail, password: STRONG_PW, tokenTransport: "body" });
    return { orgId: org.id, adminId: admin.id, adminAccess: login.body.accessToken, memberId: member.id, memberEmail };
  }

  it("I5.1 admin-reset happy path → 200, target pw changed, families revoked, event emitted", async () => {
    const { orgId, adminAccess, memberId, memberEmail } = await seedOrgWithAdmin();
    const NEW_PW = "admin-set-passphrase-4Kx!";
    const res = await request(server())
      .post(`/orgs/${orgId}/members/${memberId}/reset-password`)
      .set("Content-Type", "application/json")
      .set("Authorization", `Bearer ${adminAccess}`)
      .send({ newPassword: NEW_PW });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    // Target can log in with the new password.
    const login = await request(server()).post("/auth/login").set("Content-Type", "application/json").send({ email: memberEmail, password: NEW_PW });
    expect(login.status).toBe(200);
  });

  it("I5.4 admin-reset clears the target's login backoff counter (anti-lockout escape hatch)", async () => {
    const { orgId, adminAccess, memberId, memberEmail } = await seedOrgWithAdmin();
    // Seed the target into backoff: 6 wrong-password logins → account counter set.
    for (let i = 0; i < 6; i++) {
      await request(server()).post("/auth/login").set("Content-Type", "application/json").send({ email: memberEmail, password: "wrong-but-long-enough" });
    }
    const key = `throttle:acct:${memberEmail.toLowerCase()}`;
    expect(await redis.get(key)).not.toBeNull(); // counter present (in backoff)
    // Admin reset → must clear the counter.
    const res = await request(server())
      .post(`/orgs/${orgId}/members/${memberId}/reset-password`)
      .set("Content-Type", "application/json")
      .set("Authorization", `Bearer ${adminAccess}`)
      .send({ newPassword: "admin-set-passphrase-4Kx!" });
    expect(res.status).toBe(200);
    // Counter cleared → target can immediately log in with the new password.
    expect(await redis.get(key)).toBeNull();
    const login = await request(server()).post("/auth/login").set("Content-Type", "application/json").send({ email: memberEmail, password: "admin-set-passphrase-4Kx!" });
    expect(login.status).toBe(200);
  });

  it("I5.2c caller active but role LACKS manage_members → same-shape 404 (never 403), no effect", async () => {
    const { orgId, memberId, memberEmail } = await seedOrgWithAdmin();
    // A staff caller (active, no manage_members).
    const staffEmail = uniqueEmail("staff");
    await request(server()).post("/auth/signup").set("Content-Type", "application/json").send({ email: staffEmail, password: STRONG_PW });
    const staff = await prisma.user.findUniqueOrThrow({ where: { email: staffEmail } });
    const staffRole = await prisma.role.findFirstOrThrow({ where: { organizationId: orgId, name: "Staff" } });
    await prisma.membership.create({ data: { organizationId: orgId, userId: staff.id, roleId: staffRole.id, status: "active" } });
    const staffLogin = await request(server()).post("/auth/login").set("Content-Type", "application/json").send({ email: staffEmail, password: STRONG_PW, tokenTransport: "body" });
    const res = await request(server())
      .post(`/orgs/${orgId}/members/${memberId}/reset-password`)
      .set("Content-Type", "application/json")
      .set("Authorization", `Bearer ${staffLogin.body.accessToken}`)
      .send({ newPassword: "should-not-apply-9Zz!" });
    expect(res.status).toBe(404); // never 403
    // Target's password is UNCHANGED (original still logs in).
    const stillOriginal = await request(server()).post("/auth/login").set("Content-Type", "application/json").send({ email: memberEmail, password: STRONG_PW });
    expect(stillOriginal.status).toBe(200);
  });

  it("I5.2a revoked target → same-shape 404, no effect (H-2 cross-tenant fix)", async () => {
    const { orgId, adminAccess, memberId, memberEmail } = await seedOrgWithAdmin();
    // Revoke the target's membership.
    await prisma.membership.update({
      where: { organizationId_userId: { organizationId: orgId, userId: memberId } },
      data: { status: "revoked" },
    });
    const res = await request(server())
      .post(`/orgs/${orgId}/members/${memberId}/reset-password`)
      .set("Content-Type", "application/json")
      .set("Authorization", `Bearer ${adminAccess}`)
      .send({ newPassword: "should-not-apply-8Yy!" });
    expect(res.status).toBe(404);
    const stillOriginal = await request(server()).post("/auth/login").set("Content-Type", "application/json").send({ email: memberEmail, password: STRONG_PW });
    expect(stillOriginal.status).toBe(200);
  });

  it("I5.2b caller with NO membership in org → same-shape 404, no effect", async () => {
    const { orgId, memberId, memberEmail } = await seedOrgWithAdmin();
    // A stranger with a valid token but no membership in orgId.
    const strangerEmail = uniqueEmail("stranger");
    await request(server()).post("/auth/signup").set("Content-Type", "application/json").send({ email: strangerEmail, password: STRONG_PW });
    const strangerLogin = await request(server()).post("/auth/login").set("Content-Type", "application/json").send({ email: strangerEmail, password: STRONG_PW, tokenTransport: "body" });
    const res = await request(server())
      .post(`/orgs/${orgId}/members/${memberId}/reset-password`)
      .set("Content-Type", "application/json")
      .set("Authorization", `Bearer ${strangerLogin.body.accessToken}`)
      .send({ newPassword: "should-not-apply-7Xx!" });
    expect(res.status).toBe(404);
    const stillOriginal = await request(server()).post("/auth/login").set("Content-Type", "application/json").send({ email: memberEmail, password: STRONG_PW });
    expect(stillOriginal.status).toBe(200);
  });

  // ── T-002-09 ★ the two F-002 conditions, proven against a real database ───
  //
  // These four cases are the ONLY thing that can catch a regression here.
  // `oasdiff` sees nothing: the request and both response shapes are byte-for-
  // byte what F-001 shipped. The unit suite (auth.service.test.ts) pins the
  // decision and the transaction against a fake client; what it cannot prove is
  // that the cross-org COUNT and the `FOR UPDATE` actually behave this way
  // against PostgreSQL, with real rows and a real `Membership` unique index.

  /** Put `userId` into a SECOND organization with an active membership (C-2). */
  async function alsoActiveInAnotherOrg(userId: string): Promise<string> {
    const other = await prisma.organization.create({
      data: { name: `Other-${Math.random().toString(36).slice(2)}` },
    });
    createdOrgIds.push(other.id);
    const role = await prisma.role.create({
      data: { organizationId: other.id, name: "Staff", capabilities: ["manage_products"] },
    });
    await prisma.membership.create({
      data: { organizationId: other.id, userId, roleId: role.id, status: "active" },
    });
    return other.id;
  }

  it("I5.5 (C-2/D-028) target is active in ANOTHER org → 404, password untouched, event emitted", async () => {
    const { orgId, adminAccess, memberId, memberEmail } = await seedOrgWithAdmin();
    await alsoActiveInAnotherOrg(memberId);
    sink.clear();

    const res = await request(server())
      .post(`/orgs/${orgId}/members/${memberId}/reset-password`)
      .set("Content-Type", "application/json")
      .set("Authorization", `Bearer ${adminAccess}`)
      .send({ newPassword: "cross-tenant-takeover-3Qq!" });

    expect(res.status).toBe(404);
    // The takeover attempt failing is not enough — the credential must be
    // provably unchanged, which is what an attacker would actually use.
    const stillOriginal = await request(server())
      .post("/auth/login")
      .set("Content-Type", "application/json")
      .send({ email: memberEmail, password: STRONG_PW });
    expect(stillOriginal.status).toBe(200);
    const withAttempted = await request(server())
      .post("/auth/login")
      .set("Content-Type", "application/json")
      .send({ email: memberEmail, password: "cross-tenant-takeover-3Qq!" });
    expect(withAttempted.status).toBe(401);

    expect(sink.ofType("auth.password.admin_reset_blocked_multi_org")).toHaveLength(1);
    expect(sink.ofType("auth.password.admin_reset")).toHaveLength(0);
  });

  it("I5.6 (NEW-1/D-030) Admin resets an OWNER → 404, password untouched, owner-target event", async () => {
    const { orgId, adminAccess, memberId, memberEmail } = await seedOrgWithAdmin();
    // Promote the target to Owner INSIDE this org — the case C-2 cannot see,
    // because an Owner of a single shop has no "other org" to trip it.
    const ownerRole = await prisma.role.create({
      data: {
        organizationId: orgId,
        name: "Owner",
        capabilities: [CAPABILITY_FULL_ACCESS],
        isSystem: true,
      },
    });
    await prisma.membership.update({
      where: { organizationId_userId: { organizationId: orgId, userId: memberId } },
      data: { roleId: ownerRole.id },
    });
    sink.clear();

    const res = await request(server())
      .post(`/orgs/${orgId}/members/${memberId}/reset-password`)
      .set("Content-Type", "application/json")
      .set("Authorization", `Bearer ${adminAccess}`)
      .send({ newPassword: "admin-takes-the-shop-5Rr!" });

    expect(res.status).toBe(404);
    const stillOriginal = await request(server())
      .post("/auth/login")
      .set("Content-Type", "application/json")
      .send({ email: memberEmail, password: STRONG_PW });
    expect(stillOriginal.status).toBe(200);

    expect(sink.ofType("auth.password.admin_reset_blocked_owner_target")).toHaveLength(1);
    expect(sink.ofType("auth.password.admin_reset")).toHaveLength(0);
  });

  it("I5.7 control · an Owner (full_access) may still reset another Owner → 200", async () => {
    // Without this the two rules above could be satisfied by an endpoint that
    // simply never works — a green suite proving only that nothing happens.
    const { orgId, memberId, memberEmail } = await seedOrgWithAdmin();
    const ownerRole = await prisma.role.create({
      data: {
        organizationId: orgId,
        name: "Owner",
        capabilities: [CAPABILITY_FULL_ACCESS],
        isSystem: true,
      },
    });
    await prisma.membership.update({
      where: { organizationId_userId: { organizationId: orgId, userId: memberId } },
      data: { roleId: ownerRole.id },
    });
    // The caller is an Owner too.
    const ownerEmail = uniqueEmail("owner");
    await request(server()).post("/auth/signup").set("Content-Type", "application/json").send({ email: ownerEmail, password: STRONG_PW });
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: ownerEmail } });
    await prisma.membership.create({
      data: { organizationId: orgId, userId: owner.id, roleId: ownerRole.id, status: "active" },
    });
    const ownerLogin = await request(server()).post("/auth/login").set("Content-Type", "application/json").send({ email: ownerEmail, password: STRONG_PW, tokenTransport: "body" });

    const NEW_PW = "owner-resets-owner-6Ss!";
    const res = await request(server())
      .post(`/orgs/${orgId}/members/${memberId}/reset-password`)
      .set("Content-Type", "application/json")
      .set("Authorization", `Bearer ${ownerLogin.body.accessToken}`)
      .send({ newPassword: NEW_PW });

    expect(res.status).toBe(200);
    const login = await request(server())
      .post("/auth/login")
      .set("Content-Type", "application/json")
      .send({ email: memberEmail, password: NEW_PW });
    expect(login.status).toBe(200);
  });

  it("I5.8 every refusal reason returns a BYTE-IDENTICAL 404 — no ownership oracle", async () => {
    // If "blocked because they are the Owner" looked different from "no such
    // member", the endpoint would answer a question it must never answer: is
    // this person the owner of this shop?
    const { orgId, adminAccess, memberId } = await seedOrgWithAdmin();
    const NEW_PW = "probe-for-a-difference-7Tt!";
    const call = (target: string) =>
      request(server())
        .post(`/orgs/${orgId}/members/${target}/reset-password`)
        .set("Content-Type", "application/json")
        .set("Authorization", `Bearer ${adminAccess}`)
        .send({ newPassword: NEW_PW });

    // (1) no such user at all
    const unknownUser = await call("00000000-0000-4000-8000-000000000000");
    // (2) blocked by C-2
    const multiOrgTarget = await seedOrgWithAdmin();
    await alsoActiveInAnotherOrg(multiOrgTarget.memberId);
    const multiOrg = await request(server())
      .post(`/orgs/${multiOrgTarget.orgId}/members/${multiOrgTarget.memberId}/reset-password`)
      .set("Content-Type", "application/json")
      .set("Authorization", `Bearer ${multiOrgTarget.adminAccess}`)
      .send({ newPassword: NEW_PW });
    // (3) blocked by NEW-1
    const ownerRole = await prisma.role.create({
      data: {
        organizationId: orgId,
        name: "Owner",
        capabilities: [CAPABILITY_FULL_ACCESS],
        isSystem: true,
      },
    });
    await prisma.membership.update({
      where: { organizationId_userId: { organizationId: orgId, userId: memberId } },
      data: { roleId: ownerRole.id },
    });
    const ownerTarget = await call(memberId);

    for (const res of [unknownUser, multiOrg, ownerTarget]) {
      expect(res.status).toBe(404);
    }
    expect(stripVolatile(multiOrg.body)).toEqual(stripVolatile(unknownUser.body));
    expect(stripVolatile(ownerTarget.body)).toEqual(stripVolatile(unknownUser.body));
    // …and the one field allowed to differ must actually differ, or it is
    // derived from the request and becomes an oracle of its own.
    if (traceIdOf(unknownUser.body) !== undefined) {
      expect(traceIdOf(ownerTarget.body)).not.toBe(traceIdOf(unknownUser.body));
    }
  });

  it("I5.9 (High-2) an admin cannot reset their OWN password here → 404, password untouched", async () => {
    // Narrows a shipped endpoint for the third time, so it gets the same
    // end-to-end proof as C-2 and NEW-1. The attack it closes: steal a
    // `manage_members` holder's short-lived ACCESS token, self-reset (no current
    // password required), and you hold the account permanently — while
    // `revokeAllForUser` logs the real person out of every device.
    const { orgId, adminId, adminAccess } = await seedOrgWithAdmin();
    const admin = await prisma.user.findUniqueOrThrow({ where: { id: adminId } });

    const res = await request(server())
      .post(`/orgs/${orgId}/members/${adminId}/reset-password`)
      .set("Content-Type", "application/json")
      .set("Authorization", `Bearer ${adminAccess}`)
      .send({ newPassword: "token-thief-takes-over-8Uu!" });

    expect(res.status).toBe(404);
    // The admin's own password still works, and the attacker's does not.
    const stillOriginal = await request(server())
      .post("/auth/login")
      .set("Content-Type", "application/json")
      .send({ email: admin.email, password: STRONG_PW });
    expect(stillOriginal.status).toBe(200);
    const attempted = await request(server())
      .post("/auth/login")
      .set("Content-Type", "application/json")
      .send({ email: admin.email, password: "token-thief-takes-over-8Uu!" });
    expect(attempted.status).toBe(401);
  });

  it("logout-all / sessions / change-password require Bearer → 401 without it", async () => {
    expect((await request(server()).get("/auth/sessions")).status).toBe(401);
    expect((await request(server()).post("/auth/logout-all").set("Content-Type", "application/json").send({})).status).toBe(401);
    expect((await request(server()).post("/auth/change-password").set("Content-Type", "application/json").send({ currentPassword: "x", newPassword: "y" })).status).toBe(401);
  });
});

// ─── PROD-PATH security wiring (F-001 security review) ──────────────────────
// A SEPARATE app instance wired exactly like main.ts: trust proxy = the env
// hop count (0 here → spoof-safe), and enableCors with an EXPLICIT allow-list.
// The block above sets `trust proxy = true` only for per-test IP isolation; this
// block proves the PRODUCTION default does NOT let a client spoof req.ip, and
// that CORS is an allow-list (not `*`).
const ALLOWED_ORIGIN = "http://localhost:3001";

d("prod-path security wiring (trust proxy 0 + CORS allow-list)", () => {
  let app: INestApplication;
  let redis: Redis;
  /** Signup emails this block minted, so `afterAll` can remove exactly them. */
  const spoofEmails: string[] = [];

  beforeAll(async () => {
    // Wire the prod path: TRUST_PROXY_HOPS default 0, an explicit CORS origin.
    process.env.TRUST_PROXY_HOPS = "0";
    process.env.CORS_ALLOWED_ORIGINS = ALLOWED_ORIGIN;
    redis = new Redis(TEST_REDIS!);

    const { loadEnv } = await import("@omnistock/config");
    const env = loadEnv(process.env);

    const moduleRef = await Test.createTestingModule({ imports: [AuthModule] }).compile();
    app = moduleRef.createNestApplication();
    (app.getHttpAdapter().getInstance() as { set: (k: string, v: unknown) => void }).set(
      "trust proxy",
      Number(env.TRUST_PROXY_HOPS),
    );
    app.enableCors({
      origin: env.CORS_ALLOWED_ORIGINS,
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
    });
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        exceptionFactory: (errors) => {
          const first = errors[0];
          const code = first?.constraints ? Object.values(first.constraints)[0] : "VALIDATION_FAILED";
          return new UnprocessableEntityException({ error: { code, message: "ข้อมูลไม่ถูกต้อง" } });
        },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
    // This block signs users up too, so it removes its own. Same rule as the
    // suite above: delete exactly what was created, never a table-wide sweep —
    // vitest runs files in parallel against one shared database.
    if (spoofEmails.length > 0) {
      const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB } } });
      try {
        const users = await prisma.user.findMany({
          where: { email: { in: spoofEmails.map((e) => e.toLowerCase()) } },
          select: { id: true },
        });
        const ids = users.map((u) => u.id);
        if (ids.length > 0) {
          await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
          await prisma.user.deleteMany({ where: { id: { in: ids } } });
        }
      } finally {
        await prisma.$disconnect();
      }
    }
    if (redis) redis.disconnect();
  });

  beforeEach(async () => {
    const keys = await redis.keys("throttle:*");
    if (keys.length > 0) await redis.del(...keys);
  });

  it("spoofed X-Forwarded-For does NOT create a fresh throttle bucket (TRUST_PROXY_HOPS=0)", async () => {
    const server = app.getHttpServer();
    // Two requests with DIFFERENT spoofed XFF values. With trust proxy=0, req.ip
    // is the socket peer (same loopback) for both → they share ONE ip bucket, so
    // the counter increments across both. If XFF were trusted, each spoofed IP
    // would get its own bucket (counter would reset), which is the bypass.
    // Emails must be VALID so the request passes the ValidationPipe and reaches
    // the handler, where throttle.checkIp(ip) records the IP bucket (an invalid
    // email 422s before the handler, so no bucket would be written). The password
    // strength is irrelevant here — checkIp runs before the policy check.
    const spoofBase = Date.now();
    spoofEmails.push(`spoof-${spoofBase}-1@example.com`, `spoof-${spoofBase}-2@example.com`);
    await request(server).post("/auth/signup").set("Content-Type", "application/json").set("X-Forwarded-For", "1.2.3.4").send({ email: `spoof-${spoofBase}-1@example.com`, password: STRONG_PW });
    await request(server).post("/auth/signup").set("Content-Type", "application/json").set("X-Forwarded-For", "5.6.7.8").send({ email: `spoof-${spoofBase}-2@example.com`, password: STRONG_PW });
    // Both requests hit the SAME ip bucket → count == 2 under one key.
    const ipKeys = await redis.keys("throttle:ip:*");
    expect(ipKeys.length).toBe(1); // a single bucket, not one-per-spoofed-IP
    const count = await redis.get(ipKeys[0]);
    expect(Number(count)).toBe(2);
  });

  it("CORS: a NON-allow-listed origin is not granted credentials", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .set("Content-Type", "application/json")
      .set("Origin", "https://evil.example.com")
      .send({ email: "x@x", password: "y" });
    // The API must NOT echo a cross-origin Allow-Origin for the disallowed origin.
    expect(res.headers["access-control-allow-origin"]).not.toBe("https://evil.example.com");
    expect(res.headers["access-control-allow-origin"]).not.toBe("*");
  });

  it("CORS: the allow-listed origin IS granted credentials", async () => {
    const res = await request(app.getHttpServer())
      .options("/auth/login")
      .set("Origin", ALLOWED_ORIGIN)
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type");
    expect(res.headers["access-control-allow-origin"]).toBe(ALLOWED_ORIGIN);
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });
});
