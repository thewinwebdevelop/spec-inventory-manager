import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ORG_RATE_LIMITS,
  ORG_TX_TIMEOUTS,
  envSchema,
  loadEnv,
  resolveOrgRateLimits,
  resolveOrgTxTimeouts,
} from "./env";
import {
  MAX_ORGS_PER_USER_DEFAULT,
  ORG_RATE_LIMIT_DEFAULTS,
  ORG_RATE_LIMIT_ENV_VARS,
  ORG_TX_TIMEOUT_DEFAULTS,
} from "./org-policy";

const validEnv: Record<string, string> = {
  DATABASE_URL: "postgresql://omnistock:omnistock@localhost:5432/omnistock_dev?schema=public",
  REDIS_URL: "redis://localhost:6379",
  JWT_ACCESS_SECRET: "dev-access-secret-change-me-0000000000",
  JWT_REFRESH_SECRET: "dev-refresh-secret-change-me-0000000000",
  PORT: "3000",
  NODE_ENV: "development",
  // --- F-002 (architecture.md §6.4) ------------------------------------------
  INVITATION_TOKEN_SECRET: "dev-invitation-secret-change-me-00000000",
  WEB_APP_BASE_URL: "http://localhost:3001",
  DEFAULT_ORG_PLAN_KEY: "comp_full",
};

/** Names of the vars a failed parse must mention. */
function failedVars(source: Record<string, string>): string[] {
  const result = envSchema.safeParse(source);
  expect(result.success).toBe(false);
  return result.success ? [] : result.error.issues.map((i) => i.path.join("."));
}

describe("envSchema (AC14)", () => {
  it("POSITIVE: parses a complete env matching .env.example shape", () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
  });

  it.each(Object.keys(validEnv))(
    "NEGATIVE: missing %s fails validation and names that var",
    (missingKey) => {
      const { [missingKey]: _omit, ...rest } = validEnv;
      const result = envSchema.safeParse(rest);
      expect(result.success).toBe(false);
      if (!result.success) {
        const namedVars = result.error.issues.map((issue) => issue.path.join("."));
        expect(namedVars).toContain(missingKey);
      }
    },
  );

  it("NEGATIVE: blank required var fails validation and names that var", () => {
    const result = envSchema.safeParse({ ...validEnv, DATABASE_URL: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const namedVars = result.error.issues.map((issue) => issue.path.join("."));
      expect(namedVars).toContain("DATABASE_URL");
    }
  });

  // --- F-001 I-4: JWT secret strength (≥256-bit) + must-differ refinement ---
  it("NEGATIVE: JWT_ACCESS_SECRET shorter than 32 chars fails validation and names that var", () => {
    const result = envSchema.safeParse({ ...validEnv, JWT_ACCESS_SECRET: "too-short" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const namedVars = result.error.issues.map((issue) => issue.path.join("."));
      expect(namedVars).toContain("JWT_ACCESS_SECRET");
    }
  });

  it("NEGATIVE: JWT_REFRESH_SECRET shorter than 32 chars fails validation and names that var", () => {
    const result = envSchema.safeParse({ ...validEnv, JWT_REFRESH_SECRET: "too-short" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const namedVars = result.error.issues.map((issue) => issue.path.join("."));
      expect(namedVars).toContain("JWT_REFRESH_SECRET");
    }
  });

  it("NEGATIVE: equal JWT_ACCESS_SECRET and JWT_REFRESH_SECRET fails validation", () => {
    const sameSecret = "identical-secret-value-0000000000000000";
    const result = envSchema.safeParse({
      ...validEnv,
      JWT_ACCESS_SECRET: sameSecret,
      JWT_REFRESH_SECRET: sameSecret,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const namedVars = result.error.issues.map((issue) => issue.path.join("."));
      expect(namedVars).toContain("JWT_REFRESH_SECRET");
    }
  });

  it("POSITIVE: full env with ≥32-char, distinct JWT secrets passes", () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.JWT_ACCESS_SECRET.length).toBeGreaterThanOrEqual(32);
      expect(result.data.JWT_REFRESH_SECRET.length).toBeGreaterThanOrEqual(32);
      expect(result.data.JWT_ACCESS_SECRET).not.toBe(result.data.JWT_REFRESH_SECRET);
    }
  });

  // --- F-001 security review: TRUST_PROXY_HOPS (spoof-safe default) ----------
  it("TRUST_PROXY_HOPS defaults to 0 (trust no hop → spoof-safe) when omitted", () => {
    const result = envSchema.safeParse(validEnv); // validEnv has no TRUST_PROXY_HOPS
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.TRUST_PROXY_HOPS).toBe("0");
  });

  it("TRUST_PROXY_HOPS accepts a non-negative integer string", () => {
    const result = envSchema.safeParse({ ...validEnv, TRUST_PROXY_HOPS: "1" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.TRUST_PROXY_HOPS).toBe("1");
  });

  it("NEGATIVE: TRUST_PROXY_HOPS garbage (non-integer / negative) fails and names it", () => {
    for (const bad of ["true", "-1", "1.5", "abc"]) {
      const result = envSchema.safeParse({ ...validEnv, TRUST_PROXY_HOPS: bad });
      expect(result.success).toBe(false);
      if (!result.success) {
        const named = result.error.issues.map((i) => i.path.join("."));
        expect(named).toContain("TRUST_PROXY_HOPS");
      }
    }
  });

  // --- F-001 security review: CORS_ALLOWED_ORIGINS (parsed allow-list) -------
  it("CORS_ALLOWED_ORIGINS defaults to an empty list (no cross-origin) when omitted", () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.CORS_ALLOWED_ORIGINS).toEqual([]);
  });

  it("CORS_ALLOWED_ORIGINS parses comma-separated origins → trimmed string[]", () => {
    const result = envSchema.safeParse({
      ...validEnv,
      CORS_ALLOWED_ORIGINS: "http://localhost:3001, https://app.example.com ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.CORS_ALLOWED_ORIGINS).toEqual([
        "http://localhost:3001",
        "https://app.example.com",
      ]);
    }
  });

  it("CORS_ALLOWED_ORIGINS drops blank entries", () => {
    const result = envSchema.safeParse({ ...validEnv, CORS_ALLOWED_ORIGINS: "a.com,,  ,b.com" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.CORS_ALLOWED_ORIGINS).toEqual(["a.com", "b.com"]);
  });
});

