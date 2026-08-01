// F-002 · T-002-04 — the middleware's own access-token verification (§1.3).
//
// WHY tenancy verifies instead of reusing auth's AccessTokenService: NestJS runs
// middleware BEFORE guards, so `JwtAuthGuard` has not populated `req.user` yet
// (security-review I-4) — and the apps/api boundary gate forbids middle-layer
// code (tenancy/, common/, prisma/, jobs/) from importing a feature module such
// as auth/ (`api-leafward-only`, backend.md §2.2 rule 2). So this is a
// verify-only re-implementation, pinned to the SAME invariants as auth's:
// HS256 only, `typ` must be "access", small clock-skew leeway.
// It NEVER throws: an unverifiable token is `null`, and turning that into a 401
// stays the guard's job (§1.3).
import { describe, it, expect } from "vitest";
import { JwtService } from "@nestjs/jwt";
import { ACCESS_TOKEN_TYP } from "@omnistock/core-domain";
import { JwtAccessTokenVerifier } from "./access-token-verifier";

const SECRET = "tenancy-test-secret-32-chars-minimum-value!";
const OTHER_SECRET = "a-completely-different-secret-32-chars!!!!";

const jwt = new JwtService({ secret: SECRET });
const verifier = new JwtAccessTokenVerifier(SECRET);
const now = Math.floor(Date.now() / 1000);

function sign(payload: Record<string, unknown>, secret = SECRET): string {
  return new JwtService({ secret }).sign(payload, { algorithm: "HS256" });
}

describe("JwtAccessTokenVerifier", () => {
  it("accepts a well-formed access token and returns the subject", () => {
    const t = sign({ sub: "usr_1", iat: now, exp: now + 600, jti: "j1", typ: ACCESS_TOKEN_TYP });
    expect(verifier.verify(t)).toEqual({ userId: "usr_1" });
  });

  it("rejects a token signed with another secret", () => {
    const t = sign(
      { sub: "usr_1", iat: now, exp: now + 600, jti: "j1", typ: ACCESS_TOKEN_TYP },
      OTHER_SECRET,
    );
    expect(verifier.verify(t)).toBeNull();
  });

  it("rejects a refresh-typed token replayed as an access token", () => {
    const t = sign({ sub: "usr_1", iat: now, exp: now + 600, jti: "j1", typ: "refresh" });
    expect(verifier.verify(t)).toBeNull();
  });

  it("rejects an expired token (beyond the skew leeway)", () => {
    const t = sign({ sub: "usr_1", iat: now - 3600, exp: now - 120, jti: "j1", typ: ACCESS_TOKEN_TYP });
    expect(verifier.verify(t)).toBeNull();
  });

  it("rejects alg:none / unsigned tokens", () => {
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(
      JSON.stringify({ sub: "usr_1", exp: now + 600, typ: ACCESS_TOKEN_TYP }),
    ).toString("base64url");
    expect(verifier.verify(`${header}.${body}.`)).toBeNull();
  });

  it("rejects a token with no subject", () => {
    const t = sign({ iat: now, exp: now + 600, jti: "j1", typ: ACCESS_TOKEN_TYP });
    expect(verifier.verify(t)).toBeNull();
  });

  it("returns null (never throws) for garbage input", () => {
    for (const raw of ["", "not-a-jwt", "a.b.c", "..", jwt.sign({}) + "tampered"]) {
      expect(verifier.verify(raw)).toBeNull();
    }
  });
});
