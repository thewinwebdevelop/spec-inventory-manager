// F-002 · T-002-22 — unit meta-tests for the seed kit, its CLI and the
// conditional fixtures module (deliverables 1 and 5).
//
// These are the parts that must hold WITHOUT a database: the refusal to invent
// a token hash, the CLI's argument contract and its production kill-switch, and
// the two independent conditions guarding the deliberate-500 fixture. The
// DB-backed behaviour is in `f002-seed.kit.int.test.ts`.
import { describe, it, expect, vi } from "vitest";
import {
  F002_SCENARIOS,
  DEFAULT_ROLE_SPECS,
  MissingProductionDependencyError,
  resolveInvitationTokenHasher,
  createSeedKit,
  type SeedPrismaClient,
} from "./f002-seed.kit";
import { SeedCliUsageError, assertSeedingAllowed, parseSeedArgs, runSeedCli } from "./cli/seed-cli";
import { TestFixturesDisabledError, TestFixturesModule } from "./fixtures/test-fixtures.module";
import {
  CAPABILITY_FULL_ACCESS,
  CAPABILITY_MANAGE_MEMBERS,
  SYSTEM_ROLE_BLUEPRINT,
} from "@omnistock/core-domain";

describe("resolveInvitationTokenHasher (condition ก — production fn or nothing)", () => {
  it("RED: refuses when the production hasher does not exist", () => {
    // Today this is the REAL state of the repo: `hashInvitationToken` is not
    // exported from `@omnistock/db` yet. The kit does not paper over it with a
    // hash of its own — that would make I-14 prove the kit agrees with the kit.
    expect(() => resolveInvitationTokenHasher({})).toThrow(MissingProductionDependencyError);
    expect(() => resolveInvitationTokenHasher({})).toThrow(/hashInvitationToken/);
  });

  it("RED: a non-function export is refused just as loudly", () => {
    expect(() => resolveInvitationTokenHasher({ hashInvitationToken: "nope" })).toThrow(
      MissingProductionDependencyError,
    );
  });

  it("uses the production function verbatim once it exists", () => {
    const hashInvitationToken = vi.fn((t: string) => `hashed:${t}`);
    const resolved = resolveInvitationTokenHasher({ hashInvitationToken });
    expect(resolved("tok")).toBe("hashed:tok");
    expect(hashInvitationToken).toHaveBeenCalledWith("tok");
  });

  it("the LIVE @omnistock/db module is the one it will resolve against", async () => {
    // Was pinned to `undefined` while the export was a documented gap; it
    // landed (F-002 D-018), so the pin flips here rather than anyone having to
    // remember the kit was waiting on it. The kit resolves the PRODUCTION
    // function by name from this module — if it is ever renamed or moved, the
    // seed scenarios must go back to refusing, not to hashing their own tokens.
    const db = (await import("@omnistock/db")) as Record<string, unknown>;
    expect(typeof db.hashInvitationToken).toBe("function");
    expect(() => resolveInvitationTokenHasher(db)).not.toThrow();
  });
});

