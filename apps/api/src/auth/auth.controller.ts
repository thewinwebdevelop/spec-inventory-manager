// F-001 · T-001-07 — /auth/* endpoints (1–7). api-spec §2.
// Endpoint 8 (admin reset) lives in members.controller.ts (org-scoped path).
//
// Guards:
//  - JsonOnlyGuard on every POST → 415 before any work (L-2).
//  - JwtAuthGuard on logout-all / sessions / change-password (Bearer).
//  - CSRF enforced in-handler on the cookie path (csrf.ts).
// Throttle is applied in-handler BEFORE credential work so it's ALWAYS its own
// 429 (M-1). Transport (cookie xor body) per api-spec §0.
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { normalizeEmail } from "@omnistock/core-domain";
import { AuthService } from "./auth.service";
import { RefreshTokenService } from "./refresh-token.service";
import { AccessTokenService } from "./access-token.service";
import { ThrottleService } from "./throttle.service";
import { JsonOnlyGuard } from "./json-only.guard";
import { JwtAuthGuard, type AuthedRequest } from "./jwt-auth.guard";
import { SignupDto, LoginDto, RefreshDto, LogoutDto, ChangePasswordDto } from "./dto";
import { setAuthCookies, setRefreshCookie, clearAuthCookies } from "./cookies";
import {
  enforceCsrfIfCookiePath,
  isCookiePath,
  mintCsrfToken,
  resolvePresentedRefreshToken,
} from "./csrf";
import { COOKIE_REFRESH } from "./auth.constants";
import { RateLimitedException } from "./rate-limited.exception";

/** Derive the client IP for throttle (trusted-proxy resolution is @devops via
 *  express `trust proxy`; here we read the resolved req.ip). */
function clientIp(req: Request): string {
  return req.ip ?? "unknown";
}

