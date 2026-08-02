// F-002 · T-002-22 — DB-backed proof that the seed kit produces the STATES the
// test plan needs, against a real Postgres (deliverable 1).
//
// Requires TEST_DATABASE_URL. Postgres is SHARED with the other suites, so this
// file creates uniquely-named rows and deletes exactly those rows by id — never
// a TRUNCATE, never a `deleteMany({})`.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@omnistock/db";
import { createSeedKit, MissingProductionDependencyError, type SeedKit } from "./f002-seed.kit";
import { runSeedCli } from "./cli/seed-cli";

const TEST_DB = process.env.TEST_DATABASE_URL;
const enabled = Boolean(TEST_DB);
const d = enabled ? describe : describe.skip;

d("f002-seed.kit (DB)", () => {
  let prisma: PrismaClient;
  let kit: SeedKit;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: TEST_DB } } });
    await prisma.$connect();
    kit = createSeedKit(prisma, { label: "seedkit-int" });
  });

  afterAll(async () => {
    if (kit) await kit.cleanup();
    if (prisma) await prisma.$disconnect();
  });

  it("creates an org with the three system roles and their stable keys", async () => {
    const org = await kit.createOrg();
    const rows = await prisma.role.findMany({
      where: { organizationId: org.id },
      select: { name: true, key: true, isSystem: true },
      orderBy: { name: "asc" },
    });
    expect(rows).toEqual([
      { name: "Admin", key: "admin", isSystem: true },
      { name: "Owner", key: "owner", isSystem: true },
      { name: "Staff", key: "staff", isSystem: true },
    ]);
  });

  it("a seeded user's passwordHash is a real argon2id hash (they can actually log in)", async () => {
    // Produced by the PRODUCTION HashingService — a placeholder string here
    // would make every seeded persona unable to authenticate, and every E2E
    // would then need a signup call it should not need.
    const user = await kit.createUser();
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.passwordHash).toMatch(/^\$argon2id\$/);
    expect(row.passwordHash).not.toContain(user.password);
    expect(row.email).toBe(user.email.toLowerCase());
  });

  it("condition (ข): revokedAt can be written >, < and == tokenIssuedAt", async () => {
    // The three orderings of I-1. Produced by writing timestamps, never by
    // moving a clock — condition (ค): Postgres' `now()` ignores fake timers.
    const org = await kit.createOrg();
    const anchor = new Date("2026-03-01T10:00:00.000Z");
    const cases: Array<[string, Date]> = [
      ["after", new Date(anchor.getTime() + 60_000)],
      ["before", new Date(anchor.getTime() - 60_000)],
      ["equal", new Date(anchor.getTime())],
    ];
    for (const [label, revokedAt] of cases) {
      const user = await kit.createUser({ email: `revoked-${label}-${Date.now()}@seed.test` });
      const m = await kit.addMember({
        organizationId: org.id,
        userId: user.id,
        roleId: org.roles.Staff.id,
        status: "revoked",
        activatedAt: anchor,
        revokedAt,
      });
      const row = await prisma.membership.findUniqueOrThrow({ where: { id: m.id } });
      expect(row.revokedAt?.toISOString()).toBe(revokedAt.toISOString());
      expect(row.status).toBe("revoked");
    }
  });

  it("condition (ง): `invited` — a dead state with no write path — is creatable", async () => {
    const result = await kit.scenario("invited-member");
    const row = await prisma.membership.findUniqueOrThrow({
      where: { id: result.memberships[0].id },
    });
    expect(row.status).toBe("invited");
    expect(row.activatedAt).toBeNull();
  });

  it("setRoleKey switches an existing key, including to null (I-44/I-45)", async () => {
    const org = await kit.createOrg();
    const staff = org.roles.Staff;
    await kit.setRoleKey(org.roles.Owner.id, null); // free the "owner" key first
    const flipped = await kit.setRoleKey(staff.id, "owner");
    expect(flipped.key).toBe("owner");
    // The capabilities did NOT move. That is the whole point of I-45: `key` is a
    // display slug; anybody deciding permissions from it re-opens finding C-1.
    expect(flipped.capabilities).toEqual(staff.capabilities);
    expect(flipped.capabilities).not.toContain("full_access");
    const back = await kit.setRoleKey(staff.id, null);
    expect(back.key).toBeNull();
  });

  it("RED: the kit does NOT dodge @@unique([organizationId, key]) — a duplicate throws", async () => {
    // If the kit silently deduplicated, I-45 would be testing a database that
    // behaves differently from production.
    const org = await kit.createOrg();
    await expect(kit.setRoleKey(org.roles.Staff.id, "owner")).rejects.toThrow();
  });

  it("several custom roles with key=null coexist (Postgres: each NULL is distinct)", async () => {
    const result = await kit.scenario("custom-role-null-key");
    const nulls = await prisma.role.count({
      where: { organizationId: result.orgs[0].id, key: null },
    });
    expect(nulls).toBeGreaterThanOrEqual(3); // Custom A, Custom B, and the freed Owner
  });

  it("scenario two-orgs: two tenants, two owners, no shared membership", async () => {
    const result = await kit.scenario("two-orgs");
    expect(result.orgs).toHaveLength(2);
    const [a, b] = result.orgs;
    expect(a.id).not.toBe(b.id);
    const crossed = await prisma.membership.count({
      where: { organizationId: a.id, userId: result.users[1].id },
    });
    expect(crossed).toBe(0);
  });

  it("scenario revoked-member: the row is NOT deleted and carries revokedAt/By (AC-5.4)", async () => {
    const result = await kit.scenario("revoked-member");
    const revoked = result.memberships[1];
    const row = await prisma.membership.findUniqueOrThrow({ where: { id: revoked.id } });
    expect(row.status).toBe("revoked");
    expect(row.revokedAt).not.toBeNull();
    expect(row.revokedByUserId).toBe(result.users[0].id);
  });

  it("BLOCKED (truthfully): invitation scenarios refuse rather than invent a token hash", async () => {
    // `hashInvitationToken` does not exist in production yet. The kit reports
    // that as a blocked dependency instead of hashing tokens itself — reported
    // to @backend-api rather than papered over here.
    for (const scenario of ["expired-invite", "superseded-invite", "high-role-invite"] as const) {
      await expect(kit.scenario(scenario)).rejects.toThrow(MissingProductionDependencyError);
    }
  });

  it("cleanup() deletes exactly what this kit created, and nothing else", async () => {
    const other = createSeedKit(prisma, { label: "bystander" });
    const bystander = await other.createOrg();
    const scoped = createSeedKit(prisma, { label: "scoped" });
    const mine = await scoped.createOrg();

    await scoped.cleanup();

    expect(await prisma.organization.findUnique({ where: { id: mine.id } })).toBeNull();
    // The other suite's fixture is untouched — a TRUNCATE would have taken it.
    expect(await prisma.organization.findUnique({ where: { id: bystander.id } })).not.toBeNull();
    await other.cleanup();
  });

  it("the CLI seeds through the SAME kit and prints one JSON object", async () => {
    const lines: string[] = [];
    const errors: string[] = [];
    const code = await runSeedCli(
      ["--scenario=two-orgs", "--cleanup"],
      { NODE_ENV: "test", TEST_DATABASE_URL: TEST_DB },
      { prisma, stdout: (l) => lines.push(l), stderr: (l) => errors.push(l) },
    );
    expect(errors).toEqual([]);
    expect(code).toBe(0);
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]) as { scenario: string; orgs: unknown[] };
    expect(parsed.scenario).toBe("two-orgs");
    expect(parsed.orgs).toHaveLength(2);
  });

  it("RED: a CLI failure exits non-zero, writes nothing to stdout, and cleans up", async () => {
    const lines: string[] = [];
    const errors: string[] = [];
    const code = await runSeedCli(
      ["--scenario=expired-invite"],
      { NODE_ENV: "test", TEST_DATABASE_URL: TEST_DB },
      { prisma, stdout: (l) => lines.push(l), stderr: (l) => errors.push(l) },
    );
    expect(code).toBe(1);
    expect(lines).toEqual([]);
    expect(errors.join("\n")).toContain("MissingProductionDependencyError");
  });
});
