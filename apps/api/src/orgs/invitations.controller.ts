// F-002 · T-002-19 ★ — `/orgs/{orgId}/invitations` (api-spec §3.10–§3.13).
//
// TIER: org-scoped by saying NOTHING (§1.1 default-deny). Authorization is
// declared on each HANDLER, never on the class — a class-level marker is
// inherited by every handler added later, and the inherited one is always the
// permissive one (High-1, the `MembersController` near-miss).
//
// ALL FOUR ROUTES REQUIRE `manage_members`, the READ included: every row
// carries somebody else's email address (PDPA, D-028/I-8), and two of the four
// hand back a live credential.
//
// ⛔ THE HANDLERS NEVER READ `:orgId`. The org comes from the ALS context the
// guard chain tied to a proven active membership.
//
// `now` is passed IN from here rather than read inside the service: the edge
// owns the clock, so every expiry rule is testable without fake timers — which
// @qa's kit forbids outright, because Postgres' `now()` ignores them and a suite
// that fakes time is testing a clock the database disagrees with.
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { CAPABILITY_MANAGE_MEMBERS, type InvitationRow } from "@omnistock/core-domain";
import { domainError } from "../common";
import { RequireCapability } from "../common/authz";
import { OrgRateLimit } from "../common/org-rate-limit.decorator";
import { requireCursor, resolveLimit } from "../common/cursor";
import { JsonOnlyGuard } from "../auth";
import { CreateInvitationDto } from "./dto";
import {
  InvitationsService,
  type IssuedInvitation,
  type ReissuedLink,
} from "./invitations.service";
import {
  INVITATION_RESPONSE_HEADERS,
  ORG_PROFILE_RESPONSE_HEADERS,
  applyResponseHeaders,
} from "./response-headers";

/** `?status=` — api-spec §3.10. Default `pending`: the actionable view. */
const STATUS_FILTERS = ["pending", "accepted", "cancelled", "expired", "all"] as const;
const STATUS_INVALID_MESSAGE = "ตัวกรองสถานะไม่ถูกต้อง";
const EMAIL_REQUIRED_MESSAGE = "ต้องระบุอีเมล";
const ROLE_ID_REQUIRED_MESSAGE = "ต้องระบุบทบาท";

@Controller("orgs/:orgId/invitations")
export class InvitationsController {
  constructor(@Inject(InvitationsService) private readonly invitations: InvitationsService) {}

  /** api-spec §3.10 — `{ items, nextCursor }`. Never a token: none is stored. */
  @RequireCapability(CAPABILITY_MANAGE_MEMBERS)
  @Get()
  async list(
    @Res({ passthrough: true }) res: Response,
    @Query("status") status?: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ): Promise<{ items: readonly InvitationRow[]; nextCursor: string | null }> {
    const filter = status ?? "pending";
    if (!STATUS_FILTERS.includes(filter as (typeof STATUS_FILTERS)[number])) {
      throw domainError("VALIDATION_FAILED", { fieldErrors: { status: STATUS_INVALID_MESSAGE } });
    }
    // The body is a list of email addresses — never a shared cache (M-11).
    applyResponseHeaders(res, ORG_PROFILE_RESPONSE_HEADERS);
    return this.invitations.list({
      status: filter,
      limit: resolveLimit(limit),
      cursor: requireCursor(cursor),
    });
  }

  /**
   * api-spec §3.11 — invite. Returns the raw token ONCE; it is stored only as
   * an HMAC (D-018), so there is no second chance to read it and no "resend the
   * same link" to implement.
   *
   * Errors: `403` (capability, or the Owner-only rule) · `409 ALREADY_MEMBER` ·
   * `409 INVITATION_PENDING` (+`details.invitationId`, so the UI can offer
   * reissue instead of a dead end) · `409 INVITATION_LIMIT_REACHED` ·
   * `409 CONFLICT` + `details.reason="busy"` · `422 ROLE_INVALID` /
   * `422 VALIDATION_FAILED` · `429` · `415`.
   */
  @RequireCapability(CAPABILITY_MANAGE_MEMBERS)
  @OrgRateLimit("createInvitation")
  @Post()
  @UseGuards(JsonOnlyGuard)
  async create(
    @Body() dto: CreateInvitationDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<IssuedInvitation> {
    const email = typeof dto.email === "string" ? dto.email.trim() : "";
    const roleId = typeof dto.roleId === "string" ? dto.roleId.trim() : "";
    const fieldErrors: Record<string, string> = {};
    if (email === "") fieldErrors.email = EMAIL_REQUIRED_MESSAGE;
    if (roleId === "") fieldErrors.roleId = ROLE_ID_REQUIRED_MESSAGE;
    if (Object.keys(fieldErrors).length > 0) {
      throw domainError("VALIDATION_FAILED", { fieldErrors });
    }

    // The body contains a live credential: `no-store` so it never lands in a
    // cache, `no-referrer` so it cannot ride out in a Referer header.
    applyResponseHeaders(res, INVITATION_RESPONSE_HEADERS);
    return this.invitations.create({ email, roleId, now: new Date() });
  }

  /**
   * api-spec §3.12 — reissue. The previous link stops working immediately and
   * the expiry restarts (D-027).
   *
   * It is `manage_members` PLUS the Owner-only rule (NEW-2): reissuing an Owner
   * invitation is handing out Owner, so the capability that gates creating one
   * has to gate copying it too.
   */
  @RequireCapability(CAPABILITY_MANAGE_MEMBERS)
  @OrgRateLimit("reissueInvitationLink")
  @Post(":invitationId/link")
  // 200, not Nest's default 201 for POST: api-spec §3.12 says 200, and nothing
  // is CREATED here — the invitation already existed and only its token was
  // rotated. I shipped 201 in T-002-19; this corrects the implementation to the
  // locked contract rather than changing the contract to match the code.
  @HttpCode(HttpStatus.OK)
  async reissueLink(
    @Param("invitationId") invitationId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReissuedLink> {
    applyResponseHeaders(res, INVITATION_RESPONSE_HEADERS);
    return this.invitations.reissueLink({ invitationId, now: new Date() });
  }

  /** api-spec §3.13 — cancel. Any link already sent stops working at once. */
  @RequireCapability(CAPABILITY_MANAGE_MEMBERS)
  @Delete(":invitationId")
  async cancel(
    @Param("invitationId") invitationId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ id: string; status: "cancelled" }> {
    applyResponseHeaders(res, ORG_PROFILE_RESPONSE_HEADERS);
    return this.invitations.cancel({ invitationId, now: new Date() });
  }
}
