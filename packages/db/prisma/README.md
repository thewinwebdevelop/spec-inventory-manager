# packages/db/prisma

`schema.prisma` = the OmniStock data model (19 tables per
[docs/features/F-000/data-model.md](../../../docs/features/F-000/data-model.md),
canonical: [docs/01-data-model.md](../../../docs/01-data-model.md) §2). This is
the single home for the schema and all migrations.

- Money = `Decimal @db.Decimal(18, 4)` (Postgres `numeric`); stock/qty = `Int`.
- `organizationId` on every domain table except the AC6 allowlist
  (`User`, `Channel`, `PlanDefinition`, `RefreshToken`).
- Ledger tables (`StockMovement`, `UsageEvent`) are append-only: `createdAt` /
  `occurredAt` only, no `updatedAt`. The DB immutability trigger that rejects
  UPDATE/DELETE lands in **T-000-05** (not in this schema).

## Commands (needs `DATABASE_URL`; run `pnpm` from this package)

- `pnpm db:generate` — generate the Prisma client into `src/generated/client`
  (gitignored).
- `pnpm db:migrate` — create + apply a dev migration.
- `pnpm db:migrate:deploy` — apply committed migrations (CI / prod).
- `pnpm db:migrate:status` — drift check.

`migrations/` is committed as the source of truth. The generated client is not.
