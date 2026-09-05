// F-002 · T-002-18 ★ — the org serialization anchor, typed for `apps/api`
// (architecture §5/§5.1 · backend.md §3.3).
//
// WHY THIS FILE EXISTS — TWO REASONS, BOTH LOAD-BEARING
//
//  1. THE BOUNDARY. `runInOrgLockTransaction` and `USER_SELECT` live in
//     `packages/db` because they are MECHANISM (golden rule: `packages/db` holds
//     no framework). The boundary gate `api-db-client-allowlisted` forbids a
//     feature module from importing `@omnistock/db` at all — the rule that keeps
//     the raw client out of `src/orgs/` and forces every domain query through a
//     scoped provider. A membership write needs both symbols (without the anchor
//     the Owner ≥ 1 invariant is not held; without `USER_SELECT`, `passwordHash`
//     becomes selectable), so they are handed out HERE, by the layer that
//     already owns tenancy mechanism for `apps/api` — exactly the precedent
//     `prisma-tokens.ts` set for `SystemPrismaClient`. The boundary rule stays
//     as strict as it was.
//
//  2. THE TRANSACTION CLIENT'S TYPE. `OrgLockTxOf<TClient>` in `packages/db`
//     infers the tx type from `TClient["$transaction"]`, and against the
//     `$extends`-ed client that `withOrgScope` returns that inference collapses
//     to `unknown` — Prisma's extended `$transaction` is not the plain
//     `(fn, options) => Promise<R>` shape the conditional matches. `unknown`
//     would mean every `tx.membership…` in a service silently becomes an
//     `any`-ish dead end (or, with `noImplicitAny`, a wall of errors that the
//     next person "fixes" with a cast). So the type is stated explicitly here,
//     once, and the wrapper below hands it to the callback.
//
// ⛔ THIS IS NOT A GENERAL ESCAPE HATCH. Each symbol re-exported is a decision
// that a feature module may hold that piece of mechanism directly, and
// `PrismaClient` itself never qualifies — that is what `ORG_PRISMA` is for.
import {
  runInOrgLockTransaction as runInOrgLockTransactionMechanism,
  type OrgLockCapableClient,
  type OrgLockTransactionOptions,
} from "@omnistock/db";
import type { OrgScopedPrismaClient } from "./prisma-tokens";

export { USER_SELECT } from "@omnistock/db";
export type { OrgLockTransactionOptions } from "@omnistock/db";

/**
 * What `runInOrgLockTransaction(ORG_PRISMA, …)` hands its callback: the same
 * org-scoped client, minus the members an interactive transaction does not have.
 *
 * Prisma removes those at runtime, and `lockCurrentOrganization` REFUSES a
 * client that still exposes them (a `FOR UPDATE` outside a transaction is
 * released immediately, so the "lock" would be a no-op that reads as
 * protection). Stating it in the type means a service cannot pass the injected
 * client where a `tx` is expected — which is the M-2 rule ("every read that
 * feeds a decision goes through `tx`") enforced by the compiler instead of by
 * review.
 */
export type OrgLockTx = Omit<
  OrgScopedPrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Open the transaction every architecture §5 write must run in: the §5.2
 * timeouts are applied, `SET LOCAL lock_timeout` + `SELECT … FROM
 * "Organization" … FOR UPDATE` run as the FIRST statements, and lock contention
 * comes back as `409 CONFLICT` + `details.reason="busy"` instead of a 500.
 *
 * A thin typed adapter — it adds NO behaviour. All of the above happens in
 * `packages/db`; this signature only pins `prisma` to the org-scoped client and
 * `tx` to {@link OrgLockTx}.
 */
export function runInOrgLockTransaction<R>(
  prisma: OrgScopedPrismaClient,
  fn: (tx: OrgLockTx) => Promise<R>,
  options?: OrgLockTransactionOptions,
): Promise<R> {
  return runInOrgLockTransactionMechanism<OrgLockCapableClient, R>(
    // The extended client DOES satisfy `OrgLockCapableClient` at runtime (it is
    // the whole point of the `ORG_PRISMA` proxy binding `$transaction` to the
    // scoped client); it is the OVERLOADED generic signature that structural
    // assignability cannot see through. Asserted once, here, rather than at
    // every call site.
    prisma as unknown as OrgLockCapableClient,
    fn,
    options,
  );
}
