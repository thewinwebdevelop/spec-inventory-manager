#!/usr/bin/env -S npx tsx
// F-003 · T-003-B11 — `pnpm --filter api backfill:f003` (data-model §4.2 ·
// architecture §12 · runbook §3 condition 2).
//
// Runs the committed `*_f003_backfill_manage_roles/migration.sql` in one
// transaction (packages/db/src/backfill-f003.ts — the SQL is never restated
// here, G3-10), then the two read-only checks. Lives in apps/api only because
// this is where the capability registry (core-domain) and the database package
// meet; it adds no logic of its own.
//
// Exit 0 = backfill ran AND every Role.capabilities ⊆ registry.
// Exit 1 = a role holds an unregistered key (listed), or the run failed (e.g.
//          f003_owner_invariant_violation org=<id> — nothing was written).
// Needs DATABASE_URL.
import { CAPABILITY_REGISTRY } from "@omnistock/core-domain";
import { PrismaClient, backfillF003Report } from "@omnistock/db";

/* eslint-disable no-console */
async function main(): Promise<number> {
  const prisma = new PrismaClient();
  try {
    const report = await backfillF003Report(
      prisma,
      CAPABILITY_REGISTRY.map((c) => c.key),
    );
    console.log(
      `backfill:f003 rows_updated=${report.rolesUpdated} sql_sha256=${report.executedSha256}`,
    );
    console.log(
      `backfill:f003 rollback_safety_count=${report.rollbackSafetyCount} (architecture §12: 0 = code rollback safe)`,
    );
    for (const r of report.rolesOutsideRegistry) {
      console.error(
        `backfill:f003 role_outside_registry org=${r.organizationId} role=${r.roleId} keys=${r.unregistered.join(",")}`,
      );
    }
    console.log(`backfill:f003 roles_outside_registry=${report.rolesOutsideRegistry.length}`);
    return report.ok ? 0 : 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(
      `backfill:f003 FAILED (rolled back): ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  },
);
