// F-002 · T-002-07 — pins the PlanDefinition seed values to
// docs/features/F-002/data-model.md §5.1 (LOCKED). No live DB needed: this is a pure
// value/shape assertion so an unintentional edit to seed.ts goes red in
// `pnpm --filter @omnistock/db test` without needing Postgres.
//
// The DB-backed idempotency proof (upsert twice against real Postgres, row count/values
// unchanged) is run manually per T-002-07's report — see task report for command+output.
import { describe, expect, it } from "vitest";
import { PLAN_DEFINITION_SEED, seedPlanDefinitions } from "./seed";

describe("PLAN_DEFINITION_SEED (data-model.md §5.1)", () => {
  it("has exactly the 4 keys the spec requires, in order", () => {
    expect(PLAN_DEFINITION_SEED.map((p) => p.key)).toEqual([
      "comp_full",
      "full",
      "sync",
      "free",
    ]);
  });

  it("comp_full matches §5.1 exactly", () => {
    const plan = PLAN_DEFINITION_SEED.find((p) => p.key === "comp_full");
    expect(plan?.tierLabel).toBe("Full (comp)");
    expect(plan?.features).toEqual({
      accounting: true,
      marketplace_sync: true,
      max_users: 20,
      max_channel_accounts: 5,
    });
  });

  it("full matches §5.1 exactly", () => {
    const plan = PLAN_DEFINITION_SEED.find((p) => p.key === "full");
    expect(plan?.tierLabel).toBe("Full");
    expect(plan?.features).toEqual({
      accounting: true,
      marketplace_sync: true,
      max_users: 10,
      max_channel_accounts: 3,
    });
  });

  it("sync matches §5.1 exactly", () => {
    const plan = PLAN_DEFINITION_SEED.find((p) => p.key === "sync");
    expect(plan?.tierLabel).toBe("Sync");
    expect(plan?.features).toEqual({
      accounting: false,
      marketplace_sync: true,
      max_users: 5,
      max_channel_accounts: 2,
    });
  });

  it("free matches §5.1 exactly", () => {
    const plan = PLAN_DEFINITION_SEED.find((p) => p.key === "free");
    expect(plan?.tierLabel).toBe("Free");
    expect(plan?.features).toEqual({
      accounting: false,
      marketplace_sync: false,
      max_users: 2,
    });
  });

  it("accounting=true only on the two Full tiers (comp_full, full) — never sync/free", () => {
    for (const plan of PLAN_DEFINITION_SEED) {
      const accounting = (plan.features as Record<string, unknown>).accounting;
      const expected = plan.key === "comp_full" || plan.key === "full";
      expect(accounting).toBe(expected);
    }
  });

  it("marketplace_sync=true on comp_full/full/sync, false only on free", () => {
    for (const plan of PLAN_DEFINITION_SEED) {
      const sync = (plan.features as Record<string, unknown>).marketplace_sync;
      expect(sync).toBe(plan.key !== "free");
    }
  });

  it("free has no max_channel_accounts cap (unlike the 3 paid tiers)", () => {
    const free = PLAN_DEFINITION_SEED.find((p) => p.key === "free");
    expect((free?.features as Record<string, unknown>).max_channel_accounts).toBeUndefined();
    for (const key of ["comp_full", "full", "sync"] as const) {
      const plan = PLAN_DEFINITION_SEED.find((p) => p.key === key);
      expect((plan?.features as Record<string, unknown>).max_channel_accounts).toBeTypeOf(
        "number",
      );
    }
  });

  it("every row has a non-empty name (required column) and a key unique across rows", () => {
    const keys = new Set<string>();
    for (const plan of PLAN_DEFINITION_SEED) {
      expect(plan.name.length).toBeGreaterThan(0);
      expect(keys.has(plan.key)).toBe(false);
      keys.add(plan.key);
    }
  });
});

describe("seedPlanDefinitions", () => {
  it("upserts every row of PLAN_DEFINITION_SEED, keyed on `key` (fake client, no DB)", async () => {
    const upsertCalls: unknown[] = [];
    const fakePrisma = {
      planDefinition: {
        upsert: async (args: unknown) => {
          upsertCalls.push(args);
          return args;
        },
      },
    };

    await seedPlanDefinitions(fakePrisma as never);

    expect(upsertCalls).toHaveLength(PLAN_DEFINITION_SEED.length);
    for (const [i, plan] of PLAN_DEFINITION_SEED.entries()) {
      const call = upsertCalls[i] as {
        where: { key: string };
        create: { key: string; name: string; tierLabel: string; features: unknown };
        update: { name: string; tierLabel: string; features: unknown };
      };
      expect(call.where).toEqual({ key: plan.key });
      expect(call.create).toEqual({
        key: plan.key,
        name: plan.name,
        tierLabel: plan.tierLabel,
        features: plan.features,
      });
      expect(call.update).toEqual({
        name: plan.name,
        tierLabel: plan.tierLabel,
        features: plan.features,
      });
    }
  });

  it("is a plain loop of independent upserts — calling it twice is a no-op shape-wise", async () => {
    const upsertCalls: unknown[] = [];
    const fakePrisma = {
      planDefinition: {
        upsert: async (args: unknown) => {
          upsertCalls.push(args);
          return args;
        },
      },
    };

    await seedPlanDefinitions(fakePrisma as never);
    await seedPlanDefinitions(fakePrisma as never);

    expect(upsertCalls).toHaveLength(PLAN_DEFINITION_SEED.length * 2);
    // Same `where`/`create`/`update` payload both times per key — upsert (not create) is
    // what makes a real DB converge instead of throwing a unique-constraint error.
    const firstRun = upsertCalls.slice(0, PLAN_DEFINITION_SEED.length);
    const secondRun = upsertCalls.slice(PLAN_DEFINITION_SEED.length);
    expect(secondRun).toEqual(firstRun);
  });
});
