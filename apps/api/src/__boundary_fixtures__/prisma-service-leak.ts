// NEGATIVE FIXTURE for `api-prisma-service-allowlisted` (security review A-1).
//
// The sibling fixture `db-leak.ts` proves the gate catches a RAW Prisma client
// import. This one proves it catches the other door, which it did not:
// `PrismaService`. `PrismaModule` is `@Global()`, so any feature module can
// inject the service without importing the module, and `.client` on it is the
// ledger-guarded but NOT org-scoped client. A file in `src/orgs/` doing
//
//     @Inject(PrismaService) private readonly prisma: PrismaService
//     this.prisma.client.membership.findMany({})
//
// reads every tenant's rows — and before this rule existed, the allowlist test
// passed 5/5, depcruise reported 0 violations, lint passed and the unit suite
// passed. Golden rule 3 had no working fence.
//
// Why a boundary rule as well as the textual allowlist test
// (`orgs/system/system-prisma-allowlist.test.ts`): they fail differently. The
// textual gate reads a file's own source, so it catches an injection site even
// when depcruise sees no direct edge; this rule reads the import graph, so it
// catches an import whose local binding was renamed.
//
// ⚠️ WHAT NEITHER OF THEM CATCHES — measured, not assumed:
//
//     // in an ALLOWLISTED file, e.g. tenancy/index.ts
//     export { PrismaService as Db } from "../prisma/prisma.service";
//     // in a feature file
//     import { Db } from "../tenancy";
//
// The textual gate misses it (the feature file never writes "PrismaService")
// and so does this rule (the feature's direct edge is to `tenancy/index.ts`,
// and depcruise `from`/`to` matches direct edges). I tried exactly this and
// both gates stayed green. A transitive (`reachable`) rule would catch it and
// also flag every legitimate path through tenancy's ORG_PRISMA provider, so it
// is not worth having.
//
// The residual risk is accepted rather than hidden: laundering requires EDITING
// AN ALLOWLISTED FILE to add a renamed re-export, in a directory whose whole
// purpose is that its constraints get reviewed. That is a deliberate, visible
// act — unlike the hole this rule closes, which needed nothing but a new file
// in a feature folder.
//
// This file is excluded from the clean scan and from the textual gate's scan,
// and checked on its own. It is never imported by real code.
import type { PrismaService } from "../prisma/prisma.service";

export type LeakedService = PrismaService;
