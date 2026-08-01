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

// organizationId scoping seam (F-000 · T-000-08 seam → F-002 · T-002-02 real
// enforcement · golden rule 3). `withOrgScope` now injects/verifies the org on
// every model operation and fails closed on anything it cannot prove; the
// per-operation contract is F-002 architecture §2.2, and the strategy table is
// exported so tests enumerate it instead of re-declaring it (U-DB-07).
export {
  withOrgScope,
  applyOrgScope,
  ORG_SCOPE_OPERATION_STRATEGY,
  MissingOrgContextError,
  OrgScopeViolationError,
  UnsupportedOrgScopeOperationError,
  UnregisteredOrgScopeModelError,
} from "./tenancy";
export type {
  OrgScopeContext,
  OrgScopeCompatibleClient,
  OrgScopeOperation,
  OrgScopeStrategy,
  ApplyOrgScopeParams,
} from "./tenancy";

// C-4 / NEW-8 — the ONLY sanctioned projection of the org-agnostic `User`
// model. Feature modules must use this instead of an inline `select` (and never
// `include: { user: true }`): it has no relation keys, so the "walk through User
// back down into another org's rows" shape cannot be written. See ./user-select.ts.
export { USER_SELECT } from "./user-select";
export type { UserSelect } from "./user-select";

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
