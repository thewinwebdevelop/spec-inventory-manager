// Entry point for @omnistock/db.
// Re-exports the generated Prisma client + types. The client is generated from
// prisma/schema.prisma (19 tables per docs/features/F-000/data-model.md) into
// src/generated/client via `pnpm db:generate`. Ledger-immutability trigger
// migration lands in T-000-05.
export * from "../generated/client";

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

// Organization serialization anchor + tx/lock timeout policy (F-002 · T-002-03
// · architecture §5.1/§5.2). `runInOrgLockTransaction` is how every §5 write
// opens its transaction: it applies the §5.2 timeouts, takes the anchor as the
// first statement, and turns lock contention into `OrgBusyError` (409 CONFLICT +
// `details.reason="busy"`) instead of a 500. `ORG_LOCK_REQUIRED_OPERATIONS` is
// the single list of operations that MUST do so (§12.2 row 6) — qa enumerates
// it, nobody re-declares it.
export {
  ORG_LOCK_REQUIRED_OPERATIONS,
  ORG_BUSY_HTTP_STATUS,
  ORG_BUSY_ERROR_CODE,
  ORG_BUSY_DETAILS,
  OrgBusyError,
  OrgLockAnchorMissingError,
  OrgLockContextMismatchError,
  OrgLockOutsideTransactionError,
  classifyOrgLockError,
  getOrgContext,
  lockCurrentOrganization,
  rethrowOrgLockError,
  runInOrgLockTransaction,
  runWithOrgContext,
  toOrgBusyError,
} from "./org-lock";
export type {
  OrgBusyReason,
  OrgLockCapableClient,
  OrgLockRequiredOperation,
  OrgLockTransactionClient,
  OrgLockTransactionOptions,
  OrgLockTxOf,
} from "./org-lock";

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

// F-002 · D-018 — the ONE code path that turns an invitation token into the
// value stored in `Invitation.tokenHash` (architecture §7, data-model §2).
// @qa's seed kit resolves `hashInvitationToken` from this module by name rather
// than reimplementing it, so it must stay exported under exactly this name.
export {
  generateInvitationToken,
  hashInvitationToken,
  INVITATION_TOKEN_BYTES,
} from "./invitation-token";