function throttled(retryAfter: number): never {
  throw new RateLimitedException(retryAfter);
}

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly refresh: RefreshTokenService,
    private readonly accessTokens: AccessTokenService,
    private readonly throttle: ThrottleService,
  ) {}

  private setRetryAfter(res: Response, seconds: number): void {
    res.setHeader("Retry-After", String(seconds));
  }

  // ── 1. POST /auth/signup ────────────────────────────────────────────────
  @Post("signup")
  @UseGuards(JsonOnlyGuard)
  @HttpCode(HttpStatus.CREATED)
  async signup(@Body() dto: SignupDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const ip = clientIp(req);
    const retryAfter = await this.throttle.checkIp(ip);
    if (retryAfter > 0) {
      this.setRetryAfter(res, retryAfter);
      throttled(retryAfter);
    }
    return this.auth.signup(dto.email, dto.password);
  }

  // ── 2. POST /auth/login ─────────────────────────────────────────────────
  @Post("login")
  @UseGuards(JsonOnlyGuard)
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const ip = clientIp(req);
    const emailNorm = normalizeEmail(dto.email);

    // Throttle FIRST — always its own 429 (M-1). IP + account dimensions.
    const ipRetry = await this.throttle.checkIp(ip);
    if (ipRetry > 0) {
      this.setRetryAfter(res, ipRetry);
      throttled(ipRetry);
    }
    const acctRetry = await this.throttle.accountRetryAfter(emailNorm);
    if (acctRetry > 0) {
      this.setRetryAfter(res, acctRetry);
      throttled(acctRetry);
    }

    const transport = dto.tokenTransport ?? "body";
    const result = await this.auth.login(dto.email, dto.password, dto.deviceId ?? null, {
      onFailure: async () => {
        await this.throttle.recordAccountFailure(emailNorm);
      },
      onSuccess: async () => {
        await this.throttle.clearAccount(emailNorm);
      },
    });

    return this.deliverTokens(res, transport, result.accessToken, result.issued.value, result.expiresIn, true);
  }

  // ── 3. POST /auth/refresh ───────────────────────────────────────────────
  @Post("refresh")
  @UseGuards(JsonOnlyGuard)
  @HttpCode(HttpStatus.OK)
  async refreshTokens(@Body() dto: RefreshDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const ip = clientIp(req);
    // L-5 plain IP hygiene (IP dimension only, no account dimension).
    const ipRetry = await this.throttle.checkIp(ip);
    if (ipRetry > 0) {
      this.setRetryAfter(res, ipRetry);
      throttled(ipRetry);
    }

    const presented = resolvePresentedRefreshToken(req, dto.refreshToken);
    if (!presented) {
      throw new UnauthorizedException({ error: { code: "NO_REFRESH_TOKEN", message: "ไม่พบ refresh token" } });
    }
    // CSRF applies whenever the token is resolved from the cookie (N-3).
    enforceCsrfIfCookiePath(req);

    const cookiePath = isCookiePath(req);
    const result = await this.refresh.rotate(presented, dto.deviceId ?? null);
    if (!result.ok) {
      // Generic 401 INVALID_REFRESH for ALL non-ok reasons (expired / benign
      // retry / cap / reuse) — reuse is logged distinctly server-side.
      throw new UnauthorizedException({ error: { code: "INVALID_REFRESH", message: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" } });
    }
    // Rotation follows the PRESENTED transport (cookie in → cookie out).
    return this.deliverTokens(
      res,
      cookiePath ? "cookie" : "body",
      this.accessTokens.sign(result.userId),
      result.issued.value,
      this.accessTokens.ttlSeconds,
      false, // rotation does not re-mint omni_csrf (persists for the session)
    );
  }

  // ── 4. POST /auth/logout ────────────────────────────────────────────────
  @Post("logout")
  @UseGuards(JsonOnlyGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: LogoutDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // CSRF on the cookie path.
    enforceCsrfIfCookiePath(req);
    const presented = resolvePresentedRefreshToken(req, dto.refreshToken);
    // Resolve the caller's family from the presented token (ownership-proving).
    const owner = presented ? await this.refresh.resolveFamily(presented) : null;

    if (owner) {
      if (dto.familyId) {
        // Per-device logout of a listed family — MUST belong to the caller (M-3).
        await this.refresh.revokeFamily(owner.userId, dto.familyId);
      } else {
        // Default: revoke the caller's current family.
        await this.refresh.revokeFamily(owner.userId, owner.familyId);
      }
    }
    // Always 204 (idempotent, no leak — even for foreign/unknown familyId).
    clearAuthCookies(res);
  }

  // ── 5. POST /auth/logout-all ────────────────────────────────────────────
  @Post("logout-all")
  @UseGuards(JsonOnlyGuard, JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(@Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
    await this.refresh.revokeAllForUser(req.user!.userId);
    clearAuthCookies(res);
  }

  // ── 6. GET /auth/sessions ───────────────────────────────────────────────
  @Get("sessions")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async sessions(@Req() req: AuthedRequest) {
    const userId = req.user!.userId;
    const live = await this.refresh.listLiveSessions(userId);
    // Mark the current family via the omni_rt cookie (if present, C-1).
    const cookieToken = (req as Request & { cookies?: Record<string, string> }).cookies?.[COOKIE_REFRESH];
    let currentFamilyId: string | null = null;
    if (cookieToken) {
      const owner = await this.refresh.resolveFamily(cookieToken);
      if (owner && owner.userId === userId) currentFamilyId = owner.familyId;
    }
    return {
      sessions: live.map((s) => ({
        familyId: s.familyId,
        deviceId: s.deviceId,
        createdAt: s.createdAt.toISOString(),
        lastUsedAt: s.lastUsedAt ? s.lastUsedAt.toISOString() : null,
        current: currentFamilyId !== null && s.familyId === currentFamilyId,
      })),
    };
  }

  // ── 7. POST /auth/change-password ───────────────────────────────────────
  @Post("change-password")
  @UseGuards(JsonOnlyGuard, JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    enforceCsrfIfCookiePath(req);
    const userId = req.user!.userId;

    // Account throttle on currentPassword (N-2), keyed on userId, its own 429.
    const acctKey = userId;
    const acctRetry = await this.throttle.accountRetryAfter(acctKey);
    if (acctRetry > 0) {
      this.setRetryAfter(res, acctRetry);
      throttled(acctRetry);
    }

    // Resolve the current family to spare from the PRESENTED refresh token only
    // (N-1) — never a client-supplied familyId (no IDOR). Must belong to caller
    // AND be LIVE (spec §2.7 "current family"; #5 security review) — a revoked/
    // expired token resolves to null → fall through to safe-direction revoke-all.
    const presented = resolvePresentedRefreshToken(req, dto.refreshToken);
    let spareFamilyId: string | null = null;
    if (presented) {
      const owner = await this.refresh.resolveFamily(presented, true);
      if (owner && owner.userId === userId) spareFamilyId = owner.familyId;
    }

    await this.auth.changePassword(userId, dto.currentPassword, dto.newPassword, spareFamilyId, {
      onFailure: async () => {
        await this.throttle.recordAccountFailure(acctKey);
      },
      onSuccess: async () => {
        await this.throttle.clearAccount(acctKey);
      },
    });
    return { ok: true };
  }

  // ── shared: deliver tokens per transport (cookie xor body, H-1) ──────────
  private deliverTokens(
    res: Response,
    transport: "cookie" | "body",
    accessToken: string,
    refreshValue: string,
    expiresIn: number,
    mintCsrf: boolean,
  ) {
    if (transport === "cookie") {
      if (mintCsrf) {
        setAuthCookies(res, refreshValue, mintCsrfToken());
      } else {
        setRefreshCookie(res, refreshValue);
      }
      // Body refreshToken is null — the plaintext lives ONLY in the httpOnly
      // cookie (H-1: never JS-readable on the web path).
      return { accessToken, refreshToken: null, expiresIn, tokenType: "Bearer" as const };
    }
    // Body transport (mobile / default): token in body, no cookies.
    return { accessToken, refreshToken: refreshValue, expiresIn, tokenType: "Bearer" as const };
  }
}
