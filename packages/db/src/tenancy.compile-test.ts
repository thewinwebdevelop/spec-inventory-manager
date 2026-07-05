// F-000 · T-000-08 fix pass — COMPILE-ONLY test pinning the
// `withOrgScope` / ledger-guarded-client type composition.
//
// This file has no runtime assertions and is not a vitest suite — it exists
// purely so `tsc -p tsconfig.json --noEmit` (the `typecheck` task every CI run
// exercises) fails loudly if `withOrgScope`'s generic constraint ever regresses
// to something that can't accept the ledger-guarded Prisma client.
//
// Why this matters: `packages/db/src/tenancy.ts` used to constrain its
// generic as `T extends PrismaClient`. The app's real client
// (`apps/api/src/prisma/prisma.service.ts`'s `GuardedPrismaClient`) is
// `new PrismaClient().$extends(ledgerGuardExtension)`, whose type does NOT
// structurally extend `PrismaClient` (it reshapes/drops members like
// `$on`/`$use`). That made the documented F-002 call site —
// `withOrgScope(prismaService.client, ctx)` — a real TS2345 compile error.
//
// This file reconstructs that exact composition (bare client -> $extends the
// ledger guard -> feed the result into withOrgScope) using only
// `@omnistock/db` exports, so the seam is pinned without this package
// depending on `apps/api`.
import { PrismaClient } from "./generated/client";
import { ledgerGuardExtension } from "./ledger-guard";
import { withOrgScope, type OrgScopeContext } from "./tenancy";

// Mirrors apps/api/src/prisma/prisma.service.ts's `createGuardedClient`.
function createGuardedClient() {
  return new PrismaClient().$extends(ledgerGuardExtension);
}

const ctx: OrgScopeContext = { organizationId: "org_123" };

// 1) The bare (unguarded) client must still typecheck through the seam.
const bareClient = new PrismaClient();
const scopedBare = withOrgScope(bareClient, ctx);
// A model accessor must still resolve on the returned client (i.e. the
// return type isn't collapsed to `unknown`/`any`) — this line would fail to
// typecheck (`Property 'findMany' does not exist on type ...`) if
// `withOrgScope`'s composition stopped preserving the extended client shape.
void scopedBare.stockLevel.findMany;

// 2) THE regression this file pins: the ledger-guarded client
// (`new PrismaClient().$extends(ledgerGuardExtension)`, exactly what
// `PrismaService.client` is) must ALSO typecheck through `withOrgScope` — this
// is the documented F-002 call site (architecture.md §5.1:
// `withOrgScope(prismaService.client, ctx)`).
const guardedClient = createGuardedClient();
const scopedGuarded = withOrgScope(guardedClient, ctx);
void scopedGuarded.stockLevel.findMany;

// 3) Guarded-then-scoped must still expose the ledger guard's own surface
// too (composition is genuinely nested, not just "compiles by accident" via
// a loose `any`).
void scopedGuarded.$extends;
