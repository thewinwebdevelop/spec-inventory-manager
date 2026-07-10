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