// =============================================================================
// F-002 · T-002-06 — new env vars (architecture.md §6.4/§5.2/§8, §15 row 8)
// test-plan.md U-CFG-01..07
// =============================================================================

describe("U-CFG-01 · INVITATION_TOKEN_SECRET (§7.3 key separation)", () => {
  it("NEGATIVE: missing → fails and names the var (boot must not come up)", () => {
    const { INVITATION_TOKEN_SECRET: _omit, ...rest } = validEnv;
    expect(failedVars(rest)).toContain("INVITATION_TOKEN_SECRET");
  });

  it("NEGATIVE: shorter than 32 chars → fails and names the var", () => {
    expect(failedVars({ ...validEnv, INVITATION_TOKEN_SECRET: "too-short" })).toContain(
      "INVITATION_TOKEN_SECRET",
    );
  });

  it("NEGATIVE: equal to JWT_ACCESS_SECRET → fails (key separation)", () => {
    expect(
      failedVars({ ...validEnv, INVITATION_TOKEN_SECRET: validEnv.JWT_ACCESS_SECRET }),
    ).toContain("INVITATION_TOKEN_SECRET");
  });

  it("NEGATIVE: equal to JWT_REFRESH_SECRET → fails (key separation)", () => {
    expect(
      failedVars({ ...validEnv, INVITATION_TOKEN_SECRET: validEnv.JWT_REFRESH_SECRET }),
    ).toContain("INVITATION_TOKEN_SECRET");
  });

  it("POSITIVE: ≥32 chars and distinct from both JWT secrets passes", () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.INVITATION_TOKEN_SECRET.length).toBeGreaterThanOrEqual(32);
      expect(result.data.INVITATION_TOKEN_SECRET).not.toBe(result.data.JWT_ACCESS_SECRET);
      expect(result.data.INVITATION_TOKEN_SECRET).not.toBe(result.data.JWT_REFRESH_SECRET);
    }
  });
});