describe("DEFAULT_ROLE_SPECS", () => {
  it("★ IS production's blueprint — a fixture Admin must be the real Admin", () => {
    // The reason this is worth its own test rather than trusting the `.map`:
    // the previous version was a hand-written copy that had already drifted
    // (Admin 2 capabilities vs 7, Staff 1 vs 3, `isSystem` wrong on two of
    // three) and NOTHING went red. A QA case asserting "an Admin can do X"
    // against a kit-seeded org was testing a role that does not exist in
    // production — so it could pass while the real Admin was broken, or fail
    // over a difference that lived only in the fixture.
    expect(
      DEFAULT_ROLE_SPECS.map((r) => ({
        name: r.name,
        key: r.key,
        isSystem: r.isSystem,
        capabilities: [...r.capabilities],
      })),
    ).toEqual(
      SYSTEM_ROLE_BLUEPRINT.map((r) => ({
        name: r.name,
        key: r.key,
        isSystem: r.isSystem,
        capabilities: [...r.capabilities],
      })),
    );
  });

  it("Admin really does carry more than the two capabilities F-002 enforces", () => {
    // Pins the specific drift that existed, so re-introducing the old literal
    // list is red for a reason the message states outright.
    const admin = DEFAULT_ROLE_SPECS.find((r) => r.key === "admin");
    expect(admin?.capabilities.length).toBeGreaterThan(2);
  });

  it("carries the three system roles with their stable keys (data-model §5.2)", () => {
    expect(DEFAULT_ROLE_SPECS.map((r) => [r.name, r.key])).toEqual([
      ["Owner", "owner"],
      ["Admin", "admin"],
      ["Staff", "staff"],
    ]);
  });

  it("Owner is the ONLY spec carrying full_access — 'is Owner' is a capability, not a key", () => {
    const withFullAccess = DEFAULT_ROLE_SPECS.filter((r) =>
      r.capabilities.includes(CAPABILITY_FULL_ACCESS),
    );
    expect(withFullAccess.map((r) => r.name)).toEqual(["Owner"]);
    expect(DEFAULT_ROLE_SPECS.find((r) => r.name === "Admin")?.capabilities).toContain(
      CAPABILITY_MANAGE_MEMBERS,
    );
    expect(DEFAULT_ROLE_SPECS.find((r) => r.name === "Staff")?.capabilities).not.toContain(
      CAPABILITY_MANAGE_MEMBERS,
    );
  });
});

describe("seed CLI — argument contract", () => {
  it("accepts both `--scenario=x` and `--scenario x`", () => {
    expect(parseSeedArgs(["--scenario=two-orgs"]).scenario).toBe("two-orgs");
    expect(parseSeedArgs(["--scenario", "revoked-member"]).scenario).toBe("revoked-member");
  });

  it("keeps the rows by default, and `--cleanup` flips it", () => {
    // E2E spawns the CLI, then runs a browser against what it seeded — deleting
    // on exit would be the single most confusing possible default.
    expect(parseSeedArgs(["--scenario=two-orgs"]).keep).toBe(true);
    expect(parseSeedArgs(["--scenario=two-orgs", "--cleanup"]).keep).toBe(false);
  });

  it("RED: an unknown scenario is refused with the list of valid ones", () => {
    expect(() => parseSeedArgs(["--scenario=make-me-an-admin"])).toThrow(SeedCliUsageError);
    expect(() => parseSeedArgs(["--scenario=make-me-an-admin"])).toThrow(/two-orgs\|fifty-orgs/);
  });

  it("RED: a missing --scenario and an unknown flag are both refused", () => {
    expect(() => parseSeedArgs([])).toThrow(/--scenario is required/);
    expect(() => parseSeedArgs(["--scenario=two-orgs", "--force"])).toThrow(
      /unknown argument: --force/,
    );
  });

  it("every declared scenario parses", () => {
    for (const name of F002_SCENARIOS) {
      expect(parseSeedArgs([`--scenario=${name}`]).scenario).toBe(name);
    }
  });
});

describe("seed CLI — refusal to run outside a test environment (§12.2 item 2 จ)", () => {
  it("RED: NODE_ENV=production is a hard stop", () => {
    expect(() =>
      assertSeedingAllowed({ NODE_ENV: "production", TEST_DATABASE_URL: "postgres://x" }),
    ).toThrow(/NODE_ENV=production/);
  });

  it("RED: no database URL at all is a hard stop", () => {
    expect(() => assertSeedingAllowed({ NODE_ENV: "test" })).toThrow(
      /neither TEST_DATABASE_URL nor DATABASE_URL/,
    );
  });

  it("a test environment with a URL is allowed", () => {
    expect(() =>
      assertSeedingAllowed({ NODE_ENV: "test", TEST_DATABASE_URL: "postgres://x" }),
    ).not.toThrow();
  });

  it("RED: runSeedCli exits 2 and writes NOTHING to stdout when refused", () => {
    // E2E parses stdout as JSON. A refusal that printed a half-message there
    // would surface as a JSON parse error three layers away from the cause.
    const stdout = vi.fn();
    const stderr = vi.fn();
    const prisma = {} as never;
    return expect(
      runSeedCli(["--scenario=two-orgs"], { NODE_ENV: "production" }, { prisma, stdout, stderr }),
    )
      .resolves.toBe(2)
      .then(() => {
        expect(stdout).not.toHaveBeenCalled();
        expect(stderr).toHaveBeenCalledWith(expect.stringContaining("NODE_ENV=production"));
      });
  });
});

