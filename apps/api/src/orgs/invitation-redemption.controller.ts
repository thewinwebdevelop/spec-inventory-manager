// F-002 · T-002-20 ★ — `/invitations/preview` + `/invitations/accept`
// (api-spec §3.14/§3.15). THE ONLY TWO F-002 ROUTES A STRANGER CAN REACH.
//
// ── WHY A SEPARATE CONTROLLER FROM `InvitationsController` ─────────────────
// That one is mounted under `orgs/:orgId/invitations` and every handler on it
// demands `manage_members`. These two are the opposite kind of route: one is
// unauthenticated, the other authenticated but with NO organization, and the
// org they eventually touch is proven by a row rather than declared by the
// caller. Sharing a class would mean the two tiers sit one handler apart, and
// the guard chain resolves class metadata as a fallback — so the safest
// declaration would be inherited by the least safe route. Keeping them apart
// makes "which routes are exposed?" a question answered by opening one file.
//
// ── TIERS, ON THE HANDLER (High-1) ─────────────────────────────────────────
// `@Public()` on preview, `@UserScoped()` on accept — never on the class. A
// class-level tier is inherited by every handler added later, and the inherited
// one is always the permissive one.
//
// ⛔ NEITHER HANDLER READS `X-Organization-Id`, and neither can: the middleware
// creates no context for these tiers (I-3), so `ORG_PRISMA` throws on this path
// and the organization can only come from the invitation row.
//
// `now` is passed IN from here: the edge owns the clock, so every expiry rule is
// testable without fake timers — which @qa's kit forbids outright, because
// Postgres' `now()` ignores them.
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import type { InvitationAcceptResult, InvitationPreview } from "@omnistock/core-domain";
import { domainError } from "../common";
import { OrgRateLimit } from "../common/org-rate-limit.decorator";
import { JsonOnlyGuard } from "../auth";
import { Public, UserScoped, type OrgAuthRequest } from "../tenancy";
import { RedeemInvitationDto } from "./dto";
import { InvitationsService } from "./invitations.service";
import { INVITATION_RESPONSE_HEADERS, applyResponseHeaders } from "./response-headers";

const TOKEN_REQUIRED_MESSAGE = "ต้องระบุลิงก์คำเชิญ";

@Controller("invitations")
export class InvitationRedemptionController {
  constructor(@Inject(InvitationsService) private readonly invitations: InvitationsService) {}

  /**
   * api-spec §3.14 — "who invited me, to what, and until when", for somebody who
   * may not have an account yet.
   *
   * `@Public()`: the invite page has to render before the user decides whether
   * to sign in or sign up, so there is nobody to authenticate. The quota is
   * therefore the ONLY thing bounding this endpoint — 30/hour/IP (IPv6 collapsed
   * to /64, so one subscriber cannot mint unlimited buckets). It is not
   * decoration: this route is enumerable by construction, and without the limit
   * the 256-bit token space would be the sole defence against a machine trying.
   *
   * Errors: `404 INVITATION_INVALID` (one answer for every unknown token) ·
   * `409 INVITATION_EXPIRED|INVITATION_CANCELLED|INVITATION_ALREADY_ACCEPTED` ·
   * `422 VALIDATION_FAILED` · `429` · `415`.
   */
  @Public()
  @OrgRateLimit("publicInvitationEntry")
  @Post("preview")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JsonOnlyGuard)
  async preview(
    @Body() dto: RedeemInvitationDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<InvitationPreview> {
    const token = requireToken(dto);
    // `no-store` + `no-referrer`: the response carries a masked email, and the
    // PAGE it renders on holds the token in its URL. Without `no-referrer` that
    // URL travels to whatever the page loads next (I-6).
    applyResponseHeaders(res, INVITATION_RESPONSE_HEADERS);
    return this.invitations.preview({ token, now: new Date() });
  }

  /**
   * api-spec §3.15 — join the shop.
   *
   * `@UserScoped()`: authenticated, but about the USER, not about an org. The
   * organization is read from the invitation row inside the service, which then
   * opens the context itself — the caller has no way to influence which tenant
   * the membership is written to (I-3), and that is a structural property of
   * this route, not a check somebody has to remember.
   *
   * Errors: `404 INVITATION_INVALID` · `409 INVITATION_EXPIRED|CANCELLED|
   * ALREADY_ACCEPTED|ALREADY_MEMBER|INVITATION_SUPERSEDED|
   * INVITATION_ROLE_UNAVAILABLE` · `409 CONFLICT` + `details.reason="busy"` ·
   * `403 INVITATION_EMAIL_MISMATCH` (+`details.emailMasked`) · `401` · `429` ·
   * `422` · `415`.
   */
  @UserScoped()
  @OrgRateLimit("publicInvitationEntry")
  @Post("accept")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JsonOnlyGuard)
  async accept(
    @Body() dto: RedeemInvitationDto,
    @Req() req: OrgAuthRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<InvitationAcceptResult> {
    // From the VERIFIED bearer token the middleware recorded — never `req.user`,
    // which is set by a controller-level guard that does not run here (I-4).
    const userId = req.orgAuth?.userId;
    // Unreachable behind `OrgScopeGuard` (401 on this tier for an invalid
    // token). Reaching here would mean joining a shop to nobody, so it fails
    // loud rather than defaulting.
    if (!userId) throw domainError("INTERNAL");

    const token = requireToken(dto);
    applyResponseHeaders(res, INVITATION_RESPONSE_HEADERS);
    return this.invitations.accept({ userId, token, now: new Date() });
  }
}

/**
 * The body's token, or `422 VALIDATION_FAILED` + `fieldErrors.token`.
 *
 * A missing token is a CLIENT bug (the invite page lost it), not "no such
 * invitation" — answering 404 here would teach the client to send the user down
 * the "ask for a new link" path for a bug a retry would fix. The value is never
 * echoed back in the error: it is a credential.
 */
function requireToken(dto: RedeemInvitationDto): string {
  const token = typeof dto.token === "string" ? dto.token.trim() : "";
  if (token === "") {
    throw domainError("VALIDATION_FAILED", { fieldErrors: { token: TOKEN_REQUIRED_MESSAGE } });
  }
  return token;
}