describe("U-CFG-02 · WEB_APP_BASE_URL (carries the invitation token)", () => {
  it("NEGATIVE: missing → fails and names the var", () => {
    const { WEB_APP_BASE_URL: _omit, ...rest } = validEnv;
    expect(failedVars(rest)).toContain("WEB_APP_BASE_URL");
  });

  it("NEGATIVE: not a URL → fails and names the var", () => {
    for (const bad of ["", "app.example.com", "not a url"]) {
      expect(failedVars({ ...validEnv, WEB_APP_BASE_URL: bad })).toContain("WEB_APP_BASE_URL");
    }
  });

  it("NEGATIVE: http:// in production → fails (https enforced)", () => {
    expect(
      failedVars({
        ...validEnv,
        NODE_ENV: "production",
        WEB_APP_BASE_URL: "http://app.example.com",
      }),
    ).toContain("WEB_APP_BASE_URL");
  });

  it("NEGATIVE: http:// on localhost in production → still fails", () => {
    expect(
      failedVars({ ...validEnv, NODE_ENV: "production", WEB_APP_BASE_URL: "http://localhost:3001" }),
    ).toContain("WEB_APP_BASE_URL");
  });

  it("NEGATIVE: http:// on a non-loopback host in development → fails", () => {
    expect(
      failedVars({
        ...validEnv,
        NODE_ENV: "development",
        WEB_APP_BASE_URL: "http://app.example.com",
      }),
    ).toContain("WEB_APP_BASE_URL");
  });

  it("POSITIVE: http://localhost in development passes", () => {
    for (const ok of ["http://localhost:3001", "http://127.0.0.1:3001"]) {
      const result = envSchema.safeParse({
        ...validEnv,
        NODE_ENV: "development",
        WEB_APP_BASE_URL: ok,
      });
      expect(result.success).toBe(true);
    }
  });

  it("POSITIVE: https:// passes in production", () => {
    const result = envSchema.safeParse({
      ...validEnv,
      NODE_ENV: "production",
      WEB_APP_BASE_URL: "https://app.example.com",
    });
    expect(result.success).toBe(true);
  });
});

