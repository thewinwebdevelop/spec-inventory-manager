// F-002 · T-002-04 — tenancy runtime wiring (architecture §1.1–§2.1).
// (F-000 · T-000-08 wired the seam; this wires the real chain.)
//
//   OrgContextMiddleware  every request  → verify bearer, resolve org, open the
//                                          ONE AsyncLocalStorage (packages/db)
//   OrgScopeGuard (APP_GUARD)            → default-deny; 401/422/403 per §1.4
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
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { APP_GUARD, DiscoveryModule } from "@nestjs/core";
import { loadEnv } from "@omnistock/config";
import { PrismaModule } from "../prisma/prisma.module";
import { PrismaService } from "../prisma/prisma.service";
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
  ],
  exports: [OrgContextStore, ORG_PRISMA, SYSTEM_PRISMA],
})
export class TenancyModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Every route, every verb. `*splat` is express-5 wildcard syntax (Nest 11).
    // The middleware is transparent — it only records what it found on
    // `req.orgAuth` — so applying it everywhere cannot change a route's wire
    // behaviour by itself.
    consumer.apply(OrgContextMiddleware).forRoutes({ path: "*splat", method: RequestMethod.ALL });
  }
}
