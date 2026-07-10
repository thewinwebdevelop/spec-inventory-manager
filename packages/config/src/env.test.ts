import { describe, expect, it } from "vitest";
import { envSchema } from "./env";

const validEnv: Record<string, string> = {
  DATABASE_URL: "postgresql://omnistock:omnistock@localhost:5432/omnistock_dev?schema=public",
  REDIS_URL: "redis://localhost:6379",
  JWT_ACCESS_SECRET: "dev-access-secret-change-me-0000000000",
  JWT_REFRESH_SECRET: "dev-refresh-secret-change-me-0000000000",
  PORT: "3000",
  NODE_ENV: "development",
};

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
