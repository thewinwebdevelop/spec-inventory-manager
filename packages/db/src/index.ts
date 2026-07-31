// Entry point for @omnistock/db.
// Re-exports the generated Prisma client + types. The client is generated from
// prisma/schema.prisma (19 tables per docs/features/F-000/data-model.md) into
// src/generated/client via `pnpm db:generate`. Ledger-immutability trigger
// migration lands in T-000-05.
export * from "./generated/client";

// Ledger immutability — Layer 1 app-side guard (F-000 · T-000-05).
// Layer 2 (the guarantee) is the DB trigger in the ledger_immutability migration.
export {
  LEDGER_MODELS,
  FORBIDDEN_LEDGER_OPERATIONS,
  isForbiddenLedgerMutation,
  LedgerImmutableError,
  ledgerGuardExtension,
} from "./ledger-guard";
export type { LedgerModel, ForbiddenLedgerOperation } from "./ledger-guard";

// organizationId scoping seam (F-000 · T-000-08 · golden rule 3).
// STUB ONLY — pass-through today; F-002/F-003 implement real enforcement.
// See architecture.md §5 and ./tenancy.ts's header comment.
export { withOrgScope } from "./tenancy";
export type { OrgScopeContext } from "./tenancy";

// Tenancy register (F-002 · T-002-01) — which models are org-scoped, which are
// deliberately org-agnostic, and which is the tenant root. Unit-tested against
// the real datamodel (org-models.test.ts) so it cannot drift from the schema.
// The enforcement that consumes it is T-002-02's real `withOrgScope`.
export {
  ORGANIZATION_MODEL,
  ORG_SCOPED_MODELS,
  ORG_AGNOSTIC_MODELS,
  isOrgScopedModel,
} from "./org-models";
export type { OrgScopedModel, OrgAgnosticModel } from "./org-models";
