// NEGATIVE FIXTURE for the apps/api boundary gate (backend.md §5.2 item 3).
// Intentionally violates `api-db-client-allowlisted`: it imports the Prisma
// client from a NON-allowlisted location (this file is not under prisma/,
// tenancy/, health/ or auth/). The boundary gate MUST flag it — if it stops
// flagging, the gate is broken and a real raw-client import could slip through.
//
// This directory is excluded from the "clean" scan and checked separately, the
// same way core-domain's __purity_fixtures__/violation.ts proves the purity gate
// still fires. It is never imported by real code.
import type { PrismaClient } from "@omnistock/db";

export type LeakedClient = PrismaClient;
