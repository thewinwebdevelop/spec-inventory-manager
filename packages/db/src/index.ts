// Entry point for @omnistock/db.
// Re-exports the generated Prisma client + types. The client is generated from
// prisma/schema.prisma (19 tables per docs/features/F-000/data-model.md) into
// src/generated/client via `pnpm db:generate`. Ledger-immutability trigger
// migration lands in T-000-05.
export * from "./generated/client";
