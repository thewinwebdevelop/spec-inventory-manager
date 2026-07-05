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
});
