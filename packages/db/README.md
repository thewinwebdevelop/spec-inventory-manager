# @omnistock/db

Single source of truth for the physical data model (`prisma/schema.prisma`) and
the generated Prisma client. See
[docs/features/F-000/architecture.md](../../docs/features/F-000/architecture.md)
for the full design.

## Consuming this package

- Import from `@omnistock/db` only — never reach into `src/generated/client`
  directly. The generated client's physical location is an implementation
  detail this barrel lets us move later.
- `apps/api` wraps the client in an injectable `PrismaService`
  (`onModuleInit → $connect`, shutdown hooks) — see `apps/api/src/prisma/`.
- `packages/core-domain` must **not** import this package (enforced by
  dependency-cruiser, see `packages/config/depcruise`). It stays framework/DB
  free per golden rule 6.

## Ledger immutability (golden rule 2)

Two layers:
1. **DB trigger** (the guarantee) — rejects `UPDATE`/`DELETE`/`TRUNCATE` on
   `StockMovement`/`UsageEvent` at the Postgres level (migration
   `*_ledger_immutability`).
2. **App guard** (`ledgerGuardExtension`, `src/ledger-guard.ts`) — a Prisma
   client extension with no mutating path exposed for the ledger models.
   Convenience/fail-fast, not the guarantee.

## organizationId scoping (golden rule 3)

**Every domain repository must obtain its Prisma client via
`withOrgScope(prisma, ctx)`** (`src/tenancy.ts`), not a bare `PrismaClient`.

F-000 ships `withOrgScope` as a **pass-through stub only** — it does not yet
inject `where: { organizationId }`. F-002/F-003 implement real enforcement
inside this one function. Because every consumer already asks for its client
through this seam, turning on enforcement later is a one-file change plus
tests, not a repo-wide refactor across every repository that touches the DB.

Do not bypass this seam "temporarily" — code that queries via a raw
`PrismaService.client` today should still route through `withOrgScope` once
F-002/F-003 land, so start new domain code against the seam now even though it
does nothing yet.

The back-office cross-org path (`docs/02-architecture.md` §5) is a
**separate** seam (`/admin/...` + super-admin guard) — never reuse
`withOrgScope` for it.
