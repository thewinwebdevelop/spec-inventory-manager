// F-002 · T-002-07 — seed PlanDefinition (idempotent).
//
// docs/features/F-002/data-model.md §5.1 (LOCKED table) is the source of truth for the
// 4 rows below — mirror it exactly, do not invent values. Without this seed, EVERY
// `POST /organizations` fails closed with `503 ORG_PROVISIONING_UNAVAILABLE`
// (docs/features/F-002/architecture.md §6.2: org creation always resolves a
// `PlanDefinition` via `DEFAULT_ORG_PLAN_KEY` and fails the whole request if it can't
// find one — no silent fallback to `free`).
//
// `free` exists only for F-007/F-080 downgrade flows — nothing in F-002 (or this seed)
// attaches it to an org automatically (AC US-1: "no auto-grant of a paid/free tier").
//
// Idempotent by construction: `upsert` keyed on the unique `PlanDefinition.key` column,
// so running this script any number of times converges on exactly these 4 rows (no
// duplicates, no unique-constraint error, no drift once values here are correct).
import { PrismaClient, type Prisma } from "../src/generated/client";

export interface PlanSeedRow {
  key: string;
  name: string;
  tierLabel: string;
  features: Prisma.InputJsonValue;
}

// Mirrors docs/features/F-002/data-model.md §5.1 row for row. `plan-definition.test.ts`
// pins these exact values so an unintentional edit here goes red.
export const PLAN_DEFINITION_SEED: readonly PlanSeedRow[] = [
  {
    key: "comp_full",
    name: "Full (comp)",
    tierLabel: "Full (comp)",
    features: {
      accounting: true,
      marketplace_sync: true,
      max_users: 20,
      max_channel_accounts: 5,
    },
  },
  {
    key: "full",
    name: "Full",
    tierLabel: "Full",
    features: {
      accounting: true,
      marketplace_sync: true,
      max_users: 10,
      max_channel_accounts: 3,
    },
  },
  {
    key: "sync",
    name: "Sync",
    tierLabel: "Sync",
    features: {
      accounting: false,
      marketplace_sync: true,
      max_users: 5,
      max_channel_accounts: 2,
    },
  },
  {
    key: "free",
    name: "Free",
    tierLabel: "Free",
    features: {
      accounting: false,
      marketplace_sync: false,
      max_users: 2,
    },
  },
] as const;

/**
 * Upserts all 4 `PlanDefinition` rows by `key`. Safe to call repeatedly (dev bootstrap,
 * CI, `prisma db seed`, or a second manual run to prove idempotency) — never throws on
 * re-run and never creates duplicate rows.
 */
export async function seedPlanDefinitions(
  prisma: Pick<PrismaClient, "planDefinition">,
): Promise<void> {
  for (const plan of PLAN_DEFINITION_SEED) {
    await prisma.planDefinition.upsert({
      where: { key: plan.key },
      update: {
        name: plan.name,
        tierLabel: plan.tierLabel,
        features: plan.features,
      },
      create: {
        key: plan.key,
        name: plan.name,
        tierLabel: plan.tierLabel,
        features: plan.features,
      },
    });
  }
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    await seedPlanDefinitions(prisma);
    console.log(
      `Seeded ${PLAN_DEFINITION_SEED.length} PlanDefinition rows: ${PLAN_DEFINITION_SEED.map((p) => p.key).join(", ")}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Only run when invoked directly (`prisma db seed` → this file, or `tsx prisma/seed.ts`)
// — not when imported by tests.
if (require.main === module) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
