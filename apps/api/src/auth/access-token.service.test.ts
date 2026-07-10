import { describe, it, expect, beforeEach } from "vitest";
import { JwtService } from "@nestjs/jwt";
import { AccessTokenService } from "./access-token.service";

// ★ access token sign/verify — HS256, alg + typ pinned, EXACT minimal claim set
// on the wire-issued token (M-9 complement to core-domain U2.4).

const SECRET = "access-secret-at-least-32-chars-long-value!!";

function makeService(secret = SECRET): AccessTokenService {
  const jwtService = new JwtService({ secret, signOptions: { algorithm: "HS256" } });
  return new AccessTokenService(jwtService);
}

/** Decode a JWT payload without verifying (base64url of the middle segment). */
function decodePayload(token: string): Record<string, unknown> {
  const [, payload] = token.split(".");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

describe("AccessTokenService", () => {
  let svc: AccessTokenService;
  beforeEach(() => {
    svc = makeService();
  });

  const nowSec = Math.floor(Date.now() / 1000);

  it("signs a token that verifies and round-trips sub", () => {
    const token = svc.sign("user_42", nowSec);
    const claims = svc.verify(token);
    expect(claims.sub).toBe("user_42");
    expect(claims.typ).toBe("access");
  });

  it("wire-issued token decodes to EXACTLY { sub, iat, exp, jti, typ } — no PII/org/role", () => {
    const token = svc.sign("user_42", nowSec);
    // Verify signature via the service, then inspect the raw payload key set.
    svc.verify(token);
    const decoded = decodePayload(token);
    expect(Object.keys(decoded).sort()).toEqual(["exp", "iat", "jti", "sub", "typ"]);
    for (const forbidden of ["email", "organizationId", "orgId", "role", "capabilities", "aud", "iss"]) {
      expect(decoded).not.toHaveProperty(forbidden);
    }
    expect((decoded.exp as number) - (decoded.iat as number)).toBe(900);
  });

  it("rejects a token signed with a DIFFERENT secret (forgery defense)", () => {
    // Sign with a different secret → the real service's verify fails signature.
    const forged = makeService("a-different-secret-32-chars-longvalue!!").sign("attacker");
    expect(() => svc.verify(forged)).toThrow();
  });

  it("rejects a token whose typ is NOT 'access' (type-confusion defense)", () => {
    // Sign a payload with typ=refresh using the same secret via a raw JwtService.
    const jwtService = new JwtService({ secret: SECRET });
    const notAccess = jwtService.sign(
      { sub: "u", typ: "refresh", iat: 1, exp: 9_999_999_999, jti: "j" },
      { algorithm: "HS256", noTimestamp: true },
    );
    expect(() => svc.verify(notAccess)).toThrow();
  });

  it("rejects an expired token", () => {
    // iat far in the past so exp is also past (beyond the 30s leeway).
    const token = svc.sign("u", 1_000_000_000);
    expect(() => svc.verify(token)).toThrow();
  });

  it("exposes a 900s TTL", () => {
    expect(svc.ttlSeconds).toBe(900);
  });
});
