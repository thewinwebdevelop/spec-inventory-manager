// NEGATIVE FIXTURE — do NOT import this from real code.
//
// This file deliberately violates the core-domain purity boundary
// (golden rule 6): it imports @omnistock/db (a DB package) INTO
// packages/core-domain. It exists solely so the dependency-cruiser
// "core-domain-is-pure" rule has something to catch — proving the guard
// actually fires (a guard that never catches anything is worthless).
//
// Two variants are exercised on purpose (test-plan.md §AC9 item 9a):
//   1. a VALUE import — the common case, caught by dependency-cruiser's
//      normal module-graph resolution.
//   2. a TYPE-ONLY import (`import type { ... }`) — erased at compile time,
//      so it only shows up in the graph because `options.tsPreCompilationDeps:
//      true` is set in .dependency-cruiser.cjs. Without that option (or if it
//      regresses), this second import would silently NOT be flagged even
//      though it still couples core-domain to the DB layer's types
//      (architecture.md §3.2) — so this fixture also proves that setting
//      stays effective.
//
// It is excluded from the real package build/typecheck (tsconfig `exclude`)
// and from vitest, so it never affects the shipped package. The purity check
// runs dependency-cruiser against THIS file and asserts a non-zero exit +
// the core-domain-is-pure violation is reported.
//
// @ts-nocheck — @omnistock/db need not resolve for dependency-cruiser to flag
// the forbidden edge; we only need the import statements to exist in the graph.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { PrismaClient } from "@omnistock/db";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { Prisma } from "@omnistock/db";

export const forbidden: unknown = PrismaClient;
export type ForbiddenType = Prisma;
