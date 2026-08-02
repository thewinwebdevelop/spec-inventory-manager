// F-002 · T-002-04 — the org-context chain proven over REAL HTTP.
//
// Authority: architecture.md §1.1 (route tiers / default-deny), §1.2 (source
// order), §1.3 (chain + req.orgAuth), §1.4 (failure matrix — EVERY row below
// has a case here), security-review I-3 / I-4 / I-5, api-spec §4 (codes).
//
// WHY a real Nest app instead of a mocked ExecutionContext: the two findings
// this task exists to close are both *ordering* facts (global guard runs before
// controller guards ⇒ `req.user` does not exist yet — I-4; middleware must have
// already opened the ALS scope by the time the guard fills it). A hand-rolled
// ExecutionContext cannot be wrong about ordering, so it cannot prove anything
// about it. Supertest through the real pipeline can.
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { Controller, Get, Head, Module, Post, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { getOrgContext } from "@omnistock/db";
import { PrismaService } from "../prisma/prisma.service";
import { OrgContextStore } from "./org-context";
import { TenancyModule } from "./tenancy.module";
import { RouteScopeRegistry } from "./route-scope.registry";
import { Public, SystemScoped, UserScoped } from "./route-scope.decorator";
import { AnyActiveMember } from "../common/authz";
import { ACCESS_TOKEN_VERIFIER, type AccessTokenVerifier } from "./access-token-verifier";

// ── fixtures ────────────────────────────────────────────────────────────────

const ORG_A = "org_aaaaaaaaaaaaaaaaaaaaaaaa";
const ORG_B = "org_bbbbbbbbbbbbbbbbbbbbbbbb";
const USER = "usr_1111111111111111111111";

/** Token format for the fake verifier: `t.<userId>` is valid, anything else is not. */
function token(userId: string): string {
  return `t.${userId}`;
}

const verifier: AccessTokenVerifier = {
  verify(raw: string) {
    return raw.startsWith("t.") && raw.length > 2 ? { userId: raw.slice(2) } : null;
  },
};

type FakeMembership = {
  id: string;
  status: "active" | "invited" | "revoked";
  roleId: string;
  role: { capabilities: string[] };
};

/** Seeded memberships keyed `organizationId|userId` (the composite unique). */
const memberships = new Map<string, FakeMembership>();
const findUnique = vi.fn(async (args: { where: { organizationId_userId: { organizationId: string; userId: string } } }) => {
  const { organizationId, userId } = args.where.organizationId_userId;
  return memberships.get(`${organizationId}|${userId}`) ?? null;
});

// Only `membership` — the whole point of M-1's narrow allowlist for tenancy/ is
// that this chain reads ONE model. `$extends` exists solely because the
// ORG_PRISMA provider wraps whatever client it is given at DI time.
const fakePrisma = {
  membership: { findUnique },
  $extends: (arg: unknown) =>
    typeof arg === "function" ? (arg as (c: unknown) => unknown)(fakePrisma) : fakePrisma,
};

// ── probe routes ────────────────────────────────────────────────────────────

@Controller()
class ProbeController {
  constructor(private readonly store: OrgContextStore) {}

  @Public()
  @Get("probe/public")
  publicRoute() {
    return this.snapshot();
  }

  @UserScoped()
  @Get("probe/user")
  userRoute() {
    return this.snapshot();
  }

  /**
   * NOT marked with a TIER → org-scoped by default (this is the "ลืมแล้วพัง" case
   * this file exists to prove).
   *
   * `@AnyActiveMember()` is a different axis and is required since T-002-05:
   * `CapabilityGuard` refuses any org-scoped route — read included — that
   * declares no capability (NEW-3). Without it these probes would 403 on the
   * capability layer before they could say anything about the org layer.
   */
  @AnyActiveMember()
  @Get("probe/org")
  orgRoute() {
    return this.snapshot();
  }

  @AnyActiveMember()
  @Get("orgs/:orgId/probe")
  orgPathRoute() {
    return this.snapshot();
  }

  @SystemScoped()
  @Get("probe/system")
  systemRoute() {
    return this.snapshot();
  }

  /** POST with no `@Get()` twin — the "HEAD has nothing to inherit" case. */
  @AnyActiveMember()
  @Post("probe/post-only")
  postOnly() {
    return this.snapshot();
  }

  /** An EXPLICIT `@Head()` must beat the HEAD⇒GET fallback (T-002-13). */
  @Public()
  @Head("probe/explicit-head")
  explicitHead() {
    return this.snapshot();
  }

  @AnyActiveMember()
  @Get("probe/explicit-head")
  explicitHeadGet() {
    return this.snapshot();
  }

  // ── routes F-001 shipped, carrying the marks T-002-13 gave them ──────────
  @Public()
  @Get("health")
  health() {
    return this.snapshot();
  }

  @Public()
  @Post("auth/login")
  login() {
    return this.snapshot();
  }

  /** `@UserScoped()`, not org-scoped — see members.controller.ts for why the
   *  `:orgId` in the path does not make it one (404-never-403). */
  @UserScoped()
  @Post("orgs/:orgId/members/:userId/reset-password")
  resetPassword() {
    return this.snapshot();
  }

  /** A NEW route under the same prefix must NOT inherit the legacy bridge. */
  @AnyActiveMember()
  @Get("orgs/:orgId/members")
  members() {
    return this.snapshot();
  }

  private snapshot() {
    const ctx = this.store.get();
    return {
      ctx: ctx ?? null,
      // The single-ALS proof: what the handler sees through packages/db (which
      // is what `lockCurrentOrganization` reads) must be the SAME object.
      dbOrganizationId: getOrgContext()?.organizationId ?? null,
      sameAls: (ctx ?? null) === (getOrgContext() ?? null),
    };
  }
}

@Module({ imports: [TenancyModule], controllers: [ProbeController] })
class ProbeModule {}

describe("OrgContextMiddleware + OrgScopeGuard (architecture §1.1–§1.4)", () => {
  let app: INestApplication;
  let registry: RouteScopeRegistry;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ProbeModule] })
      .overrideProvider(PrismaService)
      .useValue({ client: fakePrisma })
      .overrideProvider(ACCESS_TOKEN_VERIFIER)
      .useValue(verifier)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    registry = app.get(RouteScopeRegistry);
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    findUnique.mockClear();
    memberships.clear();
    memberships.set(`${ORG_A}|${USER}`, {
      id: "mem_a",
      status: "active",
      roleId: "role_a",
      role: { capabilities: ["manage_members"] },
    });
    memberships.set(`${ORG_B}|${USER}`, {
      id: "mem_b",
      status: "active",
      roleId: "role_b",
      role: { capabilities: ["full_access"] },
    });
  });

  // ── §1.4 row 1 — no/!valid token on an org-scoped route ──────────────────

  it("org-scoped + no Authorization → 401 UNAUTHENTICATED", async () => {
    const res = await request(app.getHttpServer()).get("/probe/org");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("org-scoped + unverifiable token → 401 (no DB lookup happens first)", async () => {
    const res = await request(app.getHttpServer())
      .get("/probe/org")
      .set("Authorization", "Bearer forged")
      .set("X-Organization-Id", ORG_A);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("a malformed Authorization header is treated as absent, never a 500", async () => {
    for (const header of ["Bearer", "Bearer   ", "Basic abc", "t.usr", ""]) {
      const res = await request(app.getHttpServer())
        .get("/probe/org")
        .set("Authorization", header)
        .set("X-Organization-Id", ORG_A);
      expect(res.status, `header=${JSON.stringify(header)}`).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHENTICATED");
    }
  });

  // ── §1.4 row 2 — no org at all ───────────────────────────────────────────

  it("org-scoped + token ok + neither header nor :orgId → 422 ORG_CONTEXT_REQUIRED", async () => {
    const res = await request(app.getHttpServer())
      .get("/probe/org")
      .set("Authorization", `Bearer ${token(USER)}`);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("ORG_CONTEXT_REQUIRED");
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("a blank/whitespace X-Organization-Id counts as absent → 422 ORG_CONTEXT_REQUIRED", async () => {
    const res = await request(app.getHttpServer())
      .get("/probe/org")
      .set("Authorization", `Bearer ${token(USER)}`)
      .set("X-Organization-Id", "   ");
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("ORG_CONTEXT_REQUIRED");
  });

  // ── §1.4 row 3 — header ≠ path param ─────────────────────────────────────

  it("header ≠ path param → 422 ORG_MISMATCH (422, NOT 403 — api-spec §4 / N-1)", async () => {
    const res = await request(app.getHttpServer())
      .get(`/orgs/${ORG_A}/probe`)
      .set("Authorization", `Bearer ${token(USER)}`)
      .set("X-Organization-Id", ORG_B);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("ORG_MISMATCH");
    // ambiguity is refused BEFORE any authorization work — we never pick a side
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("mismatch wins even when the caller is an active member of BOTH orgs", async () => {
    const res = await request(app.getHttpServer())
      .get(`/orgs/${ORG_A}/members`)
      .set("Authorization", `Bearer ${token(USER)}`)
      .set("X-Organization-Id", ORG_B);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("ORG_MISMATCH");
  });

  it("header == path param → accepted (not a mismatch)", async () => {
    const res = await request(app.getHttpServer())
      .get(`/orgs/${ORG_A}/probe`)
      .set("Authorization", `Bearer ${token(USER)}`)
      .set("X-Organization-Id", ORG_A);
    expect(res.status).toBe(200);
    expect(res.body.ctx.organizationId).toBe(ORG_A);
  });

  // ── §1.4 rows 4/5 — membership outcomes (I-5) ────────────────────────────

  it("not a member → 403 ORG_ACCESS_DENIED", async () => {
    memberships.delete(`${ORG_A}|${USER}`);
    const res = await request(app.getHttpServer())
      .get("/probe/org")
      .set("Authorization", `Bearer ${token(USER)}`)
      .set("X-Organization-Id", ORG_A);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ORG_ACCESS_DENIED");
  });

  it("⛔ existence oracle: an org that does not exist and an org you are not in are byte-identical", async () => {
    const foreign = await request(app.getHttpServer())
      .get("/probe/org")
      .set("Authorization", `Bearer ${token("usr_outsider")}`)
      .set("X-Organization-Id", ORG_A);
    const ghost = await request(app.getHttpServer())
      .get("/probe/org")
      .set("Authorization", `Bearer ${token("usr_outsider")}`)
      .set("X-Organization-Id", "org_does_not_exist_at_all");
    expect(foreign.status).toBe(403);
    expect(ghost.status).toBe(foreign.status);
    expect(JSON.stringify(ghost.body)).toBe(JSON.stringify(foreign.body));
  });

  it("membership revoked → 403 ORG_ACCESS_DENIED (AC US-5: next request, no cache)", async () => {
    const ok = await request(app.getHttpServer())
      .get("/probe/org")
      .set("Authorization", `Bearer ${token(USER)}`)
      .set("X-Organization-Id", ORG_A);
    expect(ok.status).toBe(200);

    memberships.set(`${ORG_A}|${USER}`, {
      id: "mem_a",
      status: "revoked",
      roleId: "role_a",
      role: { capabilities: [] },
    });

    const denied = await request(app.getHttpServer())
      .get("/probe/org")
      .set("Authorization", `Bearer ${token(USER)}`)
      .set("X-Organization-Id", ORG_A);
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe("ORG_ACCESS_DENIED");
  });

  it("membership invited (not active) → 403 ORG_ACCESS_DENIED", async () => {
    memberships.set(`${ORG_A}|${USER}`, {
      id: "mem_a",
      status: "invited",
      roleId: "role_a",
      role: { capabilities: [] },
    });
    const res = await request(app.getHttpServer())
      .get("/probe/org")
      .set("Authorization", `Bearer ${token(USER)}`)
      .set("X-Organization-Id", ORG_A);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ORG_ACCESS_DENIED");
  });

  it("every membership lookup is a `select` on the (organizationId,userId) unique — never an include, never another model", async () => {
    await request(app.getHttpServer())
      .get("/probe/org")
      .set("Authorization", `Bearer ${token(USER)}`)
      .set("X-Organization-Id", ORG_A);
    expect(findUnique).toHaveBeenCalledTimes(1);
    const args = findUnique.mock.calls[0]![0] as Record<string, unknown>;
    expect(args.where).toEqual({ organizationId_userId: { organizationId: ORG_A, userId: USER } });
    expect(args).not.toHaveProperty("include");
    expect(args.select).toBeDefined();
    // M-1: tenancy/ may read Membership (+ its Role) and nothing else.
    expect(Object.keys(fakePrisma).filter((k) => !k.startsWith("$"))).toEqual(["membership"]);
  });

  // ── happy path ───────────────────────────────────────────────────────────

  it("active member (header source) → 200 with a fully populated context", async () => {
    const res = await request(app.getHttpServer())
      .get("/probe/org")
      .set("Authorization", `Bearer ${token(USER)}`)
      .set("X-Organization-Id", ORG_A);
    expect(res.status).toBe(200);
    expect(res.body.ctx).toEqual({
      organizationId: ORG_A,
      userId: USER,
      membershipId: "mem_a",
      roleId: "role_a",
      capabilities: ["manage_members"],
    });
  });

  it("path param :orgId is used when no header is sent (§1.2 source order)", async () => {
    const res = await request(app.getHttpServer())
      .get(`/orgs/${ORG_A}/probe`)
      .set("Authorization", `Bearer ${token(USER)}`);
    expect(res.status).toBe(200);
    expect(res.body.ctx.organizationId).toBe(ORG_A);
  });

  it("the context does not leak between requests", async () => {
    const a = await request(app.getHttpServer())
      .get("/probe/org")
      .set("Authorization", `Bearer ${token(USER)}`)
      .set("X-Organization-Id", ORG_A);
    const pub = await request(app.getHttpServer()).get("/probe/public");
    expect(a.body.ctx.organizationId).toBe(ORG_A);
    expect(pub.body.ctx).toBeNull();
  });

  // ── I-4 — @UserScoped() must still be authenticated, without req.user ────

  it("I-4 · @UserScoped() + forged/expired token → 401 (the guard never reads req.user)", async () => {
    const res = await request(app.getHttpServer())
      .get("/probe/user")
      .set("Authorization", "Bearer forged");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("I-4 · @UserScoped() + no Authorization at all → 401", async () => {
    const res = await request(app.getHttpServer()).get("/probe/user");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("@UserScoped() + valid token → 200 and NO org context", async () => {
    const res = await request(app.getHttpServer())
      .get("/probe/user")
      .set("Authorization", `Bearer ${token(USER)}`);
    expect(res.status).toBe(200);
    expect(res.body.ctx).toBeNull();
  });

  // ── I-3 — a caller-chosen org must never become a context ────────────────

  it("I-3 · @UserScoped() + X-Organization-Id of an org the caller IS in → still no context, and no membership lookup at all", async () => {
    const res = await request(app.getHttpServer())
      .get("/probe/user")
      .set("Authorization", `Bearer ${token(USER)}`)
      .set("X-Organization-Id", ORG_B);
    expect(res.status).toBe(200);
    expect(res.body.ctx).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("I-3 · @Public() ignores X-Organization-Id entirely", async () => {
    const res = await request(app.getHttpServer())
      .get("/probe/public")
      .set("Authorization", `Bearer ${token(USER)}`)
      .set("X-Organization-Id", ORG_B);
    expect(res.status).toBe(200);
    expect(res.body.ctx).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("@Public() needs no token", async () => {
    const res = await request(app.getHttpServer()).get("/probe/public");
    expect(res.status).toBe(200);
    expect(res.body.ctx).toBeNull();
  });

  // ── @SystemScoped() — declared in §1.1, no SuperAdminGuard until F-085 ───

  it("@SystemScoped() is refused with FORBIDDEN until F-085 wires SuperAdminGuard", async () => {
    const res = await request(app.getHttpServer())
      .get("/probe/system")
      .set("Authorization", `Bearer ${token(USER)}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  // ── F-001 routes, now marked for real (T-002-13) ─────────────────────────

  it("shipped F-001 routes keep their exact wire behaviour under default-deny", async () => {
    const health = await request(app.getHttpServer()).get("/health");
    expect(health.status).toBe(200);
    expect(health.body.ctx).toBeNull();

    const login = await request(app.getHttpServer()).post("/auth/login");
    expect(login.status).toBe(201);

    // reset-password is `@UserScoped()`: a valid token is required, but NO org
    // context is built even though `:orgId` sits right there in the path (I-3).
    // `findUnique` proves no membership lookup happened — i.e. the guard added
    // no 403 oracle ahead of the endpoint's own identical 404, which is the
    // whole reason it is not org-scoped.
    const reset = await request(app.getHttpServer())
      .post(`/orgs/${ORG_A}/members/${USER}/reset-password`)
      .set("Authorization", `Bearer ${token(USER)}`);
    expect(reset.status).toBe(201);
    expect(reset.body.ctx).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("reset-password sends an anonymous caller the SAME 401 body its own JwtAuthGuard sends", async () => {
    // T-002-13 · the one wire delta on this endpoint, pinned deliberately.
    //
    // Global guards run BEFORE controller guards, so the 401 now comes from
    // OrgScopeGuard rather than from the controller's JwtAuthGuard. Same status,
    // same code, same message — `ERROR_CODES.UNAUTHENTICATED` is the single
    // source both read from, so a caller cannot tell which layer answered.
    //
    // What DOES change: a request that is BOTH unauthenticated AND not
    // `application/json` used to get 415 from JsonOnlyGuard and now gets this
    // 401. Both were failures; the new order tells an anonymous caller strictly
    // less. Nothing shipped pins 415 on this endpoint (the L-2 test covers
    // `/auth/signup`, which is `@Public()` and keeps its 415-first order).
    const anon = await request(app.getHttpServer()).post(
      `/orgs/${ORG_A}/members/${USER}/reset-password`,
    );
    expect(anon.status).toBe(401);
    expect(anon.body.error.code).toBe("UNAUTHENTICATED");
    expect(anon.body.error.message).toBe("ต้องเข้าสู่ระบบ");

    const nonJson = await request(app.getHttpServer())
      .post(`/orgs/${ORG_A}/members/${USER}/reset-password`)
      .set("Content-Type", "text/plain")
      .send("x");
    expect(nonJson.status).toBe(401);
  });

  it("a NEW route under /orgs/:orgId is org-scoped by default (default-deny holds)", async () => {
    const res = await request(app.getHttpServer()).get(`/orgs/${ORG_A}/members`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  // ── ONE AsyncLocalStorage (packages/db · T-002-03) ───────────────────────

  it("the handler's context IS packages/db's context — `lockCurrentOrganization` would read the same org", async () => {
    const res = await request(app.getHttpServer())
      .get("/probe/org")
      .set("Authorization", `Bearer ${token(USER)}`)
      .set("X-Organization-Id", ORG_A);
    expect(res.status).toBe(200);
    // If apps/api had its own AsyncLocalStorage, `ctx` would be populated and
    // `dbOrganizationId` would be null — green tests, dead org lock.
    expect(res.body.dbOrganizationId).toBe(ORG_A);
    expect(res.body.sameAls).toBe(true);
  });

  it("no context on a non-org route means packages/db has none either", async () => {
    const res = await request(app.getHttpServer())
      .get("/probe/user")
      .set("Authorization", `Bearer ${token(USER)}`)
      .set("X-Organization-Id", ORG_A);
    expect(res.body.dbOrganizationId).toBeNull();
    expect(res.body.sameAls).toBe(true);
  });

  // ── the registry the middleware reads tiers from ─────────────────────────

  it("RouteScopeRegistry reports each probe route's tier and extracts :orgId", () => {
    expect(registry.match("GET", "/probe/public")?.scope).toBe("public");
    expect(registry.match("GET", "/probe/user")?.scope).toBe("user");
    expect(registry.match("GET", "/probe/system")?.scope).toBe("system");
    expect(registry.match("GET", "/probe/org")?.scope).toBe("org");
    expect(registry.match("GET", `/orgs/${ORG_A}/probe`)).toEqual({
      scope: "org",
      params: { orgId: ORG_A },
    });
    expect(registry.match("GET", `/orgs/${ORG_A}/probe?x=1`)?.params.orgId).toBe(ORG_A);
    // verb + shape are both part of the match
    expect(registry.match("POST", "/probe/org")).toBeUndefined();
    expect(registry.match("GET", "/nothing/here")).toBeUndefined();
  });

  // ── HEAD ⇒ GET (T-002-13) ────────────────────────────────────────────────
  // Express answers HEAD from the GET handler, so the registry must resolve it
  // the same way: HEAD inherits GET's tier and GET's `:orgId`, never anything
  // weaker. Before this, a HEAD on a `@Get()`-only route was `undefined` here →
  // no context → a loud 500 at the guard for an ordinary request.

  it("HEAD resolves against its GET counterpart — same tier, same params", () => {
    expect(registry.match("HEAD", "/probe/org")).toEqual(registry.match("GET", "/probe/org"));
    expect(registry.match("HEAD", "/probe/public")).toEqual(registry.match("GET", "/probe/public"));
    expect(registry.match("HEAD", "/probe/user")).toEqual(registry.match("GET", "/probe/user"));
    expect(registry.match("HEAD", `/orgs/${ORG_A}/probe`)).toEqual({
      scope: "org",
      params: { orgId: ORG_A },
    });
  });

  it("HEAD on a path with NO GET stays unresolved — fail-closed, unchanged", () => {
    // `/probe/post-only` is POST-only: there is no GET tier to inherit, so the
    // middleware creates no context and the guard cannot be talked into one.
    expect(registry.match("POST", "/probe/post-only")?.scope).toBe("org");
    expect(registry.match("HEAD", "/probe/post-only")).toBeUndefined();
    expect(registry.match("HEAD", "/nothing/here")).toBeUndefined();
  });

  it("an explicit @Head() declaration wins over the GET fallback", () => {
    // The fallback must be a FALLBACK. `/probe/explicit-head` declares both a
    // `@Public() @Head()` and an org-scoped `@Get()`; a HEAD there must read the
    // HEAD declaration, and the presence of a second, disagreeing route must not
    // make the match ambiguous (`undefined`) either.
    expect(registry.match("HEAD", "/probe/explicit-head")?.scope).toBe("public");
    expect(registry.match("GET", "/probe/explicit-head")?.scope).toBe("org");
  });
});
