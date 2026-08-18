// F-002 · T-002-03 — COMPILE-ONLY test pinning `runInOrgLockTransaction`'s
// generic composition. No runtime assertions, not a vitest suite: it exists so
// `tsc -p tsconfig.json --noEmit` (the `typecheck` task CI runs) fails loudly if
// the helper stops accepting the clients apps/api actually has.
//
// Why: the real call site is `runInOrgLockTransaction(prismaService.client, …)`,
// where `client` is `new PrismaClient().$extends(ledgerGuardExtension)` — a type
// that does NOT structurally extend `PrismaClient` — and possibly
// `withOrgScope(...)` on top of that (ORG_PRISMA, architecture §2.1). Inside the
// callback, services must still reach model accessors on `tx`. If
// `OrgLockTxOf<T>` ever collapses to `unknown`/`never`, every §5 service breaks
// at once with an error that points at the service, not at this helper.
import { PrismaClient } from "../generated/client";
import { ledgerGuardExtension } from "./ledger-guard";
import { runInOrgLockTransaction, lockCurrentOrganization } from "./org-lock";
import { withOrgScope, type OrgScopeContext } from "./tenancy";

const ctx: OrgScopeContext = { organizationId: "org_123" };

// 1) the bare client
void runInOrgLockTransaction(new PrismaClient(), async (tx) => {
  // the tx must still be a usable Prisma client, not `unknown`
  void (await tx.membership.findMany({ where: { organizationId: ctx.organizationId } }));
  // …and it must satisfy the anchor's own structural contract
  await lockCurrentOrganization(tx, ctx);
  return 1;
});

// 2) THE real call site: the ledger-guarded client (PrismaService.client)
const guarded = new PrismaClient().$extends(ledgerGuardExtension);
void runInOrgLockTransaction(guarded, async (tx) => tx.invitation.count(), { operation: "createInvitation" });

// 3) ORG_PRISMA: guarded + org-scoped, which is what a feature module injects
const orgScoped = withOrgScope(guarded, ctx);
void runInOrgLockTransaction(orgScoped, async (tx) => tx.membership.count());
