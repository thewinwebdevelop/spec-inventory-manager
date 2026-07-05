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
