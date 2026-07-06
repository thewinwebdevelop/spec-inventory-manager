import { describe, it, expect } from "vitest";
import { buildAccessClaims, ACCESS_TOKEN_TTL_SECONDS } from "./access-claims";

// ★ U2.4 (M-9) — access-JWT claim set is EXACTLY the minimal documented set.

describe("buildAccessClaims (U2.4 / M-9)", () => {
  const claims = buildAccessClaims({ userId: "user_123", jti: "jti_abc", nowSeconds: 1_700_000_000 });

  it("key set is EXACTLY { sub, iat, exp, jti, typ } — no more, no fewer", () => {
    expect(Object.keys(claims).sort()).toEqual(["exp", "iat", "jti", "sub", "typ"]);
  });

  it("carries NO PII / org / role fields (regression guard)", () => {
    const forbidden = ["email", "organizationId", "orgId", "role", "roles", "capabilities", "name"];
    for (const key of forbidden) {
      expect(claims).not.toHaveProperty(key);
    }
  });

  it("sub === userId and typ === 'access'", () => {
    expect(claims.sub).toBe("user_123");
    expect(claims.typ).toBe("access");
  });

  it("exp − iat === 900 (15-minute TTL)", () => {
    expect(claims.exp - claims.iat).toBe(900);
    expect(ACCESS_TOKEN_TTL_SECONDS).toBe(900);
  });

  it("honors an overridden TTL but keeps the exact key set", () => {
    const c = buildAccessClaims({ userId: "u", jti: "j", nowSeconds: 1000, ttlSeconds: 60 });
    expect(c.exp - c.iat).toBe(60);
    expect(Object.keys(c).sort()).toEqual(["exp", "iat", "jti", "sub", "typ"]);
  });
});
