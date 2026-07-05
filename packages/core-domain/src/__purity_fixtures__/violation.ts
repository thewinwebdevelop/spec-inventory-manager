// NEGATIVE FIXTURE — do NOT import this from real code.
//
// This file deliberately violates the core-domain purity boundary
// (golden rule 6): it imports @omnistock/db (a DB package) INTO
// packages/core-domain. It exists solely so the dependency-cruiser
// "core-domain-is-pure" rule has something to catch — proving the guard
// actually fires (a guard that never catches anything is worthless).
//
// It is excluded from the real package build/typecheck (tsconfig `exclude`)
// and from vitest, so it never affects the shipped package. The purity check
// runs dependency-cruiser against THIS file and asserts a non-zero exit +
// the core-domain-is-pure violation is reported.
//
// @ts-nocheck — @omnistock/db need not resolve for dependency-cruiser to flag
// the forbidden edge; we only need the import statement to exist in the graph.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { PrismaClient } from "@omnistock/db";

export const forbidden: unknown = PrismaClient;
