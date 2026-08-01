// F-002 · T-002-04 — public surface of the tenancy layer.
//
// Feature modules import from here, never from deep files. In practice they need
// exactly three things: `ORG_PRISMA` (the only client they may inject),
// `OrgContextStore` (for the rare non-HTTP path — worker/job/invitation-accept),
// and the route-tier markers. `SYSTEM_PRISMA` is exported too, but importing it
// outside the §2.1 allowlist (auth/, orgs/system/, tenancy/, health/, prisma/)
// is a CI-blocking boundary violation, not a style preference.
export { OrgContextStore, type OrgRequestContext } from "./org-context";
export { Public, UserScoped, SystemScoped, ROUTE_SCOPE_KEY, type RouteScope } from "./route-scope.decorator";
export { ORG_PRISMA, SYSTEM_PRISMA, type OrgScopedPrismaClient } from "./prisma-tokens";
export { TenancyModule } from "./tenancy.module";
export type { OrgAuthOutcome, OrgAuthState, OrgAuthRequest } from "./org-auth";
