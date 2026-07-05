import { describe, expect, it } from "vitest";
import { envSchema } from "./env";

const validEnv: Record<string, string> = {
  DATABASE_URL: "postgresql://omnistock:omnistock@localhost:5432/omnistock_dev?schema=public",
  REDIS_URL: "redis://localhost:6379",
  JWT_ACCESS_SECRET: "dev-access-secret-change-me",
  JWT_REFRESH_SECRET: "dev-refresh-secret-change-me",
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
});
