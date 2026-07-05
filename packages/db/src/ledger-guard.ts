// F-000 · T-000-05 — Ledger immutability guard (Layer 1: app-side, fail-fast).
// Authoritative spec: docs/features/F-000/architecture.md §2.
//
// TWO-LAYER DEFENSE for golden rule 2 (ledger is immutable):
//   Layer 2 (the GUARANTEE) = the DB trigger installed by the T-000-05 migration.
//     Even a raw psql session or a buggy service physically cannot mutate a
//     ledger row. AC8 tests Layer 2 directly.
//   Layer 1 (this file, convenience / fail-fast) = a Prisma client extension that
//     has NO update / delete / updateMany / deleteMany / upsert path for the
//     ledger models ("StockMovement", "UsageEvent"). It converts an accidental
//     mutation attempt into an immediate, clear error at the data-access seam
//     instead of a Postgres-level exception deep in a query. It is defense in
//     depth, NOT the guarantee.
//
// SCOPE (F-000): this is the guard SEAM only — the primitive that decides "may
// this model take this operation?" plus the client extension that enforces it.
// The concrete ledger WRITE primitive (the transactional append that also writes
// StockLevel + balanceAfter, golden rule 5) is deferred to F-011 (D-004). This
// file exposes create/createMany + reads for the ledger by simply not blocking
// them; it does not implement the write path itself.

import { Prisma } from "./generated/client";

/**
 * The append-only ledger models. Golden rule 2: correct a balance by INSERTing a
 * new row, never UPDATE/DELETE. Names match the Prisma model names (PascalCase).
 */
export const LEDGER_MODELS = ["StockMovement", "UsageEvent"] as const;
export type LedgerModel = (typeof LEDGER_MODELS)[number];

/**
 * Prisma operations that MUTATE existing rows. `create` / `createMany` (append)
 * and all reads are intentionally absent — the ledger accepts appends and reads.
 */
export const FORBIDDEN_LEDGER_OPERATIONS = [
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "upsert", // upsert can update an existing row → forbidden on a ledger
] as const;
export type ForbiddenLedgerOperation =
  (typeof FORBIDDEN_LEDGER_OPERATIONS)[number];

const LEDGER_MODEL_SET: ReadonlySet<string> = new Set(LEDGER_MODELS);
const FORBIDDEN_OP_SET: ReadonlySet<string> = new Set(
  FORBIDDEN_LEDGER_OPERATIONS,
);

/**
 * PURE decision primitive — the heart of the Layer-1 guard. Given a Prisma model
 * name and an operation, returns whether it must be rejected. No DB, no I/O:
 * unit-testable in isolation (this is the money/stock-adjacent logic under test).
 */
export function isForbiddenLedgerMutation(
  model: string | undefined,
  operation: string,
): boolean {
  if (model === undefined) return false; // raw/$-level ops carry no model here
  return LEDGER_MODEL_SET.has(model) && FORBIDDEN_OP_SET.has(operation);
}

/** Error thrown by the Layer-1 guard when a mutation is attempted. */
export class LedgerImmutableError extends Error {
  constructor(model: string, operation: string) {
    super(
      `ledger is immutable: ${operation} on ${model} is not allowed ` +
        `(append a new row instead). See golden rule 2 / F-000 architecture §2.`,
    );
    this.name = "LedgerImmutableError";
  }
}

/**
 * Prisma client extension implementing Layer 1. Apply with
 * `prisma.$extends(ledgerGuardExtension)`. It intercepts every model/operation
 * and throws `LedgerImmutableError` before the query is sent when the
 * model/operation pair is a forbidden ledger mutation. All other calls pass
 * through untouched (append + reads on the ledger; everything on other models).
 *
 * NOTE: this is the fail-fast seam, not the guarantee — the DB trigger remains
 * the enforcement of record.
 */
export const ledgerGuardExtension = Prisma.defineExtension({
  name: "omnistock-ledger-guard",
  query: {
    $allModels: {
      $allOperations({ model, operation, args, query }) {
        if (isForbiddenLedgerMutation(model, operation)) {
          throw new LedgerImmutableError(model as string, operation);
        }
        return query(args);
      },
    },
  },
});