describe("TestFixturesModule — two independent conditions (§12.2 item 9)", () => {
  it("RED: refuses when NODE_ENV is not test, even with the flag set", () => {
    expect(() =>
      TestFixturesModule.register({ NODE_ENV: "production", ENABLE_TEST_FIXTURES: "1" }),
    ).toThrow(TestFixturesDisabledError);
  });

  it("RED: refuses when the flag is missing, even under NODE_ENV=test", () => {
    // CI runs plenty of jobs with NODE_ENV=test that have nothing to do with
    // these fixtures; one condition would let the boom route into all of them.
    expect(() => TestFixturesModule.register({ NODE_ENV: "test" })).toThrow(/ENABLE_TEST_FIXTURES/);
    expect(() =>
      TestFixturesModule.register({ NODE_ENV: "test", ENABLE_TEST_FIXTURES: "true" }),
    ).toThrow(/ENABLE_TEST_FIXTURES/);
  });

  it("registers every fixture controller when BOTH conditions hold", () => {
    // An EXACT list, not `toContain`: these controllers throw on purpose and
    // read tenant data, so "which fixtures exist" is a fact worth failing on
    // when it changes. `PingController` (T-002-Q6) was added deliberately — the
    // public baseline the perf smoke's P-03 measures against — and updating
    // this line in the same commit is the intended cost of that.
    const mod = TestFixturesModule.register({ NODE_ENV: "test", ENABLE_TEST_FIXTURES: "1" });
    expect(mod.controllers?.map((c) => (c as { name: string }).name).sort()).toEqual([
      "BoomController",
      "PingController",
      "ProbeController",
    ]);
  });

  it("it THROWS rather than returning an empty module", () => {
    // An empty module would look like a routing bug, and somebody would "fix"
    // it by loosening the condition.
    expect(() => TestFixturesModule.register({})).toThrow(TestFixturesDisabledError);
  });
});

