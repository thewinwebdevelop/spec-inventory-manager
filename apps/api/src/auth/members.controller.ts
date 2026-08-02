// F-001 · T-001-07 — endpoint 8: POST /orgs/:orgId/members/:userId/reset-password
// (US-5, api-spec §2.8). Org-scoped path; the FULL capability check is inline in
// AuthService.adminResetPassword (active caller + manage_members + active target
// + 404-never-403). Bearer-authed; its own account throttle keyed on the caller
// (outside the /auth/* throttles).
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { AuthService } from "./auth.service";
import { ThrottleService } from "./throttle.service";
import { JsonOnlyGuard } from "./json-only.guard";
import { JwtAuthGuard, type AuthedRequest } from "./jwt-auth.guard";
import { AdminResetDto } from "./dto";
import { RateLimitedException } from "./rate-limited.exception";
import { UserScoped } from "../tenancy/route-scope.decorator";

// T-002-13 — `@UserScoped()`, NOT org-scoped, even though `:orgId` is right
// there in the path (architecture §1.1, §15 row 7).
//
// The reason is the 404-never-403 contract this endpoint shipped with. Under
// the org-scoped tier the global guard answers first and returns 403
// ORG_ACCESS_DENIED for a caller with no active membership — which is exactly
// the oracle F-001 spent its design on removing: "403 vs 404" tells an attacker
// whether an org exists and whether they are in it. `@UserScoped()` keeps the
// guard out of the way so `AuthService.adminResetPassword` answers all four
// refusals with one identical 404 (see its doc comment).
//
// This costs nothing in tenant isolation: the handler does not reach for
// ORG_PRISMA, and every read it makes is filtered by `organizationId` explicitly
// inside its transaction.
@UserScoped()
@Controller("orgs/:orgId/members/:userId")
export class MembersController {
  constructor(
    private readonly auth: AuthService,
    private readonly throttle: ThrottleService,
  ) {}

  @Post("reset-password")
  @UseGuards(JsonOnlyGuard, JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Param("orgId") orgId: string,
    @Param("userId") targetUserId: string,
    @Body() dto: AdminResetDto,
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const callerUserId = req.user!.userId;
    // Own throttle, keyed on the caller (api-spec §2.8), its own 429.
    const acctKey = `${callerUserId}:reset-password`;
    const retryAfter = await this.throttle.accountRetryAfter(acctKey);
    if (retryAfter > 0) {
      res.setHeader("Retry-After", String(retryAfter));
      throw new RateLimitedException(retryAfter);
    }

    try {
      await this.auth.adminResetPassword(callerUserId, orgId, targetUserId, dto.newPassword);
    } catch (err) {
      // A failed reset (e.g. bad policy) counts toward the modest cap so the
      // path can't be hammered; a 404 (unauthorized) also increments so probing
      // is bounded. Success clears.
      await this.throttle.recordAccountFailure(acctKey);
      throw err;
    }
    await this.throttle.clearAccount(acctKey);
    return { ok: true };
  }
}
