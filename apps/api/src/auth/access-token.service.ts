// F-001 · T-001-04 — access-token sign/verify (HS256). arch §2.2/§9.
// - HS256 signed with JWT_ACCESS_SECRET. Claims are EXACTLY the minimal set
//   built by core-domain `buildAccessClaims` (M-9): { sub, iat, exp, jti, typ }.
// - Verify PINS alg=HS256 and typ="access": never accept alg:none or a
//   client-chosen alg (type-confusion / forgery defense, §9). A refresh token
//   (opaque, not a JWT) can therefore never be replayed as an access token.
// - ~30s clock-skew leeway on exp/iat (arch §11).
import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { randomUUID } from "node:crypto";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  ACCESS_TOKEN_TYP,
  type AccessTokenClaims,
} from "@omnistock/core-domain";

/** Small clock-skew leeway (seconds) for mobile clock drift (arch §11). */
const CLOCK_SKEW_LEEWAY_SECONDS = 30;

@Injectable()
export class AccessTokenService {
  constructor(private readonly jwt: JwtService) {}

  /**
   * Sign a minimal access token for `userId`. The signed payload is EXACTLY the
   * minimal set (M-9): the library adds `iat` + `exp` from `expiresIn` (so
   * `exp − iat === ttl`), and we supply only `{ sub, jti, typ }` — no PII/org/
   * role can leak at the signing site. The pure `buildAccessClaims` fn documents
   * and unit-tests the same 5-key shape (U2.4); this site is guarded by the
   * wire-token key-set test (I2.10-style).
   *
   * `nowSeconds` is accepted for test determinism; when provided we set `iat`
   * explicitly and derive `exp` so the token can be issued at a fixed instant.
   */
  sign(userId: string, nowSeconds?: number): string {
    const jti = randomUUID();
    if (nowSeconds === undefined) {
      // Production path: let the lib stamp iat (now) + exp (now + ttl).
      return this.jwt.sign(
        { sub: userId, jti, typ: ACCESS_TOKEN_TYP },
        { algorithm: "HS256", expiresIn: ACCESS_TOKEN_TTL_SECONDS },
      );
    }
    // Deterministic path: payload carries explicit iat + exp and we pass NEITHER
    // `noTimestamp` (which would strip iat) NOR `expiresIn` (which would fight a
    // payload exp) — jsonwebtoken then preserves the provided iat/exp verbatim.
    const payload: AccessTokenClaims = {
      sub: userId,
      iat: nowSeconds,
      exp: nowSeconds + ACCESS_TOKEN_TTL_SECONDS,
      jti,
      typ: ACCESS_TOKEN_TYP,
    };
    return this.jwt.sign(payload, { algorithm: "HS256" });
  }

  /**
   * Verify + decode an access token. Returns the claims on success; throws on
   * any failure (bad signature, wrong alg, expired, wrong typ). The guard maps
   * a throw to 401. alg is pinned to HS256 and typ must be "access".
   */
  verify(token: string): AccessTokenClaims {
    const decoded = this.jwt.verify<AccessTokenClaims>(token, {
      algorithms: ["HS256"], // PIN — reject alg:none / RS256 / client-chosen
      clockTolerance: CLOCK_SKEW_LEEWAY_SECONDS,
    });
    if (decoded.typ !== ACCESS_TOKEN_TYP) {
      throw new Error("token typ is not 'access'");
    }
    return decoded;
  }

  /** TTL (seconds) surfaced in the login/refresh response `expiresIn`. */
  get ttlSeconds(): number {
    return ACCESS_TOKEN_TTL_SECONDS;
  }
}
