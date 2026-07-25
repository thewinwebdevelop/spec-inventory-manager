// F-000 · T-000-08 — organizationId scoping SEAM (stub only).
// Authoritative spec: docs/features/F-000/architecture.md §5.
//
// Golden rule 3: every domain query must filter `organizationId`. Full runtime
// enforcement (resolving the org from a JWT/membership and injecting
// `where: { organizationId }` into every query) is OUT OF SCOPE for F-000 —
// that lands in F-002/F-003. F-000's job is to name the single seam so future
// features enforce in ONE place instead of re-plumbing every repository.
//
// This file ships a PASS-THROUGH stub:
//   - `withOrgScope(prisma, ctx)` returns a Prisma client extended via
//     `$extends({ query: { $allModels: { ... } } })`, exactly like
//     `ledgerGuardExtension` (see ./ledger-guard.ts) — same mechanism, adjacent
//     concern (tenant isolation vs. ledger immutability).
//   - Today it does NOT inject `where: { organizationId }`; it forwards every
//     query untouched. F-002/F-003 replace the query interceptor body with the
//     real filter — a one-file change, not a repo-wide refactor, because every
//     domain repository already asks for its client through this function.
//
// Back-office exception (docs/02-architecture.md §5): the cross-org admin path
// is a SEPARATE seam (`/admin/...` + super-admin guard), never this one. Do
// not reuse `withOrgScope` for back-office queries.
import { Prisma } from "./generated/client";

/**
 * The organization-scoping context every domain query needs. F-000 only
 * defines the shape; F-002/F-003 populate it by resolving the caller's
 * membership/JWT (see apps/api's `OrgContext` — src/tenancy/org-context.ts).
 */
export interface OrgScopeContext {
  organizationId: string;
}

/**
 * Structural constraint for `withOrgScope`'s generic parameter.
 *
 * Deliberately NOT `T extends PrismaClient`: the app's real client is
 * `new PrismaClient().$extends(ledgerGuardExtension)` (see
 * apps/api/src/prisma/prisma.service.ts, T-000-05's `GuardedPrismaClient`),
 * and `$extends`'s return type does not structurally extend `PrismaClient`
 * (it drops/reshapes members like `$on`/`$use`). Constraining to the bare
 * `PrismaClient` class type would make the documented F-002 call site —
 * `withOrgScope(prismaService.client, ctx)` — fail to typecheck (TS2345),
 * even though a guarded client is exactly what every real caller passes.
 *
 * `$extends` is the one shape every Prisma client (bare or extended) is
 * guaranteed to expose, so we constrain on that instead: "anything
 * `$extends`-able" is precisely "a Prisma client this seam can wrap."
 *
 * NOTE on the `(extension: any) => any` shape: this must stay `any` in, `any`
 * out (not `unknown`/a fixed return type) so that when TypeScript resolves
 * `prisma.$extends(...)` at a `T extends OrgScopeCompatibleClient` call site,
 * it dispatches through `T`'s OWN (precise, overloaded) `$extends` member —
 * not through this interface's member — preserving the real extended-client
 * return type (model accessors etc.) end to end. Narrowing this to `unknown`
 * would make every call site's result collapse to `unknown` (pinned by the
 * compile-only test below — do not "tighten" this without re-checking that
 * test).
 */
export interface OrgScopeCompatibleClient {
  $extends: (extension: any) => any;
}

/**
 * Factory: given a Prisma client and an org-scope context, returns a client
 * extension that (eventually) enforces `organizationId` on every domain query.
 *
 * F-000 STUB BEHAVIOR: pass-through only — every query is forwarded to the
 * underlying client untouched. No `where: { organizationId }` is injected yet.
 * This is intentional and unit-tested as a pass-through (see tenancy.test.ts);
 * F-002/F-003 turn on real enforcement here without changing this function's
 * signature or call sites.
 */
export function withOrgScope<T extends OrgScopeCompatibleClient>(prisma: T, ctx: OrgScopeContext) {
  // `ctx` is intentionally unused in the F-000 stub — kept in the signature so
  // call sites (and their tests) are already shaped for the real
  // implementation. Referenced here only to avoid an unused-var lint error
  // without disabling the rule.
  void ctx;

  return prisma.$extends(
    Prisma.defineExtension({
      name: "omnistock-org-scope-stub",
      query: {
        $allModels: {
          $allOperations({ args, query }) {
            // F-000: pass-through. F-002/F-003 inject organizationId
            // filtering into `args` here (per model's org-scoping column)
            // before calling `query(args)`.
            return query(args);
          },
        },
      },
    }),
  );
}
