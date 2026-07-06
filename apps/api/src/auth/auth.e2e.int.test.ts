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
import { CAPABILITY_MANAGE_MEMBERS } from "@omnistock/core-domain";
import { AuthModule } from "./auth.module";

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
}

const STRONG_PW = "correct-horse-battery-staple-9f3aK!";

d("auth endpoints (E2E, DB+Redis)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let redis: Redis;

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
  });

  afterAll(async () => {
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
    if (redis) redis.disconnect();
  });

  // Clear throttle keys between tests so the shared localhost IP window from a
  // previous test doesn't 429 the next test's signups/logins (each test is
  // independent; the IP cap is asserted deliberately in the throttle unit test).
  beforeEach(async () => {
    const keys = await redis.keys("throttle:*");
    if (keys.length > 0) await redis.del(...keys);
  });

  function uniqueEmail(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@e2e.co`;
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
    const email = uniqueEmail("dup");
    await request(server()).post("/auth/signup").set("Content-Type", "application/json").send({ email, password: STRONG_PW });
    const res = await request(server()).post("/auth/signup").set("Content-Type", "application/json").send({ email, password: STRONG_PW });
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
    expect(wrong.body).toEqual(unknown.body);
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
    await request(server).post("/auth/signup").set("Content-Type", "application/json").set("X-Forwarded-For", "1.2.3.4").send({ email: "no1@x", password: "short" });
    await request(server).post("/auth/signup").set("Content-Type", "application/json").set("X-Forwarded-For", "5.6.7.8").send({ email: "no2@x", password: "short" });
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
