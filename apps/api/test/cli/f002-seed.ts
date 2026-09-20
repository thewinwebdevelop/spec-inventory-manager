#!/usr/bin/env tsx
// F-002 · T-002-22 — seed CLI entry point (architecture §12.2 item 2).
//
//   pnpm --filter api exec tsx test/cli/f002-seed.ts --scenario=two-orgs
//
// Prints ONE JSON object on stdout (`{ scenario, orgs, users, memberships,
// invitations, notes }`) for Playwright/Flutter to parse; diagnostics go to
// stderr. Everything with a decision in it lives in `seed-cli.ts` so it can be
// unit tested — this file only wires stdin/stdout/exit and is deliberately
// too small to hide a bug.
import { PrismaClient } from "@omnistock/db";
import { runSeedCli } from "./seed-cli";

async function main(): Promise<void> {
  const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  const prisma = new PrismaClient(url ? { datasources: { db: { url } } } : undefined);
  try {
    const code = await runSeedCli(process.argv.slice(2), process.env, {
      prisma,
      stdout: (line) => process.stdout.write(`${line}\n`),
      stderr: (line) => process.stderr.write(`${line}\n`),
    });
    process.exitCode = code;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