describe("U-CFG-03 · DEFAULT_ORG_PLAN_KEY (required, no silent fallback — §6.2)", () => {
  it("NEGATIVE: missing → fails and names the var (no default is applied)", () => {
    const { DEFAULT_ORG_PLAN_KEY: _omit, ...rest } = validEnv;
    const result = envSchema.safeParse(rest);
    expect(result.success).toBe(false);
    expect(failedVars(rest)).toContain("DEFAULT_ORG_PLAN_KEY");
  });

  it("NEGATIVE: blank → fails (must not degrade to a free plan)", () => {
    expect(failedVars({ ...validEnv, DEFAULT_ORG_PLAN_KEY: "" })).toContain(
      "DEFAULT_ORG_PLAN_KEY",
    );
  });

  it("POSITIVE: the value is passed through verbatim (server-resolved plan key)", () => {
    const result = envSchema.safeParse({ ...validEnv, DEFAULT_ORG_PLAN_KEY: "comp_full" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.DEFAULT_ORG_PLAN_KEY).toBe("comp_full");
  });
});

describe("U-CFG-04 · MAX_ORGS_PER_USER (§6.3)", () => {
  it("PIN: default is 50 (D-029 (3)) when omitted", () => {
    expect(MAX_ORGS_PER_USER_DEFAULT).toBe(50);
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.MAX_ORGS_PER_USER).toBe("50");
  });

  it("is env-tunable", () => {
    const result = envSchema.safeParse({ ...validEnv, MAX_ORGS_PER_USER: "5" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.MAX_ORGS_PER_USER).toBe("5");
  });

  it("NEGATIVE: non-numeric / negative / zero → fails and names the var", () => {
    for (const bad of ["abc", "-1", "1.5", "0", ""]) {
      expect(failedVars({ ...validEnv, MAX_ORGS_PER_USER: bad })).toContain("MAX_ORGS_PER_USER");
    }
  });
});

describe("U-CFG-05/06 · ORG_RATE_LIMIT_* (policy pinned here, behaviour reads it — qa Q11)", () => {
  it("PIN: ORG_RATE_LIMIT_DEFAULTS matches architecture.md §8 row for row", () => {
    expect(ORG_RATE_LIMIT_DEFAULTS).toEqual({
      createOrganization: { limit: 10, windowSec: 3600, key: "userId" },
      createInvitation: { limit: 30, windowSec: 3600, key: "organizationId" },
      reissueInvitationLink: { limit: 60, windowSec: 3600, key: "organizationId" },
      publicInvitationEntry: { limit: 30, windowSec: 3600, key: "ip" },
      revealTaxProfile: { limit: 20, windowSec: 3600, key: "userId+organizationId" },
    });
  });

  it("zod defaults are exactly ORG_RATE_LIMIT_DEFAULTS (one source, no second table)", () => {
    const resolved = resolveOrgRateLimits(validEnv as NodeJS.ProcessEnv);
    expect(resolved).toEqual(ORG_RATE_LIMIT_DEFAULTS);
  });

  it("every quota is env-tunable through its documented var", () => {
    const lowered = {
      ...validEnv,
      [ORG_RATE_LIMIT_ENV_VARS.createOrganization]: "1",
      [ORG_RATE_LIMIT_ENV_VARS.createInvitation]: "2",
      [ORG_RATE_LIMIT_ENV_VARS.reissueInvitationLink]: "3",
      [ORG_RATE_LIMIT_ENV_VARS.publicInvitationEntry]: "4",
      [ORG_RATE_LIMIT_ENV_VARS.revealTaxProfile]: "5",
    } as NodeJS.ProcessEnv;
    expect(envSchema.safeParse(lowered).success).toBe(true);
    const resolved = resolveOrgRateLimits(lowered);
    expect(resolved.createOrganization.limit).toBe(1);
    expect(resolved.createInvitation.limit).toBe(2);
    expect(resolved.reissueInvitationLink.limit).toBe(3);
    expect(resolved.publicInvitationEntry.limit).toBe(4);
    expect(resolved.revealTaxProfile.limit).toBe(5);
    // window + key dimension are policy, not env-tunable
    expect(resolved.publicInvitationEntry.key).toBe("ip");
    expect(resolved.createOrganization.windowSec).toBe(3600);
  });

  it("NEGATIVE: a non-numeric / zero quota → fails and names that var", () => {
    for (const envVar of Object.values(ORG_RATE_LIMIT_ENV_VARS)) {
      for (const bad of ["abc", "0", "-5", "2.5"]) {
        expect(failedVars({ ...validEnv, [envVar]: bad })).toContain(envVar);
      }
    }
  });
});

describe("U-CFG-07 · ORG_TX_TIMEOUTS (§5.2 · NEW-4)", () => {
  const ORIGINAL_ENV = { ...process.env };
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("PIN: defaults are lockTimeoutMs=3000 · txTimeoutMs=5000 · maxWaitMs=2000", () => {
    expect(ORG_TX_TIMEOUT_DEFAULTS).toEqual({
      lockTimeoutMs: 3000,
      txTimeoutMs: 5000,
      maxWaitMs: 2000,
    });
    expect(resolveOrgTxTimeouts(validEnv as NodeJS.ProcessEnv)).toEqual(ORG_TX_TIMEOUT_DEFAULTS);
  });

  it("zod applies the same defaults when the vars are omitted", () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ORG_LOCK_TIMEOUT_MS).toBe("3000");
      expect(result.data.ORG_TX_TIMEOUT_MS).toBe("5000");
      expect(result.data.ORG_TX_MAX_WAIT_MS).toBe("2000");
    }
  });

  it("NEGATIVE: an absurdly large value fails at BOOT, not at request time", () => {
    // Security review of f66451f (Low): digits-only made the value safe to
    // interpolate into `SET LOCAL lock_timeout = '<n>ms'`, but a 22-digit
    // number passes that check and then stringifies as `1e+21` — Postgres
    // rejects it, so the failure surfaced as a 500 on a real request instead of
    // a refusal to start. The named-variable boot error is the whole point.
    expect(failedVars({ ...validEnv, ORG_LOCK_TIMEOUT_MS: "1".repeat(22) })).toContain(
      "ORG_LOCK_TIMEOUT_MS",
    );
    expect(String(Number("1".repeat(22)))).toContain("e+"); // why the bound exists
  });

  it("NEGATIVE: lockTimeout === txTimeout → boot fails (not a warning)", () => {
    expect(
      failedVars({ ...validEnv, ORG_LOCK_TIMEOUT_MS: "5000", ORG_TX_TIMEOUT_MS: "5000" }),
    ).toContain("ORG_LOCK_TIMEOUT_MS");
  });

  it("NEGATIVE: lockTimeout > txTimeout → boot fails", () => {
    expect(
      failedVars({ ...validEnv, ORG_LOCK_TIMEOUT_MS: "6000", ORG_TX_TIMEOUT_MS: "5000" }),
    ).toContain("ORG_LOCK_TIMEOUT_MS");
    expect(() =>
      resolveOrgTxTimeouts({
        ORG_LOCK_TIMEOUT_MS: "6000",
        ORG_TX_TIMEOUT_MS: "5000",
      } as NodeJS.ProcessEnv),
    ).toThrow();
  });

  it("NEGATIVE: non-numeric / negative / zero → fails and names that var", () => {
    for (const envVar of ["ORG_LOCK_TIMEOUT_MS", "ORG_TX_TIMEOUT_MS", "ORG_TX_MAX_WAIT_MS"]) {
      for (const bad of ["abc", "0", "-1", "1.5"]) {
        expect(failedVars({ ...validEnv, [envVar]: bad })).toContain(envVar);
      }
    }
  });

  it("is env-tunable: the exported ORG_TX_TIMEOUTS follows process.env (I-C-13 lane)", () => {
    expect(ORG_TX_TIMEOUTS.lockTimeoutMs).toBe(3000);
    process.env.ORG_LOCK_TIMEOUT_MS = "200";
    process.env.ORG_TX_TIMEOUT_MS = "400";
    process.env.ORG_TX_MAX_WAIT_MS = "150";
    expect(ORG_TX_TIMEOUTS.lockTimeoutMs).toBe(200);
    expect(ORG_TX_TIMEOUTS.txTimeoutMs).toBe(400);
    expect(ORG_TX_TIMEOUTS.maxWaitMs).toBe(150);
  });

  it("ORG_RATE_LIMITS is likewise a live view over process.env", () => {
    expect(ORG_RATE_LIMITS.createOrganization.limit).toBe(10);
    process.env[ORG_RATE_LIMIT_ENV_VARS.createOrganization] = "2";
    expect(ORG_RATE_LIMITS.createOrganization.limit).toBe(2);
  });
});

describe("loadEnv() fail-closed at boot", () => {
  it("missing var → exits non-zero and prints the offending var name", () => {
    const exit = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as never);
    const errors: string[] = [];
    const consoleError = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.join(" "));
    });

    const { INVITATION_TOKEN_SECRET: _a, DEFAULT_ORG_PLAN_KEY: _b, ...rest } = validEnv;
    expect(() => loadEnv(rest as NodeJS.ProcessEnv)).toThrow("process.exit called");
    expect(exit).toHaveBeenCalledWith(1);
    expect(errors.join("\n")).toContain("INVITATION_TOKEN_SECRET");
    expect(errors.join("\n")).toContain("DEFAULT_ORG_PLAN_KEY");

    exit.mockRestore();
    consoleError.mockRestore();
  });

  it("complete env → returns the parsed value without exiting", () => {
    const exit = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as never);
    const env = loadEnv(validEnv as NodeJS.ProcessEnv);
    expect(exit).not.toHaveBeenCalled();
    expect(env.DEFAULT_ORG_PLAN_KEY).toBe("comp_full");
    expect(env.MAX_ORGS_PER_USER).toBe("50");
    exit.mockRestore();
  });
});
