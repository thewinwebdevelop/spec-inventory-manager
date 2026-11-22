// F-003 · T-003-B23 (from review DV01 — Medium) — `ROLE_WRITES_ENABLED` is read
// from the env SNAPSHOT `main.ts` validated at boot, never by calling
// `loadEnv(process.env)` again inside a provider factory.
//
// Why it matters: `loadEnv` re-reads whatever `process.env` holds at the moment
// the factory runs. A provider that does that is not reading "the boot env" —
// it is reading "the env whenever Nest got round to this factory", and the two
// can differ (anything that mutates `process.env` between `main.ts`' check and
// module init). The flag gates role writes during a rollout (architecture §12):
// its value must be the one that was validated and logged at boot.
import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Test } from "@nestjs/testing";
import { loadEnv, type Env } from "@omnistock/config";
// Lives in orgs/ (not common/): it exercises orgConfigProviders, and common/ may
// not import a feature module (depcruise api-leafward-only).
import { BOOT_ENV, BootEnvModule, ROLE_WRITES_ENABLED } from "../common/boot-env";
import { ROLE_CAPACITY_LIMITS, orgConfigProviders } from "./org-config";

const VALID_ENV = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  REDIS_URL: "redis://localhost:6379",
  JWT_ACCESS_SECRET: "boot-env-access-secret-32-chars-minimum!!",
  JWT_REFRESH_SECRET: "boot-env-refresh-secret-32-chars-minimum!",
  INVITATION_TOKEN_SECRET: "boot-env-invitation-secret-32-chars-min!!",
  WEB_APP_BASE_URL: "http://localhost:3001",
  DEFAULT_ORG_PLAN_KEY: "comp_full",
  PORT: "3000",
  NODE_ENV: "test",
} as const;

function snapshot(over: Record<string, string> = {}): Env {
  return loadEnv({ ...VALID_ENV, ...over });
}

async function resolve(env: Env) {
  const moduleRef = await Test.createTestingModule({
    imports: [BootEnvModule.forRoot(env)],
    providers: [...orgConfigProviders],
  }).compile();
  return moduleRef;
}

const saved = process.env.ROLE_WRITES_ENABLED;
afterEach(() => {
  if (saved === undefined) delete process.env.ROLE_WRITES_ENABLED;
  else process.env.ROLE_WRITES_ENABLED = saved;
});

describe("★ DV01 · ROLE_WRITES_ENABLED comes from the boot snapshot (BOOT_ENV), not process.env", () => {
  it("the token equals the snapshot's value — both directions", async () => {
    expect(
      (await resolve(snapshot({ ROLE_WRITES_ENABLED: "true" }))).get(ROLE_WRITES_ENABLED),
    ).toBe(true);
    expect((await resolve(snapshot())).get(ROLE_WRITES_ENABLED)).toBe(false);
  });

  it("★ process.env saying the OPPOSITE of the snapshot has no effect (snapshot false, env true)", async () => {
    const env = snapshot(); // validated with the flag unset → false
    process.env.ROLE_WRITES_ENABLED = "true"; // mutated after boot
    const moduleRef = await resolve(env);
    expect(moduleRef.get(ROLE_WRITES_ENABLED)).toBe(false);
  });

  it("★ …and the other direction (snapshot true, env removed)", async () => {
    const env = snapshot({ ROLE_WRITES_ENABLED: "true" });
    delete process.env.ROLE_WRITES_ENABLED;
    const moduleRef = await resolve(env);
    expect(moduleRef.get(ROLE_WRITES_ENABLED)).toBe(true);
  });

  it("mutating process.env AFTER the module resolved changes nothing either", async () => {
    const moduleRef = await resolve(snapshot());
    process.env.ROLE_WRITES_ENABLED = "true";
    expect(moduleRef.get(ROLE_WRITES_ENABLED)).toBe(false);
  });

  it("BOOT_ENV is the very object main.ts validated (no re-parse), frozen", async () => {
    const env = snapshot();
    const moduleRef = await resolve(env);
    expect(moduleRef.get(BOOT_ENV)).toBe(env);
    expect(Object.isFrozen(moduleRef.get(BOOT_ENV))).toBe(true);
  });

  it("ROLE_CAPACITY_LIMITS come from the same snapshot (no process.env read)", async () => {
    const env = snapshot({ MAX_ROLES_PER_ORG: "7", MAX_DELETED_ROLES_PER_ORG: "9" });
    process.env.MAX_ROLES_PER_ORG = "99";
    try {
      const moduleRef = await resolve(env);
      expect(moduleRef.get(ROLE_CAPACITY_LIMITS)).toEqual({
        maxRolesPerOrg: 7,
        maxDeletedRolesPerOrg: 9,
      });
    } finally {
      delete process.env.MAX_ROLES_PER_ORG;
    }
  });

  it("STATIC: org-config.ts never calls loadEnv — the only env read is BOOT_ENV", () => {
    const source = readFileSync(join(__dirname, "org-config.ts"), "utf8")
      .split("\n")
      .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
      .join("\n");
    expect(source).not.toMatch(/\bloadEnv\s*\(/);
    expect(source).not.toMatch(/process\.env/);
    // non-vacuity: the file really wires the tokens through the snapshot
    expect(source).toContain("BOOT_ENV");
  });

  it("STATIC: main.ts hands its validated env to AppModule.forRoot (the snapshot it logged)", () => {
    const source = readFileSync(join(__dirname, "../main.ts"), "utf8");
    expect(source).toMatch(/AppModule\.forRoot\(\s*env\s*\)/);
  });
});