// ── F-003 · T-003-QA01 · R3-03 ──────────────────────────────────────────────
// F-003's migration adds two CHECKs on "Role" (F-003 data-model §3.1):
//   "Role_capabilities_nonempty"    cardinality(capabilities) >= 1
//   "Role_full_access_system_only"  full_access ⇒ isSystem
// A scenario that seeds a row violating either one stops seeding the moment the
// migration lands — and it would surface as an unrelated failure in some F-002
// int suite. So every scenario is walked HERE, without a database, and the
// FINAL state of every role it wrote (after `setRoleKey`) is checked.
//
// The fake records writes only; it enforces nothing. What it proves is what the
// kit ASKS the database to store — the DB-side proof is the matching case in
// `f002-seed.kit.int.test.ts`.
describe("R3-03 — every scenario seeds roles the F-003 CHECKs accept", () => {
  interface RecordedRole {
    id: string;
    organizationId: string;
    name: string;
    key: string | null;
    capabilities: string[];
    isSystem: boolean;
  }

  function recordingPrisma(): { prisma: SeedPrismaClient; roles: Map<string, RecordedRole> } {
    const roles = new Map<string, RecordedRole>();
    let n = 0;
    const id = (p: string): string => `${p}-${++n}`;
    type Args = { data: Record<string, unknown>; where?: Record<string, unknown> };
    const prisma = {
      user: { create: async ({ data }: Args) => ({ id: id("user"), email: data.email }) },
      organization: { create: async ({ data }: Args) => ({ id: id("org"), name: data.name }) },
      role: {
        create: async ({ data }: Args) => {
          const row: RecordedRole = {
            id: id("role"),
            organizationId: data.organizationId as string,
            name: data.name as string,
            key: data.key as string | null,
            capabilities: [...(data.capabilities as string[])],
            isSystem: data.isSystem as boolean,
          };
          roles.set(row.id, row);
          return row;
        },
        update: async ({ where, data }: Args) => {
          const row = roles.get(where!.id as string);
          if (!row) throw new Error(`fake: no role ${String(where!.id)}`);
          row.key = data.key as string | null;
          return row;
        },
      },
      membership: {
        create: async ({ data }: Args) => ({
          id: id("m"),
          organizationId: data.organizationId,
          userId: data.userId,
          roleId: data.roleId,
          status: data.status,
        }),
      },
      invitation: {
        create: async ({ data }: Args) => ({
          id: id("inv"),
          organizationId: data.organizationId,
          email: data.email,
          roleId: data.roleId,
          status: data.status,
        }),
      },
    } as unknown as SeedPrismaClient;
    return { prisma, roles };
  }

  /** The two F-003 CHECKs, restated as the spec states them (data-model §3.1). */
  function checkViolations(role: RecordedRole): string[] {
    const out: string[] = [];
    if (role.capabilities.length < 1) out.push("Role_capabilities_nonempty");
    if (role.capabilities.includes(CAPABILITY_FULL_ACCESS) && !role.isSystem) {
      out.push("Role_full_access_system_only");
    }
    return out;
  }

  it.each(F002_SCENARIOS.map((s) => [s]))(
    "★ scenario %s: no role is empty and no non-system role holds full_access",
    async (scenario) => {
      const { prisma, roles } = recordingPrisma();
      const kit = createSeedKit(prisma, {
        dbModule: { hashInvitationToken: (t: string) => `h:${t}` },
      });
      await kit.scenario(scenario);

      // Non-vacuity: a scenario that wrote no role would pass every check below.
      expect(roles.size).toBeGreaterThanOrEqual(3);
      const bad = [...roles.values()]
        .map((r) => ({ name: r.name, violations: checkViolations(r) }))
        .filter((r) => r.violations.length > 0);
      expect(bad).toEqual([]);
    },
  );

  it("custom-role-null-key still means what I-44(c)/I-45 need", async () => {
    const { prisma, roles } = recordingPrisma();
    const kit = createSeedKit(prisma);
    const result = await kit.scenario("custom-role-null-key");
    const byName = new Map([...roles.values()].map((r) => [r.name, r]));

    // Two custom roles with key=null coexist (I-44c) …
    expect(byName.get("Custom A")).toMatchObject({ key: null, isSystem: false });
    expect(byName.get("Custom B")).toMatchObject({ key: null, isSystem: false });
    expect(byName.get("Custom B")!.capabilities).toEqual(["manage_orders"]);
    // … the impostor: Staff's row wears key "owner", its capabilities untouched …
    const staff = byName.get("Staff")!;
    expect(staff.key).toBe("owner");
    expect(staff.capabilities).not.toContain(CAPABILITY_FULL_ACCESS);
    expect(result.notes.impostorRoleId).toBe(staff.id);
    // … and the real Owner no longer wears any key at all (I-45).
    expect(byName.get("Owner")).toMatchObject({ key: null, isSystem: true });
  });

  it("RED control: the check fires on exactly the two shapes it exists for", () => {
    const base = { id: "r", organizationId: "o", name: "x", key: null };
    expect(checkViolations({ ...base, capabilities: [], isSystem: false })).toEqual([
      "Role_capabilities_nonempty",
    ]);
    expect(
      checkViolations({ ...base, capabilities: [CAPABILITY_FULL_ACCESS], isSystem: false }),
    ).toEqual(["Role_full_access_system_only"]);
    expect(
      checkViolations({ ...base, capabilities: [CAPABILITY_FULL_ACCESS], isSystem: true }),
    ).toEqual([]);
  });
});
