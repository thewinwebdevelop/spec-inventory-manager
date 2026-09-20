// F-002 · T-002-Q6 — perf smoke (test-plan §14 · architecture §10).
//
// RIGHT-SIZED ON PURPOSE, and it matters that nobody reads this as a load test.
// Four shapes, one process, no concurrency: the question is "does a realistic
// shop's list still answer in a reasonable time", not "how many requests per
// second does this survive". A load test on a shared CI runner measures the
// runner.
//
// §14's reading rule, applied literally:
//   * the budgets are REGRESSION SIGNALS, compared against the previous run
//     ±50% — not physical constants;
//   * exceeding one demands an explanation, NOT a retry until it passes. So
//     this suite never retries, and it prints every measurement whether it
//     passed or not, because the numbers are the deliverable and the assertion
//     is only the alarm.
//
// P-03 deserves its own note. It is a DIFFERENCE of two medians, not a p95:
// the quantity under test is ~5 ms, and on a noisy runner the difference of two
// p95s is mostly the difference of two outliers — it would measure the runner's
// mood and call it tenancy overhead. The median is the statistic that survives
// a neighbour process; the tail is reported alongside so a real regression in
// the tail is still visible.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { PrismaClient } from "@omnistock/db";
import { AccessTokenService } from "../src/auth/access-token.service";
import { INT_LANE_ENABLED, applyTestEnv, createTestApp, type TestApp } from "./app.kit";
import { createSeedKit, type SeedKit, type SeededOrg } from "./f002-seed.kit";

const d = INT_LANE_ENABLED ? describe : describe.skip;

if (!INT_LANE_ENABLED) {
  console.warn(
    "[T-002-Q6] SKIPPING the perf smoke: TEST_DATABASE_URL / TEST_REDIS_URL are not set. " +
      "No budget in test-plan §14 is checked in this run.",
  );
}

/** Samples per case, after the warm-ups below. */
const SAMPLES = 30;
/** Discarded: the first requests pay for pool warm-up and JIT, not for the query. */
const WARMUPS = 5;

const MEMBERS_IN_THE_BIG_SHOP = 200;
const PENDING_INVITATIONS = 100;
const ORGS_FOR_THE_BUSY_USER = 50;

interface Measurement {
  readonly id: string;
  readonly scenario: string;
  readonly budgetMs: number;
  readonly statistic: "p95" | "median-delta";
  readonly valueMs: number;
  readonly medianMs: number;
  readonly maxMs: number;
}

const measurements: Measurement[] = [];

function quantile(samples: readonly number[], q: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  // Nearest-rank: with 30 samples p95 is the 29th, which is a real observation
  // rather than an interpolation between two.
  const rank = Math.max(1, Math.ceil(q * sorted.length));
  return sorted[rank - 1];
}

const median = (samples: readonly number[]): number => quantile(samples, 0.5);

