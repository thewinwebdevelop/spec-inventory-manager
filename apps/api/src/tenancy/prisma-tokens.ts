// F-002 · T-002-04 — the two Prisma clients a Nest provider may inject (§2.1).
//
//   ORG_PRISMA     every domain query, automatically filtered by the request's
//                  organizationId; no context ⇒ throws. This is the ONLY client
//                  a feature module may inject.
//   SYSTEM_PRISMA  the guarded client with no org filter. File-level allowlist:
//                  src/auth/**, src/orgs/system/**, src/tenancy/**, src/health/**,
//                  src/prisma/** (+ src/admin/** at F-085) — M-1.
import type { withOrgScope } from "@omnistock/db";
import type { GuardedPrismaClient } from "../prisma/prisma.service";

/** Org-scoped Prisma client (Proxy over the ALS context) — inject this. */
export const ORG_PRISMA = Symbol("ORG_PRISMA");

/** Unscoped (ledger-guarded) client — allowlisted files only. */
export const SYSTEM_PRISMA = Symbol("SYSTEM_PRISMA");

/** What `ORG_PRISMA` resolves to: the ledger-guarded client + the org scope. */
export type OrgScopedPrismaClient = ReturnType<typeof withOrgScope<GuardedPrismaClient>>;
