// F-002 · T-002-22 — one place that builds an app wired like `main.ts`.
//
// Every int suite needs the SAME application: the tenancy chain (middleware +
// the two global guards), the auth module, the global ValidationPipe and — the
// part `auth.e2e.int.test.ts` does not have — `DomainExceptionFilter`, without
// which no `traceId` exists and every error-envelope assertion is vacuous.
//
// `HealthModule` is deliberately left out (it opens a BullMQ queue nothing here
// asserts on). Everything else mirrors `main.ts` line for line; where it does
// not, a comment says why.
import { ValidationPipe, UnprocessableEntityException, type INestApplication } from "@nestjs/common";
import { Test, type TestingModuleBuilder } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { AuthModule } from "../src/auth/auth.module";
import { SecurityEventsService } from "../src/auth/security-events.service";
import { CAPABILITY_EVENT_SINK_OVERRIDE } from "../src/common/authz";
import {
  ORG_RATE_LIMIT_EVENT_SINK_OVERRIDE,
  ORG_RATE_LIMIT_REDIS,
} from "../src/common/org-rate-limit.tokens";
import { DomainExceptionFilter } from "../src/common/domain-exception.filter";
import { OrgsModule } from "../src/orgs";
import { TenancyModule } from "../src/tenancy";
import { TestFixturesModule } from "./fixtures/test-fixtures.module";

/** True when this process has both backing services and may run int suites. */
export const INT_LANE_ENABLED = Boolean(
  process.env.TEST_DATABASE_URL && process.env.TEST_REDIS_URL,
);

/**
 * Point the app at the test services and satisfy `loadEnv`'s WHOLE shape —
 * it validates every variable, so a module factory exits(1) on a var the code
 * under test never reads. Values mirror CI's `integration-api` job.
 */
export function applyTestEnv(): void {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.REDIS_URL = process.env.TEST_REDIS_URL;
  process.env.JWT_ACCESS_SECRET ??= "t22-access-secret-32-chars-minimum-value!!";
  process.env.JWT_REFRESH_SECRET ??= "t22-refresh-secret-32-chars-different-va!";
  process.env.INVITATION_TOKEN_SECRET ??= "t22-invitation-secret-32-chars-distinct!!";
  process.env.WEB_APP_BASE_URL ??= "http://localhost:3001";
  process.env.DEFAULT_ORG_PLAN_KEY ??= "comp_full";
  process.env.PORT ??= "3000";
  process.env.NODE_ENV = "test";
}

export interface TestAppOptions {
  /** Register the `/__test__` fixtures (boom + probe). Default true. */
  readonly fixtures?: boolean;
  /**
   * Bind a Redis connection to `ORG_RATE_LIMIT_REDIS` (T-002-17).
   *
   * Left unbound by default and deliberately so: the guard treats it as
   * `@Optional()` and takes its fail-open path without one, and an ioredis
   * socket per test app would leave the runner hanging. A suite that asserts
   * rate-limit BEHAVIOUR passes its own connection here and CLOSES IT ITSELF —
   * this kit never opens or closes a socket it did not create.
   */
  readonly rateLimitRedis?: unknown;
}

export interface TestApp {
  readonly app: INestApplication;
  readonly events: SecurityEventsService;
  readonly server: () => ReturnType<INestApplication["getHttpServer"]>;
  close(): Promise<void>;
}

/** Build + init an application wired like `main.ts`. */
export async function createTestApp(options: TestAppOptions = {}): Promise<TestApp> {
  applyTestEnv();
  if (options.fixtures !== false) process.env.ENABLE_TEST_FIXTURES = "1";

  const imports: Parameters<typeof Test.createTestingModule>[0]["imports"] = [
    // Same composition as `app.module.ts`: the real `SecurityEventsService` is
    // bound as both global guards' sink, so `collectSecurityEvents()` sees
    // `org.access.capability_denied` (and a rate-limit fail-open) instead of
    // only a log line.
    //
    // NOT bound: `ORG_RATE_LIMIT_REDIS`. It is `@Optional()` on the guard and an
    // unclosed ioredis socket per test app would leave the runner hanging. A
    // suite that asserts rate-limit BEHAVIOUR must bind it and close it itself.
    //
    // ⚠️ Since T-002-15, `POST /organizations` DOES declare
    // `@OrgRateLimit("createOrganization")`. With no Redis bound the guard takes
    // its fail-open path (architecture §8) — the request is served and one
    // `auth.throttle.fail_open` event is emitted per call. That is the intended
    // production behaviour when Redis is down, and it is why a suite asserting
    // on `collectSecurityEvents()` must filter by type instead of asserting on
    // the whole list. The 50-shop cap is NOT affected: it is enforced
    // fail-closed in the service (I-10).
    TenancyModule.withCompositionRootBindings({
      imports: [AuthModule],
      providers: [
        { provide: CAPABILITY_EVENT_SINK_OVERRIDE, useExisting: SecurityEventsService },
        { provide: ORG_RATE_LIMIT_EVENT_SINK_OVERRIDE, useExisting: SecurityEventsService },
        // Only when the caller supplied one — see `TestAppOptions.rateLimitRedis`.
        ...(options.rateLimitRedis !== undefined
          ? [{ provide: ORG_RATE_LIMIT_REDIS, useValue: options.rateLimitRedis }]
          : []),
      ],
    }),
    AuthModule,
    // T-002-15/16 — the F-002 endpoints themselves. They belong in the SHARED
    // app: the route-registry audit walks this router (a table row with no live
    // route is `pending`), and the leak kit sweeps real endpoints rather than
    // only the probe fixtures.
    OrgsModule,
  ];
  if (options.fixtures !== false) imports.push(TestFixturesModule.register());

  const builder: TestingModuleBuilder = Test.createTestingModule({ imports });
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();

  // Per-test IP isolation for the auth throttle (same reason as the F-001 int
  // suite): trusting X-Forwarded-For here is a TEST convenience, and the
  // production default is asserted separately in `auth.e2e.int.test.ts`.
  (app.getHttpAdapter().getInstance() as { set: (k: string, v: unknown) => void }).set(
    "trust proxy",
    true,
  );
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
  // THE line `auth.e2e.int.test.ts` lacks: without it nothing issues a traceId
  // and every I-06 assertion would pass by never being evaluated.
  app.useGlobalFilters(new DomainExceptionFilter());
  // LISTEN ONCE, on an ephemeral loopback port.
  //
  // With `init()` alone the server is never listening, so supertest starts one
  // for EVERY request and closes it again — thousands of listen/close cycles in
  // a full run, across parallel forks. That churn is what produced the int
  // lane's transport-level flakes: `Parse Error: Expected HTTP/, RTSP/ or ICE/`
  // and `socket hang up`, landing on arbitrary files (including pure-unit ones)
  // and having nothing to do with the code under test.
  //
  // Once the server IS listening, supertest reuses its address instead, and the
  // churn disappears. `app.close()` closes the listener, so nothing leaks.
  await app.listen(0, "127.0.0.1");

  return {
    app,
    events: app.get(SecurityEventsService, { strict: false }),
    server: () => app.getHttpServer(),
    close: async () => {
      await app.close();
    },
  };
}