d("F-002 perf smoke (test-plan §14)", () => {
  let app: TestApp;
  let prisma: PrismaClient;
  let kit: SeedKit;

  /** Users inserted in bulk (see `seedMembers`) — cleaned up by id. */
  const bulkUserIds: string[] = [];
  let bigShop: SeededOrg;
  let bigShopOwnerToken: string;
  let busyUserToken: string;

  const token = (userId: string): string =>
    app.app.get(AccessTokenService, { strict: false }).sign(userId);

  /**
   * 200 members without 200 password hashes.
   *
   * `kit.createUser` runs the PRODUCTION hasher, which is deliberately slow —
   * 200 of them would spend a minute proving argon2 works. These users never
   * authenticate; only the shop's Owner does, and that one comes from the kit
   * with a real hash. The placeholder is obviously not a hash, so nothing can
   * mistake these rows for accounts that could log in.
   */
  async function seedMembers(org: SeededOrg, count: number): Promise<void> {
    const stamp = Date.now();
    const users = Array.from({ length: count }, (_, i) => ({
      email: `q6-member-${i}-${stamp}@perf.test`,
      passwordHash: "not-a-hash · perf fixture · this account cannot log in",
      verified: true,
    }));
    await prisma.user.createMany({ data: users });
    const rows = await prisma.user.findMany({
      where: { email: { in: users.map((u) => u.email) } },
      select: { id: true },
    });
    bulkUserIds.push(...rows.map((r) => r.id));
    await prisma.membership.createMany({
      data: rows.map((r) => ({
        organizationId: org.id,
        userId: r.id,
        roleId: org.roles.Staff.id,
        status: "active" as const,
        activatedAt: new Date(),
      })),
    });
  }

  beforeAll(async () => {
    applyTestEnv();
    prisma = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
    await prisma.$connect();
    app = await createTestApp();
    kit = createSeedKit(prisma, { label: "q6" });

    // ── the big shop: 200 members + 100 pending invitations ───────────────
    bigShop = await kit.createOrg({ name: "ร้านใหญ่ (perf)" });
    const owner = await kit.createUser();
    await kit.addMember({
      organizationId: bigShop.id,
      userId: owner.id,
      roleId: bigShop.roles.Owner.id,
    });
    bigShopOwnerToken = token(owner.id);
    await seedMembers(bigShop, MEMBERS_IN_THE_BIG_SHOP);

    const stamp = Date.now();
    for (let i = 0; i < PENDING_INVITATIONS; i++) {
      await kit.createInvitation({
        organizationId: bigShop.id,
        email: `q6-invite-${i}-${stamp}@perf.test`,
        roleId: bigShop.roles.Staff.id,
      });
    }

    // ── the busy user: a member of 50 shops ───────────────────────────────
    const busy = await kit.createUser();
    busyUserToken = token(busy.id);
    for (let i = 0; i < ORGS_FOR_THE_BUSY_USER; i++) {
      const org = await kit.createOrg({ name: `q6-busy-${i}` });
      await kit.addMember({
        organizationId: org.id,
        userId: busy.id,
        roleId: org.roles.Staff.id,
      });
    }
  }, 600_000);

  afterAll(async () => {
    // The report is the point of this suite — printed whether the assertions
    // passed or failed, so a run that goes red still hands over its numbers.
    if (measurements.length > 0) {
      console.info(
        "\n[T-002-Q6] perf smoke — test-plan §14\n" +
          "  budgets are REGRESSION SIGNALS (compare to the previous run ±50%), not constants.\n" +
          measurements
            .map(
              (m) =>
                `  ${m.id}  ${m.statistic.padEnd(12)} ${m.valueMs.toFixed(1).padStart(7)} ms  ` +
                `(budget ${m.budgetMs} · median ${m.medianMs.toFixed(1)} · max ${m.maxMs.toFixed(1)})  ` +
                `${m.valueMs <= m.budgetMs ? "OK" : "OVER"}  — ${m.scenario}`,
            )
            .join("\n") +
          "\n",
      );
    }

    if (prisma) {
      if (bulkUserIds.length > 0) {
        await prisma.membership.deleteMany({ where: { userId: { in: bulkUserIds } } });
        await prisma.user.deleteMany({ where: { id: { in: bulkUserIds } } });
      }
      // Invitations were made by the kit and are deleted by it; memberships the
      // kit did not create are gone above, so `cleanup()` can drop the roles.
    }
    if (kit) await kit.cleanup();
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
  }, 300_000);

  /** Times [SAMPLES] sequential requests, after [WARMUPS] discarded ones. */
  async function sample(send: () => Promise<{ status: number }>): Promise<number[]> {
    for (let i = 0; i < WARMUPS; i++) {
      const res = await send();
      expect(res.status, "the scenario itself failed — the timings would be meaningless").toBe(200);
    }
    const times: number[] = [];
    for (let i = 0; i < SAMPLES; i++) {
      const started = performance.now();
      const res = await send();
      const elapsed = performance.now() - started;
      expect(res.status).toBe(200);
      times.push(elapsed);
    }
    return times;
  }

  function record(m: Measurement): void {
    measurements.push(m);
  }

  it(
    `P-01 · GET /members?limit=25 on ${MEMBERS_IN_THE_BIG_SHOP} members + ${PENDING_INVITATIONS} invitations`,
    async () => {
      const times = await sample(() =>
        request(app.server())
          .get(`/orgs/${bigShop.id}/members?limit=25`)
          .set("Authorization", `Bearer ${bigShopOwnerToken}`),
      );
      const value = quantile(times, 0.95);
      record({
        id: "P-01",
        scenario: "member list, first page",
        budgetMs: 200,
        statistic: "p95",
        valueMs: value,
        medianMs: median(times),
        maxMs: Math.max(...times),
      });

      // The page is 25 rows regardless of the shop's size — if this ever
      // exceeds the budget the likely cause is a per-row query, not volume.
      expect(value, `p95 ${value.toFixed(1)} ms — explain it, do not re-run it (§14)`).toBeLessThan(
        200,
      );
    },
    300_000,
  );

  it(`P-02 · GET /me/organizations for a user in ${ORGS_FOR_THE_BUSY_USER} shops`, async () => {
    const times = await sample(() =>
      request(app.server())
        .get("/me/organizations")
        .set("Authorization", `Bearer ${busyUserToken}`),
    );
    const value = quantile(times, 0.95);
    record({
      id: "P-02",
      scenario: "the shop list of a 50-shop user",
      budgetMs: 150,
      statistic: "p95",
      valueMs: value,
      medianMs: median(times),
      maxMs: Math.max(...times),
    });

    expect(value, `p95 ${value.toFixed(1)} ms`).toBeLessThan(150);
  }, 300_000);

  it("P-03 · the membership lookup's cost per request (org-scoped vs public)", async () => {
    // The pair: `/__test__/ping` is `@Public` and does nothing; `/__test__/probe/:orgId`
    // is org-scoped and reads only the resolved context. The difference is the
    // middleware + the two guards + the membership lookup — the price
    // architecture §1.5 pays for NOT caching membership.
    const publicTimes = await sample(() => request(app.server()).get("/__test__/ping"));
    const scopedTimes = await sample(() =>
      request(app.server())
        .get(`/__test__/probe/${bigShop.id}`)
        .set("Authorization", `Bearer ${bigShopOwnerToken}`),
    );

    const overhead = median(scopedTimes) - median(publicTimes);
    record({
      id: "P-03",
      scenario: "tenancy chain overhead (median org-scoped − median public)",
      budgetMs: 5,
      statistic: "median-delta",
      valueMs: overhead,
      medianMs: median(scopedTimes),
      maxMs: Math.max(...scopedTimes),
    });

    // A negative or near-zero delta is a legitimate outcome on a warm pool and
    // is NOT a failure — it means the lookup costs less than the run-to-run
    // noise, which is the answer §1.5 hoped for.
    expect(
      overhead,
      `the tenancy chain added ${overhead.toFixed(1)} ms per request ` +
        `(public median ${median(publicTimes).toFixed(1)} ms, org-scoped median ` +
        `${median(scopedTimes).toFixed(1)} ms). Over budget means the membership lookup got ` +
        `more expensive — §1.5's "no cache" decision is what this number prices.`,
    ).toBeLessThan(5);
  }, 300_000);

  it(`P-04 · GET /invitations?limit=25 on ${PENDING_INVITATIONS} pending`, async () => {
    const times = await sample(() =>
      request(app.server())
        .get(`/orgs/${bigShop.id}/invitations?limit=25`)
        .set("Authorization", `Bearer ${bigShopOwnerToken}`),
    );
    const value = quantile(times, 0.95);
    record({
      id: "P-04",
      scenario: "pending invitations, first page",
      budgetMs: 200,
      statistic: "p95",
      valueMs: value,
      medianMs: median(times),
      maxMs: Math.max(...times),
    });

    expect(value, `p95 ${value.toFixed(1)} ms`).toBeLessThan(200);
  }, 300_000);

  it("the fixture really is the size the budgets assume", async () => {
    // Without this, a seeding bug that produced 2 members instead of 200 would
    // make every budget above pass comfortably and prove nothing — the same
    // vacuity trap as a gate that cannot go red.
    const members = await prisma.membership.count({ where: { organizationId: bigShop.id } });
    const invitations = await prisma.invitation.count({ where: { organizationId: bigShop.id } });
    expect(members).toBe(MEMBERS_IN_THE_BIG_SHOP + 1); // + the Owner
    expect(invitations).toBe(PENDING_INVITATIONS);
    expect(measurements.map((m) => m.id)).toEqual(["P-01", "P-02", "P-03", "P-04"]);
  });
});
