# packages/db/prisma

`schema.prisma` = the OmniStock data model (19 tables per
[docs/features/F-000/data-model.md](../../../docs/features/F-000/data-model.md),
canonical: [docs/01-data-model.md](../../../docs/01-data-model.md) §2). This is
the single home for the schema and all migrations.

- Money = `Decimal @db.Decimal(18, 4)` (Postgres `numeric`); stock/qty = `Int`.
- `organizationId` on every domain table except the AC6 allowlist
  (`User`, `Channel`, `PlanDefinition`, `RefreshToken`).
- Ledger tables (`StockMovement`, `UsageEvent`) are append-only: `createdAt` /
  `occurredAt` only, no `updatedAt`. Two-layer immutability guard (golden rule 2,
  T-000-05):
  - **Layer 2 (the guarantee)** — the raw-SQL migration
    `migrations/*_ledger_immutability` installs a `plpgsql` trigger that rejects
    `UPDATE` / `DELETE` / `TRUNCATE` on both tables (INSERT passes). Even a raw
    psql session or a buggy service cannot mutate a ledger row.
  - **Layer 1 (fail-fast)** — `src/ledger-guard.ts` (`ledgerGuardExtension`) is a
    Prisma client extension with no update/delete/upsert path for the ledger
    models; apply it via `prisma.$extends(ledgerGuardExtension)`. Convenience,
    not the guarantee. The transactional ledger WRITE primitive (golden rule 5)
    is deferred to F-011.

## Commands (needs `DATABASE_URL`; run `pnpm` from this package)

- `pnpm db:generate` — generate the Prisma client into `src/generated/client`
  (gitignored).
- `pnpm db:migrate` — create + apply a dev migration.
- `pnpm db:migrate:deploy` — apply committed migrations (CI / prod).
- `pnpm db:migrate:status` — drift check.

`migrations/` is committed as the source of truth. The generated client is not.
