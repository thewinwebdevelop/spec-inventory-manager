// F-002 · T-002-13 — the capability layer's denial event must reach the REAL
// audit service, not just a log line.
//
// WHY THIS FILE EXISTS AND WHY IT LIVES IN `auth/`
// `CapabilityGuard` (common/) emits through the `CAPABILITY_EVENT_SINK` port
// because it may not import `SecurityEventsService` (auth/) — dependencies point
// leaf-ward (depcruise `api-leafward-only`, and that rule has no test
// exemption). So the composition root binds the two together, and this test —
// which must see both sides — belongs on the auth side of that boundary.
//
// WHAT BREAKS WITHOUT THE BINDING: nothing visible. The guard still denies, the
// request still gets 403, the log line is still written. Only
// `collectSecurityEvents()` — @qa's collector and F-005's future outbox — goes
// quiet, so "somebody probed a permission they do not hold" stops being
// evidence anyone can query. A gap that leaves every test green is exactly the
// kind that survives review, which is why it is pinned here twice: once on the
// mechanism, once on AppModule's actual wiring.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Controller, Get, Module, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import {
  CAPABILITY_EVENT_SINK_OVERRIDE,
  CAPABILITY_DENIED_EVENT,
  RequireCapability,
} from "../common/authz";
import { CAPABILITY_MANAGE_MEMBERS } from "@omnistock/core-domain";
import { PrismaService } from "../prisma/prisma.service";
import { TenancyModule } from "../tenancy/tenancy.module";
import {
  ACCESS_TOKEN_VERIFIER,
  type AccessTokenVerifier,
} from "../tenancy/access-token-verifier";
import { SecurityEventsService, collectSecurityEvents } from "./security-events.service";
import { AppModule } from "../app.module";

const ORG = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
/** The verifier is stubbed below, so the token only has to be present. */
const TOKEN = "stub-access-token";

/**
 * An org-scoped route demanding a capability the caller does not hold. That is
 * the branch that EMITS: a route missing its declaration entirely is refused
 * too, but as `capability_metadata_missing` — our own misconfiguration, logged
 * rather than filed as somebody probing a permission.
 */
@Controller("probe")
class GuardedController {
  @RequireCapability(CAPABILITY_MANAGE_MEMBERS)
  @Get("guarded")
  guarded() {
    return { ok: true };
  }
}

/** Exactly the shape app.module.ts uses, with the same real service. */
@Module({ providers: [SecurityEventsService], exports: [SecurityEventsService] })
class FakeAuthModule {}

@Module({
  imports: [
    TenancyModule.withCompositionRootBindings({
      imports: [FakeAuthModule],
      providers: [
        { provide: CAPABILITY_EVENT_SINK_OVERRIDE, useExisting: SecurityEventsService },
      ],
    }),
    FakeAuthModule,
  ],
  controllers: [GuardedController],
})
class ProbeModule {}

describe("CAPABILITY_EVENT_SINK → SecurityEventsService (T-002-13)", () => {
  let app: INestApplication;
  let events: ReturnType<typeof collectSecurityEvents>;

  beforeAll(async () => {
    const verifier: AccessTokenVerifier = {
      verify: (raw: string) => (raw ? { userId: USER } : null),
    };
    const membership = {
      status: "active",
      role: { capabilities: [] as string[] },
      organization: { status: "active" },
    };
    const fakePrisma: Record<string, unknown> = {
      membership: { findUnique: async () => membership },
    };
    // `ORG_PRISMA` builds its scoped client with `$extends` — a plain object
    // would blow up at module init, before any assertion could run.
    fakePrisma.$extends = (arg: unknown) =>
      typeof arg === "function" ? (arg as (c: unknown) => unknown)(fakePrisma) : fakePrisma;

    const moduleRef = await Test.createTestingModule({ imports: [ProbeModule] })
      .overrideProvider(PrismaService)
      .useValue({ client: fakePrisma })
      .overrideProvider(ACCESS_TOKEN_VERIFIER)
      .useValue(verifier)
      .compile();

    app = moduleRef.createNestApplication();
    // Listen on an ephemeral loopback port instead of leaving the server
    // unstarted. With `init()` alone supertest starts and closes a server for
    // EVERY request; across parallel forks that churn produced this lane's
    // transport flakes (`socket hang up`, `Parse Error: Expected HTTP/`) on
    // arbitrary files, unrelated to the code under test. A listening server is
    // reused, and `app.close()` still tears it down.
    await app.listen(0, "127.0.0.1");
    events = collectSecurityEvents(app.get(SecurityEventsService));
  });

  afterAll(async () => {
    events.stop();
    await app?.close();
  });

  it("a capability denial reaches collectSecurityEvents(), not only the log", async () => {
    events.clear();
    const res = await request(app.getHttpServer())
      .get("/probe/guarded")
      .set("Authorization", `Bearer ${TOKEN}`)
      .set("X-Organization-Id", ORG);

    expect([res.status, res.body.error.code]).toEqual([403, "FORBIDDEN"]);
    // The assertion that goes red the moment the binding is dropped: with the
    // default log-only sink this array is empty and the 403 above still passes.
    expect(events.ofType(CAPABILITY_DENIED_EVENT)).toHaveLength(1);
  });

  it("the denial event carries no credential material", () => {
    const [event] = events.ofType(CAPABILITY_DENIED_EVENT);
    const serialized = JSON.stringify(event);
    expect(serialized).not.toMatch(/passwordHash|tokenHash|password/i);
  });

  it("app.module.ts really performs this binding (the mechanism above is not enough on its own)", () => {
    const imports = (Reflect.getMetadata("imports", AppModule) ?? []) as unknown[];
    const dynamic = imports.find(
      (entry): entry is { module: unknown; providers?: Array<{ provide?: unknown }> } =>
        typeof entry === "object" &&
        entry !== null &&
        (entry as { module?: unknown }).module === TenancyModule,
    );
    // Not "is TenancyModule imported" — that would still pass if someone
    // replaced the dynamic call with the plain class and silently reverted to
    // the log-only sink.
    expect(dynamic).toBeDefined();
    const bound = dynamic?.providers?.find((p) => p.provide === CAPABILITY_EVENT_SINK_OVERRIDE) as
      | { useExisting?: unknown }
      | undefined;
    expect(bound?.useExisting).toBe(SecurityEventsService);
  });
});