// F-002 · T-002-05 ★ — fail-closed capability authorization, proven over HTTP.
//
// Authority: architecture §1.3 (guard chain — CapabilityGuard runs AFTER
// OrgScopeGuard), §1.4 rows 6–7 (the failure matrix), §3.1 (`@RequireCapability`
// metadata + ALS, `@AnyActiveMember()` allowlist), security-review I-2
// (fail-open by omission) and NEW-3 (fail-closed must cover READ too),
// test-plan U-API-05 (the 6-method table) and I-5 (FORBIDDEN ≠ ORG_ACCESS_DENIED).
//
// WHY A REAL NEST APP, not a hand-rolled ExecutionContext: the two facts this
// task must prove are both ORDERING facts — (a) the org guard answers first, so
// a non-member gets `ORG_ACCESS_DENIED` and never reaches the capability layer,
// and (b) the capabilities the guard reads are the ones the MIDDLEWARE put in
// the ALS, not a second DB read. A fake context cannot be wrong about either, so
// it cannot prove either. Supertest through the real pipeline can.
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import {
  Controller,
  Delete,
  Get,
  Head,
  Logger,
  Module,
  Patch,
  Post,
  Put,
  type INestApplication,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { CAPABILITY_MANAGE_MEMBERS } from "@omnistock/core-domain";
import { PrismaService } from "../../prisma/prisma.service";
import { TenancyModule } from "../../tenancy/tenancy.module";
import { Public, SystemScoped, UserScoped } from "../../tenancy/route-scope.decorator";
import {
  ACCESS_TOKEN_VERIFIER,
  type AccessTokenVerifier,
} from "../../tenancy/access-token-verifier";
import { AnyActiveMember, RequireCapability } from "./capability.decorator";
import {
  CAPABILITY_EVENT_SINK,
  CAPABILITY_DENIED_EVENT,
  ORG_ACCESS_DENIED_EVENT,
  type CapabilityEventSink,
} from "./capability-events";
import { CAPABILITY_MANAGE_ORG_SETTINGS } from "./route-capabilities";
import { enumerateRoutes } from "./route-declarations";

// ── fixtures ────────────────────────────────────────────────────────────────

const ORG = "org_aaaaaaaaaaaaaaaaaaaaaaaa";
const USER = "usr_1111111111111111111111";

function token(userId: string): string {
  return `t.${userId}`;
}

const verifier: AccessTokenVerifier = {
  verify(raw: string) {
    return raw.startsWith("t.") && raw.length > 2 ? { userId: raw.slice(2) } : null;
  },
};

/** Capabilities of the (single) seeded membership — rewritten per test. */
let capabilities: string[] = [];
let membershipStatus: "active" | "revoked" = "active";

const findUnique = vi.fn(
  async (args: { where: { organizationId_userId: { organizationId: string; userId: string } } }) => {
    const { organizationId, userId } = args.where.organizationId_userId;
    if (organizationId !== ORG || userId !== USER) return null;
    return {
      id: "mem_1",
      status: membershipStatus,
      roleId: "role_1",
      role: { capabilities },
    };
  },
);

const fakePrisma = {
  membership: { findUnique },
  $extends: (arg: unknown) =>
    typeof arg === "function" ? (arg as (c: unknown) => unknown)(fakePrisma) : fakePrisma,
};

/** Records what the guard emitted; stands in for SecurityEventsService. */
const emitted: { type: string; payload: Record<string, unknown> }[] = [];
const sink: CapabilityEventSink = {
  emit(type, payload) {
    emitted.push({ type, payload });
  },
};

// ── probe routes ────────────────────────────────────────────────────────────

/**
 * Org-scoped (nothing declares a tier) and NOTHING declares a capability — the
 * "someone refactored the controller and the decorator fell off" case, one
 * handler per verb so U-API-05 can prove it verb by verb instead of in bulk.
 */
@Controller("probe/naked")
class NakedController {
  @Get() get() {
    return { ok: true };
  }
  @Head("head") head() {
    return { ok: true };
  }
  @Post() post() {
    return { ok: true };
  }
  @Patch() patch() {
    return { ok: true };
  }
  @Put() put() {
    return { ok: true };
  }
  @Delete() delete() {
    return { ok: true };
  }
}

@Controller("probe")
class DeclaredController {
  @RequireCapability(CAPABILITY_MANAGE_MEMBERS)
  @Get("members")
  members() {
    return { ok: true };
  }

  @RequireCapability(CAPABILITY_MANAGE_ORG_SETTINGS)
  @Patch("settings")
  settings() {
    return { ok: true };
  }

  @AnyActiveMember()
  @Get("profile")
  profile() {
    return { ok: true };
  }

  @AnyActiveMember()
  @Delete("membership")
  leave() {
    return { ok: true };
  }

  /**
   * POST with NO `@Get()` twin — the "HEAD has no GET counterpart" case
   * (T-002-13). Express serves HEAD from a GET route only, so a HEAD here must
   * never be served at all.
   */
  @RequireCapability(CAPABILITY_MANAGE_MEMBERS)
  @Post("post-only")
  postOnly() {
    return { ok: true };
  }

  /** Contradiction: two declarations at the SAME level. Must fail LOUD. */
  @AnyActiveMember()
  @RequireCapability(CAPABILITY_MANAGE_MEMBERS)
  @Get("contradiction")
  contradiction() {
    return { ok: true };
  }

  // Tiers that are not org-scoped are untouched by this guard.
  @Public()
  @Get("public")
  publicRoute() {
    return { ok: true };
  }

  @UserScoped()
  @Get("user")
  userRoute() {
    return { ok: true };
  }

  @SystemScoped()
  @Get("system")
  systemRoute() {
    return { ok: true };
  }
}

/** Class-level declaration — every handler inherits it unless it overrides. */
@RequireCapability(CAPABILITY_MANAGE_MEMBERS)
@Controller("probe/class")
class ClassDeclaredController {
  @Get("inherited") inherited() {
    return { ok: true };
  }

  /** Handler-level wins over class-level (standard Nest override semantics). */
  @AnyActiveMember()
  @Get("overridden")
  overridden() {
    return { ok: true };
  }
}

/**
 * The F-001 routes as T-002-13 marks them for real: `/health` + `/auth/*` are
 * `@Public()`, admin-reset is `@UserScoped()` (it keeps its inline capability
 * check and its 404-never-403 shape, so the guard must stay out of its way).
 * The temporary path-regex bridge that used to grant this is gone.
 */
@Public()
@Controller()
class PublicLegacyController {
  @Get("health") health() {
    return { ok: true };
  }
  @Post("auth/login") login() {
    return { ok: true };
  }
}

@UserScoped()
@Controller("orgs/:orgId/members/:userId")
class AdminResetController {
  @Post("reset-password") resetPassword() {
    return { ok: true };
  }
}

/**
 * Same shape as admin-reset but WITHOUT a mark — the control that proves the
 * routes above pass because of their decorators and not because their path
 * happens to look familiar. With the bridge deleted this must be denied.
 */
@Controller("orgs/:orgId/members/:userId")
class UnmarkedNeighbourController {
  @Post("set-password") setPassword() {
    return { ok: true };
  }
}

@Module({
  imports: [TenancyModule],
  controllers: [
    NakedController,
    DeclaredController,
    ClassDeclaredController,
    PublicLegacyController,
    AdminResetController,
    UnmarkedNeighbourController,
  ],
})
class ProbeModule {}

// ── suite ───────────────────────────────────────────────────────────────────

describe("CapabilityGuard — fail-closed by omission (§3.1 · I-2 · NEW-3)", () => {
  let app: INestApplication;
  let errors: ReturnType<typeof vi.spyOn>;

  const auth = () => ({ Authorization: `Bearer ${token(USER)}`, "X-Organization-Id": ORG });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ProbeModule] })
      .overrideProvider(PrismaService)
      .useValue({ client: fakePrisma })
      .overrideProvider(ACCESS_TOKEN_VERIFIER)
      .useValue(verifier)
      .overrideProvider(CAPABILITY_EVENT_SINK)
      .useValue(sink)
      .compile();
    app = moduleRef.createNestApplication();
    // Listen on an ephemeral loopback port instead of leaving the server
    // unstarted. With `init()` alone supertest starts and closes a server for
    // EVERY request; across parallel forks that churn produced this lane's
    // transport flakes (`socket hang up`, `Parse Error: Expected HTTP/`) on
    // arbitrary files, unrelated to the code under test. A listening server is
    // reused, and `app.close()` still tears it down.
    await app.listen(0, "127.0.0.1");
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    findUnique.mockClear();
    emitted.length = 0;
    capabilities = [];
    membershipStatus = "active";
    errors = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
  });

  // ── U-API-05 · the 6-method table ────────────────────────────────────────
  // Every verb, same expectation. The GET/HEAD rows are the ones NEW-3 added:
  // run this table against a guard that only fail-closes on mutating verbs and
  // these two rows go red — which is precisely how we know read is covered.

  const VERBS = [
    ["get", "/probe/naked"],
    ["head", "/probe/naked/head"],
    ["post", "/probe/naked"],
    ["patch", "/probe/naked"],
    ["put", "/probe/naked"],
    ["delete", "/probe/naked"],
  ] as const;

  for (const [verb, path] of VERBS) {
    it(`${verb.toUpperCase()} org-scoped route with NO capability metadata → 403 FORBIDDEN + capability_metadata_missing`, async () => {
      const res = await request(app.getHttpServer())[verb](path).set(auth());
      expect(res.status).toBe(403);
      // HEAD carries no body by protocol; the log line is the shared assertion.
      if (verb !== "head") expect(res.body.error.code).toBe("FORBIDDEN");
      expect(
        errors.mock.calls.some((c) => String(c[0]).includes("capability_metadata_missing")),
      ).toBe(true);
      // ...and never the org-membership code: this caller IS an active member.
      if (verb !== "head") expect(res.body.error.code).not.toBe("ORG_ACCESS_DENIED");
    });
  }

  // ── HEAD resolves against its GET counterpart (T-002-13) ─────────────────
  //
  // ⚠️ REPLACES the T-002-04 test `"an implicit HEAD (express answering a
  // @Get() route) never reaches a handler either"`, which pinned **500**. That
  // 500 was a wire artifact, not a policy: `RouteScopeRegistry` had no HEAD
  // entry for a `@Get()`-only path, so the middleware built no context and
  // `OrgScopeGuard`'s tier cross-check failed loud. Fail-closed, but wrong on
  // the wire — an ordinary HEAD raising an operational alarm. HEAD now resolves
  // against GET for BOTH tier and capability, so it inherits exactly what GET
  // requires and never anything weaker. The property the old test protected
  // ("an org-scoped read is never served without an authorization decision") is
  // still asserted below — the status it produces is simply the right one now.

  it("HEAD on a @Get()-only org-scoped route inherits GET's capability — denied without it", async () => {
    capabilities = ["some_other_capability"];
    const res = await request(app.getHttpServer()).head("/probe/members").set(auth());
    expect(res.status).toBe(403);
    // Same decision as GET, from the same declaration — and it is the CAPABILITY
    // layer that answered (500 would mean the chain never got here).
    expect(emitted).toHaveLength(1);
    expect(emitted[0]!.payload).toMatchObject({
      requiredCapability: CAPABILITY_MANAGE_MEMBERS,
      route: "HEAD /probe/members",
    });
  });

  it("HEAD and GET on the same org-scoped route resolve to the SAME tier and the SAME capability", async () => {
    capabilities = [CAPABILITY_MANAGE_MEMBERS];
    const head = await request(app.getHttpServer()).head("/probe/members").set(auth());
    const get = await request(app.getHttpServer()).get("/probe/members").set(auth());
    expect(head.status).toBe(get.status);
    expect(head.status).toBe(200);
    // HEAD carries GET's status with an empty body (protocol).
    expect(head.body).toEqual({});
    expect(emitted).toEqual([]);
  });

  it("HEAD never gets a WEAKER answer than GET: a @Get() route with no declaration refuses both", async () => {
    capabilities = ["full_access"];
    const head = await request(app.getHttpServer()).head("/probe/naked").set(auth());
    const get = await request(app.getHttpServer()).get("/probe/naked").set(auth());
    expect(head.status).toBe(403); // not 500 (the old artifact), not 200
    expect(get.status).toBe(403);
    expect(
      errors.mock.calls.some((c) => String(c[0]).includes("capability_metadata_missing")),
    ).toBe(true);
  });

  it("HEAD on a path with NO GET declaration is still denied (fail-closed, unchanged)", async () => {
    // `/probe/post-only` exists for POST only. Express answers HEAD from a GET
    // route or not at all, so there is nothing to inherit and nothing is served.
    const res = await request(app.getHttpServer()).head("/probe/post-only").set(auth());
    expect(res.status).toBe(404);
    expect(res.status).not.toBe(200);
    expect(emitted).toEqual([]);
  });

  it("full_access does NOT rescue a route that forgot to declare (omission is a bug, not a permission)", async () => {
    capabilities = ["full_access"];
    const res = await request(app.getHttpServer()).get("/probe/naked").set(auth());
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("@RequireCapability refuses a missing/empty capability at IMPORT time, not at request time", () => {
    // A typo'd constant evaluates to `undefined`; a vacuous check is worse than
    // no check because it looks declared. Breaking at module load is the only
    // moment where nobody can be served in the meantime.
    expect(() => RequireCapability("")).toThrow(/non-empty capability/);
    expect(() => RequireCapability("   ")).toThrow(/non-empty capability/);
    expect(() => RequireCapability(undefined as unknown as string)).toThrow();
  });

  // ── §3.1 · a declared capability ─────────────────────────────────────────

  it("declared capability + caller has it → 200", async () => {
    capabilities = [CAPABILITY_MANAGE_MEMBERS];
    const res = await request(app.getHttpServer()).get("/probe/members").set(auth());
    expect(res.status).toBe(200);
    expect(emitted).toEqual([]);
  });

  it("declared capability + caller lacks it → 403 FORBIDDEN + org.access.capability_denied", async () => {
    capabilities = ["some_other_capability"];
    const res = await request(app.getHttpServer()).get("/probe/members").set(auth());
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
    expect(emitted).toHaveLength(1);
    expect(emitted[0]!.type).toBe("org.access.capability_denied");
    expect(emitted[0]!.payload).toMatchObject({
      userId: USER,
      organizationId: ORG,
      requiredCapability: CAPABILITY_MANAGE_MEMBERS,
      route: "GET /probe/members",
    });
  });

  it("full_access satisfies EVERY declared capability (hasCapability semantics, reused not rewritten)", async () => {
    capabilities = ["full_access"];
    for (const path of ["/probe/members", "/probe/settings"]) {
      const res =
        path === "/probe/settings"
          ? await request(app.getHttpServer()).patch(path).set(auth())
          : await request(app.getHttpServer()).get(path).set(auth());
      expect(res.status, path).toBe(200);
    }
    expect(emitted).toEqual([]);
  });

  it("capabilities are per-capability, not per-role: manage_members does not open manage_org_settings", async () => {
    capabilities = [CAPABILITY_MANAGE_MEMBERS];
    const res = await request(app.getHttpServer()).patch("/probe/settings").set(auth());
    expect(res.status).toBe(403);
    expect(emitted[0]!.payload).toMatchObject({
      requiredCapability: CAPABILITY_MANAGE_ORG_SETTINGS,
    });
  });

  it("the event carries NO capability list and no token — only who/where/what was required", async () => {
    capabilities = ["secret_capability"];
    await request(app.getHttpServer()).get("/probe/members").set(auth());
    expect(Object.keys(emitted[0]!.payload).sort()).toEqual([
      "organizationId",
      "reason",
      "requiredCapability",
      "route",
      "userId",
    ]);
  });

  // ── §3.1 · @AnyActiveMember() ────────────────────────────────────────────

  it("@AnyActiveMember() read route passes with ZERO capabilities", async () => {
    const res = await request(app.getHttpServer()).get("/probe/profile").set(auth());
    expect(res.status).toBe(200);
    expect(emitted).toEqual([]);
  });

  it("@AnyActiveMember() mutating route (leave, D-029) passes with ZERO capabilities", async () => {
    const res = await request(app.getHttpServer()).delete("/probe/membership").set(auth());
    expect(res.status).toBe(200);
  });

  it("@AnyActiveMember() still requires an ACTIVE membership — a revoked member is stopped earlier", async () => {
    membershipStatus = "revoked";
    const res = await request(app.getHttpServer()).get("/probe/profile").set(auth());
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ORG_ACCESS_DENIED");
  });

  // ── declaring BOTH = a contradiction, not a choice ────────────────────────

  it("a route declaring @RequireCapability AND @AnyActiveMember fails LOUD (never the looser one)", async () => {
    capabilities = ["full_access"];
    const res = await request(app.getHttpServer()).get("/probe/contradiction").set(auth());
    // 500, not 200-via-@AnyActiveMember and not a plain 403: a contradictory
    // declaration is OUR bug and must be impossible to miss. Silently picking
    // the weaker layer is how "declare the loosest thing" becomes a shortcut.
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL");
    expect(
      errors.mock.calls.some((c) => String(c[0]).includes("capability_metadata_conflict")),
    ).toBe(true);
  });

  // ── class-level declaration + override ───────────────────────────────────

  it("a class-level @RequireCapability covers its handlers", async () => {
    const denied = await request(app.getHttpServer()).get("/probe/class/inherited").set(auth());
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe("FORBIDDEN");

    capabilities = [CAPABILITY_MANAGE_MEMBERS];
    const allowed = await request(app.getHttpServer()).get("/probe/class/inherited").set(auth());
    expect(allowed.status).toBe(200);
  });

  it("a handler-level declaration overrides the class-level one", async () => {
    const res = await request(app.getHttpServer()).get("/probe/class/overridden").set(auth());
    expect(res.status).toBe(200);
  });

  // ── I-5 · the two 403s must stay distinguishable ─────────────────────────

  it("I-5 · member-but-underprivileged → FORBIDDEN; not-a-member → ORG_ACCESS_DENIED (never merged)", async () => {
    capabilities = [];
    const staff = await request(app.getHttpServer()).get("/probe/members").set(auth());
    const outsider = await request(app.getHttpServer())
      .get("/probe/members")
      .set({ Authorization: `Bearer ${token("usr_outsider")}`, "X-Organization-Id": ORG });

    expect(staff.status).toBe(403);
    expect(outsider.status).toBe(403);
    expect(staff.body.error.code).toBe("FORBIDDEN");
    expect(outsider.body.error.code).toBe("ORG_ACCESS_DENIED");
    // The outsider never reached THIS guard, so no CAPABILITY event exists for
    // them: OrgScopeGuard answered first (§1.3 ordering). It does produce an
    // `org.access.denied` on the same sink — the two layers are distinguishable
    // in the audit trail exactly as they are on the wire, which is the point of
    // I-5. Filtering by type is what makes that assertion mean something.
    const capabilityEvents = emitted.filter((e) => e.type === CAPABILITY_DENIED_EVENT);
    expect(capabilityEvents).toHaveLength(1);
    expect(capabilityEvents[0]!.payload.userId).toBe(USER);

    const tenancyEvents = emitted.filter((e) => e.type === ORG_ACCESS_DENIED_EVENT);
    expect(tenancyEvents).toHaveLength(1);
    expect(tenancyEvents[0]!.payload).toMatchObject({
      userId: "usr_outsider",
      reason: "no_membership",
    });
  });

  it("a revoked member on a capability route gets ORG_ACCESS_DENIED, not FORBIDDEN", async () => {
    membershipStatus = "revoked";
    capabilities = ["full_access"];
    const res = await request(app.getHttpServer()).get("/probe/members").set(auth());
    expect(res.body.error.code).toBe("ORG_ACCESS_DENIED");
    // No CAPABILITY event — this guard never ran. The tenancy layer records the
    // denial instead, and with the precise reason: the wire cannot distinguish
    // "revoked" from "never a member" (I-5), but an investigator must.
    expect(emitted.filter((e) => e.type === CAPABILITY_DENIED_EVENT)).toEqual([]);
    expect(emitted.filter((e) => e.type === ORG_ACCESS_DENIED_EVENT)[0]?.payload).toMatchObject({
      reason: "revoked",
    });
  });

  // ── the guard reads the ALS, it does not re-query ────────────────────────

  it("capabilities come from the ALS context — exactly ONE membership read per request", async () => {
    capabilities = [CAPABILITY_MANAGE_MEMBERS];
    await request(app.getHttpServer()).get("/probe/members").set(auth());
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  // ── tiers that are not org-scoped are untouched ──────────────────────────

  it("@Public() / @UserScoped() need no capability metadata (they are not org-scoped)", async () => {
    const pub = await request(app.getHttpServer()).get("/probe/public");
    expect(pub.status).toBe(200);

    const user = await request(app.getHttpServer())
      .get("/probe/user")
      .set("Authorization", `Bearer ${token(USER)}`);
    expect(user.status).toBe(200);

    const anon = await request(app.getHttpServer()).get("/probe/user");
    expect(anon.status).toBe(401);
    expect(anon.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("@SystemScoped() keeps OrgScopeGuard's 403 (F-085) — this guard adds nothing", async () => {
    const res = await request(app.getHttpServer()).get("/probe/system").set(auth());
    expect(res.status).toBe(403);
    expect(emitted).toEqual([]);
  });

  it("T-002-13 · the F-001 routes keep working on their real decorators, not on a path bridge", async () => {
    const health = await request(app.getHttpServer()).get("/health");
    expect(health.status).toBe(200);

    const login = await request(app.getHttpServer()).post("/auth/login");
    expect(login.status).toBe(201);

    const reset = await request(app.getHttpServer())
      .post(`/orgs/${ORG}/members/${USER}/reset-password`)
      .set("Authorization", `Bearer ${token(USER)}`);
    expect(reset.status).toBe(201);
    // Reaching the handler is the point: the endpoint answers all of its
    // refusals itself with one identical 404. A capability denial here would
    // be a 403 — a brand-new oracle on a shipped endpoint.
    expect(emitted).toEqual([]);
  });

  it("an UNMARKED neighbour of admin-reset is refused — the mark is what grants, not the path", async () => {
    const res = await request(app.getHttpServer())
      .post(`/orgs/${ORG}/members/${USER}/set-password`)
      .set(auth());
    expect(res.status).toBe(403);
  });

  // ── enumerateRoutes — what @qa's I-02/G-13 build on (§12.2 item 4) ───────

  describe("enumerateRoutes(app)", () => {
    it("classifies every route, and sees BOTH read and mutating org-scoped routes", () => {
      const routes = enumerateRoutes(app);
      expect(routes.length).toBeGreaterThan(0);

      const orgScoped = routes.filter((r) => r.scope === "org");
      // I-02's condition: if either group is empty the enumeration is blind and
      // any "everything declared" assertion built on it is green-by-accident.
      expect(orgScoped.filter((r) => r.mutating).length).toBeGreaterThan(0);
      expect(orgScoped.filter((r) => !r.mutating).length).toBeGreaterThan(0);

      const byKey = new Map(routes.map((r) => [`${r.method} ${r.path}`, r]));
      expect(byKey.get("GET /probe/naked")?.declaration).toBe("none");
      expect(byKey.get("HEAD /probe/naked/head")?.declaration).toBe("none");
      expect(byKey.get("GET /probe/members")).toMatchObject({
        declaration: "capability",
        capability: CAPABILITY_MANAGE_MEMBERS,
      });
      expect(byKey.get("GET /probe/profile")?.declaration).toBe("any-active-member");
      expect(byKey.get("GET /probe/contradiction")?.declaration).toBe("conflict");
      expect(byKey.get("GET /probe/public")?.scope).toBe("public");
      expect(byKey.get("GET /probe/user")?.scope).toBe("user");
      expect(byKey.get("GET /probe/system")?.scope).toBe("system");
      expect(byKey.get("GET /probe/class/inherited")).toMatchObject({
        declaration: "capability",
        capability: CAPABILITY_MANAGE_MEMBERS,
      });
      expect(byKey.get("GET /probe/class/overridden")?.declaration).toBe("any-active-member");
    });

    it("reports path params in the api-spec '{param}' dialect so allowlists compare directly", () => {
      const routes = enumerateRoutes(app);
      const reset = routes.find((r) => r.path.includes("reset-password"));
      expect(reset?.path).toBe("/orgs/{orgId}/members/{userId}/reset-password");
    });
  });
});
