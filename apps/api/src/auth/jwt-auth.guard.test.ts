import { describe, it, expect, beforeEach } from "vitest";
import { JwtService } from "@nestjs/jwt";
import { UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { AccessTokenService } from "./access-token.service";
import { JwtAuthGuard, type AuthedRequest } from "./jwt-auth.guard";

const SECRET = "access-secret-at-least-32-chars-long-value!!";

function ctxFor(req: Partial<AuthedRequest>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe("JwtAuthGuard", () => {
  let guard: JwtAuthGuard;
  let accessTokens: AccessTokenService;
  beforeEach(() => {
    accessTokens = new AccessTokenService(new JwtService({ secret: SECRET }));
    guard = new JwtAuthGuard(accessTokens);
  });

  it("populates req.user = { userId } for a valid Bearer token", () => {
    const token = accessTokens.sign("user_7");
    const req: Partial<AuthedRequest> = { headers: { authorization: `Bearer ${token}` } };
    expect(guard.canActivate(ctxFor(req))).toBe(true);
    expect(req.user).toEqual({ userId: "user_7" });
  });

  it("rejects a missing Authorization header (401)", () => {
    expect(() => guard.canActivate(ctxFor({ headers: {} }))).toThrow(UnauthorizedException);
  });

  it("rejects a non-Bearer scheme", () => {
    expect(() =>
      guard.canActivate(ctxFor({ headers: { authorization: "Basic abc" } })),
    ).toThrow(UnauthorizedException);
  });

  it("rejects a garbage/invalid token", () => {
    expect(() =>
      guard.canActivate(ctxFor({ headers: { authorization: "Bearer not.a.jwt" } })),
    ).toThrow(UnauthorizedException);
  });
});
