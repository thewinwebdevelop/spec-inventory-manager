// F-002 · T-002-04 — tenancy runtime wiring (architecture §1.1–§2.1).
// (F-000 · T-000-08 wired the seam; this wires the real chain.)
//
//   OrgContextMiddleware  every request  → verify bearer, resolve org, open the
//                                          ONE AsyncLocalStorage (packages/db)
//   OrgScopeGuard (APP_GUARD)            → default-deny; 401/422/403 per §1.4
//   CapabilityGuard (APP_GUARD, second)  → fail-closed capability layer (§3.1)
//   ORG_PRISMA / SYSTEM_PRISMA           → the only two clients a provider may
//                                          inject (§2.1)
//
// `@Global` because org context is cross-cutting: every feature module will
// inject `ORG_PRISMA`/`OrgContextStore`, and re-importing this everywhere would
// be pure boilerplate.
import {
  Global,
  Module,
  RequestMethod,
  type DynamicModule,
  type MiddlewareConsumer,
  type ModuleMetadata,
  type NestModule,
  type Provider,
} from "@nestjs/common";
import { APP_GUARD, DiscoveryModule } from "@nestjs/core";
import { loadEnv } from "@omnistock/config";
import { PrismaModule } from "../prisma/prisma.module";
import { PrismaService } from "../prisma/prisma.service";
import {
  CapabilityGuard,
  CAPABILITY_EVENT_SINK,
  CAPABILITY_EVENT_SINK_OVERRIDE,
  LoggingCapabilityEventSink,
  type CapabilityEventSink,
} from "../common/authz";
import { OrgContextStore } from "./org-context";
import { OrgContextMiddleware } from "./org-context.middleware";
import { OrgScopeGuard } from "./org-scope.guard";
import { RouteScopeRegistry } from "./route-scope.registry";
import { ACCESS_TOKEN_VERIFIER, JwtAccessTokenVerifier } from "./access-token-verifier";
import { ORG_PRISMA, SYSTEM_PRISMA, type OrgScopedPrismaClient } from "./prisma-tokens";
import { createOrgPrismaProxy } from "./org-prisma.provider";

@Global()
@Module({
  // DiscoveryModule → RouteScopeRegistry reads Nest's own route metadata, which
  // is how middleware (no Reflector, no ExecutionContext) can still honour
  // @Public()/@UserScoped() and refuse to build a context there (I-3).
  imports: [PrismaModule, DiscoveryModule],
  providers: [
    OrgContextStore,
    RouteScopeRegistry,
    OrgContextMiddleware,
    {
      // Verify-only twin of auth's AccessTokenService — the boundary gate
      // forbids tenancy/ from importing a feature module (see
      // access-token-verifier.ts). Same secret, same pinned alg/typ.
      provide: ACCESS_TOKEN_VERIFIER,
      useFactory: () => new JwtAccessTokenVerifier(loadEnv(process.env).JWT_ACCESS_SECRET),
    },
    {
      provide: SYSTEM_PRISMA,
      useFactory: (prisma: PrismaService) => prisma.client,
      inject: [PrismaService],
    },
    {
      provide: ORG_PRISMA,
      useFactory: (prisma: PrismaService, store: OrgContextStore) =>
        createOrgPrismaProxy(prisma.client, store) as OrgScopedPrismaClient,
      inject: [PrismaService, OrgContextStore],
    },
    { provide: APP_GUARD, useClass: OrgScopeGuard },
    // ORDER MATTERS: Nest runs APP_GUARDs in registration order, and this one
    // must run SECOND. OrgScopeGuard answers "are you an active member of this
    // org?" (`ORG_ACCESS_DENIED`); only then does the capability layer ask "may
    // you do THIS?" (`FORBIDDEN`). Swapped, a non-member of the org would be
    // told they lack a capability — the exact conflation I-5 forbids.
    { provide: APP_GUARD, useClass: CapabilityGuard },
    // Sink for `org.access.capability_denied`. The real `SecurityEventsService`
    // lives in `auth/`, which `tenancy/` and `common/` may not import (depcruise
    // `api-leafward-only`), so the composition root supplies it through
    // `withCapabilityEventSink` and it arrives here as the OVERRIDE token.
    // Log-only is the fallback, never the silent default in production wiring —
    // `capability-sink.binding.test.ts` fails if app.module stops providing it.
    {
      provide: CAPABILITY_EVENT_SINK,
      useFactory: (override: CapabilityEventSink | null) =>
        override ?? new LoggingCapabilityEventSink(),
      inject: [{ token: CAPABILITY_EVENT_SINK_OVERRIDE, optional: true }],
    },
  ],
  exports: [OrgContextStore, ORG_PRISMA, SYSTEM_PRISMA],
})
export class TenancyModule implements NestModule {
  /**
   * T-002-13 — hand the capability layer its REAL event sink.
   *
   * `CapabilityGuard` is registered here (order versus `OrgScopeGuard` is
   * load-bearing — see above), so it resolves `CAPABILITY_EVENT_SINK` in THIS
   * module's injector. `SecurityEventsService` lives in `auth/`, which this file
   * may not import (depcruise `api-leafward-only`). So the composition root
   * passes both the module that owns the service and a binding for
   * `CAPABILITY_EVENT_SINK_OVERRIDE`, which the provider above prefers over the
   * log-only fallback.
   *
   * Without this, `org.access.capability_denied` only ever reaches a log line:
   * `collectSecurityEvents()` — @qa's collector and F-005's future outbox —
   * subscribes to `SecurityEventsService` and would never see a single denial.
   * The guard would still deny correctly, which is exactly what makes the gap
   * easy to miss: nothing is broken, the evidence is just gone.
   */
  static withCapabilityEventSink(options: {
    /** Module(s) that provide the sink — e.g. `[AuthModule]`. */
    readonly imports: NonNullable<ModuleMetadata["imports"]>;
    /** Binding for `CAPABILITY_EVENT_SINK_OVERRIDE`. */
    readonly provider: Provider;
  }): DynamicModule {
    return {
      module: TenancyModule,
      imports: options.imports,
      providers: [options.provider],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    // Every route, every verb. `*splat` is express-5 wildcard syntax (Nest 11).
    // The middleware is transparent — it only records what it found on
    // `req.orgAuth` — so applying it everywhere cannot change a route's wire
    // behaviour by itself.
    consumer.apply(OrgContextMiddleware).forRoutes({ path: "*splat", method: RequestMethod.ALL });
  }
}
