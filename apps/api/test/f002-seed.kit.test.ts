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
} from "./f002-seed.kit";
import { SeedCliUsageError, assertSeedingAllowed, parseSeedArgs, runSeedCli } from "./cli/seed-cli";
import { TestFixturesDisabledError, TestFixturesModule } from "./fixtures/test-fixtures.module";
import { CAPABILITY_FULL_ACCESS, CAPABILITY_MANAGE_MEMBERS } from "@omnistock/core-domain";

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
    // Pinned so the day the export lands, this test flips from "documented gap"
    // to "wired" without anybody having to remember it exists.
    const db = (await import("@omnistock/db")) as Record<string, unknown>;
    expect(typeof db.hashInvitationToken).toBe("undefined");
  });
});

describe("DEFAULT_ROLE_SPECS", () => {
  it("carries the three system roles with their stable keys (data-model §5.2)", () => {
    expect(DEFAULT_ROLE_SPECS.map((r) => [r.name, r.key])).toEqual([
      ["Owner", "owner"],
      ["Admin", "admin"],
      ["Staff", "staff"],
    ]);
  });

  it("Owner is the ONLY spec carrying full_access — 'is Owner' is a capability, not a key", () => {
    const withFullAccess = DEFAULT_ROLE_SPECS.filter((r) => r.capabilities.includes(CAPABILITY_FULL_ACCESS));
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
    expect(() => parseSeedArgs(["--scenario=two-orgs", "--force"])).toThrow(/unknown argument: --force/);
  });

  it("every declared scenario parses", () => {
    for (const name of F002_SCENARIOS) {
      expect(parseSeedArgs([`--scenario=${name}`]).scenario).toBe(name);
    }
  });
});

describe("seed CLI — refusal to run outside a test environment (§12.2 item 2 จ)", () => {
  it("RED: NODE_ENV=production is a hard stop", () => {
    expect(() => assertSeedingAllowed({ NODE_ENV: "production", TEST_DATABASE_URL: "postgres://x" })).toThrow(
      /NODE_ENV=production/,
    );
  });

  it("RED: no database URL at all is a hard stop", () => {
    expect(() => assertSeedingAllowed({ NODE_ENV: "test" })).toThrow(/neither TEST_DATABASE_URL nor DATABASE_URL/);
  });

  it("a test environment with a URL is allowed", () => {
    expect(() => assertSeedingAllowed({ NODE_ENV: "test", TEST_DATABASE_URL: "postgres://x" })).not.toThrow();
  });

  it("RED: runSeedCli exits 2 and writes NOTHING to stdout when refused", () => {
    // E2E parses stdout as JSON. A refusal that printed a half-message there
    // would surface as a JSON parse error three layers away from the cause.
    const stdout = vi.fn();
    const stderr = vi.fn();
    const prisma = {} as never;
    return expect(
      runSeedCli(["--scenario=two-orgs"], { NODE_ENV: "production" }, { prisma, stdout, stderr }),
    ).resolves.toBe(2).then(() => {
      expect(stdout).not.toHaveBeenCalled();
      expect(stderr).toHaveBeenCalledWith(expect.stringContaining("NODE_ENV=production"));
    });
  });
});

describe("TestFixturesModule — two independent conditions (§12.2 item 9)", () => {
  it("RED: refuses when NODE_ENV is not test, even with the flag set", () => {
    expect(() => TestFixturesModule.register({ NODE_ENV: "production", ENABLE_TEST_FIXTURES: "1" })).toThrow(
      TestFixturesDisabledError,
    );
  });

  it("RED: refuses when the flag is missing, even under NODE_ENV=test", () => {
    // CI runs plenty of jobs with NODE_ENV=test that have nothing to do with
    // these fixtures; one condition would let the boom route into all of them.
    expect(() => TestFixturesModule.register({ NODE_ENV: "test" })).toThrow(/ENABLE_TEST_FIXTURES/);
    expect(() => TestFixturesModule.register({ NODE_ENV: "test", ENABLE_TEST_FIXTURES: "true" })).toThrow(
      /ENABLE_TEST_FIXTURES/,
    );
  });

  it("registers both fixture controllers when BOTH conditions hold", () => {
    const mod = TestFixturesModule.register({ NODE_ENV: "test", ENABLE_TEST_FIXTURES: "1" });
    expect(mod.controllers?.map((c) => (c as { name: string }).name).sort()).toEqual([
      "BoomController",
      "ProbeController",
    ]);
  });

  it("it THROWS rather than returning an empty module", () => {
    // An empty module would look like a routing bug, and somebody would "fix"
    // it by loosening the condition.
    expect(() => TestFixturesModule.register({})).toThrow(TestFixturesDisabledError);
  });
});
