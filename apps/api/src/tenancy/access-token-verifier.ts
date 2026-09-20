// F-002 · T-002-04 — bearer verification for the tenancy chain (architecture §1.3).
//
// The middleware needs `userId` BEFORE any guard has run (NestJS order:
// middleware → guard → interceptor → handler), so it cannot wait for
// `JwtAuthGuard` to populate `req.user` (I-4). Verifying HS256 again is a few
// microseconds of CPU and zero I/O, which is exactly why §1.3 chose it: no
// change to `JwtAuthGuard`, no change to auth's error semantics.
//
// WHY THIS IS NOT `auth/AccessTokenService`: the apps/api boundary gate
// (`api-leafward-only`, backend.md §2.2 rule 2) forbids middle-layer code
// (tenancy/, common/, prisma/, jobs/) from importing a FEATURE module such as
// auth/ — infra must not depend on features. So this is a verify-only twin,
// pinned by access-token-verifier.test.ts to the same invariants auth enforces:
// alg HS256 only (never alg:none / client-chosen), `typ` must be "access" (an
// opaque refresh token can never be replayed here), ~30s clock-skew leeway.
// If a third consumer ever appears, extract it to common/ — do not import auth.
import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ACCESS_TOKEN_TYP } from "@omnistock/core-domain";

/** Same leeway as auth's AccessTokenService (mobile clock drift). */
const CLOCK_SKEW_LEEWAY_SECONDS = 30;

/** DI token — the module binds the JWT implementation; tests bind a fake. */
export const ACCESS_TOKEN_VERIFIER = Symbol("ACCESS_TOKEN_VERIFIER");

export interface VerifiedAccessToken {
  userId: string;
}

/**
 * Verify-only port. **Never throws**: an absent/forged/expired token is `null`,
 * and turning that into `401 UNAUTHENTICATED` is the guard's job (§1.3) — the
 * middleware must stay transparent so it cannot change any route's status code.
 */
export interface AccessTokenVerifier {
  verify(rawToken: string): VerifiedAccessToken | null;
}

@Injectable()
export class JwtAccessTokenVerifier implements AccessTokenVerifier {
  private readonly jwt: JwtService;

  constructor(secret: string) {
    this.jwt = new JwtService({ secret });
  }

  verify(rawToken: string): VerifiedAccessToken | null {
    if (!rawToken) return null;
    try {
      const claims = this.jwt.verify<{ sub?: unknown; typ?: unknown }>(rawToken, {
        algorithms: ["HS256"], // PIN — reject alg:none / RS256 / client-chosen
        clockTolerance: CLOCK_SKEW_LEEWAY_SECONDS,
      });
      if (claims?.typ !== ACCESS_TOKEN_TYP) return null;
      if (typeof claims.sub !== "string" || claims.sub.length === 0) return null;
      return { userId: claims.sub };
    } catch {
      return null;
    }
  }
}
