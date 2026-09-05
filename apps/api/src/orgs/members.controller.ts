// F-002 · T-002-18 ★ — `GET/PATCH/DELETE /orgs/{orgId}/members[/{userId}]`
// (api-spec §3.7–§3.9).
//
// TIER: org-scoped — declared by saying NOTHING (§1.1 default-deny). What each
// handler DOES declare is its authorization, on the HANDLER and never on the
// class (High-1: a class-level marker is inherited by every handler added
// later, and the inherited one is always the permissive one).
//
// ALL THREE ROUTES REQUIRE `manage_members`, INCLUDING THE READ. That is not
// symmetry for its own sake: `GET /orgs/{orgId}/members` returns the email
// address of every person in the shop, which is PII under PDPA (D-028/I-8/N-4),
// and it is the concrete surface that made NEW-3 extend fail-closed capability
// checking to read routes. A Staff member calling it gets `403 FORBIDDEN`.
//
// ⛔ THE HANDLERS NEVER READ `:orgId`. The org comes from the ALS context the
// guard chain already tied to a proven active membership; reading the path param
// here would reintroduce the confused-deputy gap that check closed. `:userId`
// IS read — it is the target, and it is exactly why these routes are
// capability-gated while `DELETE /orgs/{orgId}/membership` (no `userId`, target
// is structurally the caller) is not.
import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { CAPABILITY_MANAGE_MEMBERS, type MemberRow } from "@omnistock/core-domain";
import { domainError } from "../common";
import { RequireCapability } from "../common/authz";
import { requireCursor, resolveLimit } from "../common/cursor";
import { JsonOnlyGuard } from "../auth";
import { UpdateMemberRoleDto } from "./dto";
import {
  MembersService,
  type MemberListPage,
  type MemberListStatusFilter,
  type RevokeMemberResult,
} from "./members.service";
import { ORG_PROFILE_RESPONSE_HEADERS, applyResponseHeaders } from "./response-headers";

/**
 * `?status=` — api-spec §3.7. `invited` is NOT an option: no production write
 * path creates that state (data-model §7), so offering it would advertise a
 * filter that can only ever return nothing. Anything else is a client bug and
 * is refused, never coerced to a default.
 */
const STATUS_FILTERS: readonly MemberListStatusFilter[] = ["active", "revoked", "all"];
const STATUS_INVALID_MESSAGE = "ตัวกรองสถานะไม่ถูกต้อง";
const ROLE_ID_REQUIRED_MESSAGE = "ต้องระบุบทบาท";

@Controller("orgs/:orgId/members")
export class MembersController {
  constructor(@Inject(MembersService) private readonly members: MembersService) {}

  /**
   * api-spec §3.7 — the member directory, `{ items, nextCursor, total? }`,
   * sorted `createdAt desc, id desc` (fixed; the client cannot choose in F-002,
   * so the cursor's meaning is stable).
   *
   * `Cache-Control: no-store` + `Pragma: no-cache` — the body is a list of
   * people's email addresses and must not sit in a shared cache (M-11).
   */
  @RequireCapability(CAPABILITY_MANAGE_MEMBERS)
  @Get()
  async list(
    @Res({ passthrough: true }) res: Response,
    @Query("status") status?: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
    @Query("withTotal") withTotal?: string,
  ): Promise<MemberListPage> {
    // §3.7 — `all` is the DEFAULT here (unlike `/me/organizations`, where the
    // default is `active`): this screen is the audit view of who is and who was
    // in the shop, and hiding the removed rows by default would make "why can
    // this person no longer log in?" unanswerable from the UI.
    const filter = status ?? "all";
    if (!STATUS_FILTERS.includes(filter as MemberListStatusFilter)) {
      throw domainError("VALIDATION_FAILED", { fieldErrors: { status: STATUS_INVALID_MESSAGE } });
    }

    applyResponseHeaders(res, ORG_PROFILE_RESPONSE_HEADERS);
    return this.members.list({
      status: filter as MemberListStatusFilter,
      limit: resolveLimit(limit),
      cursor: requireCursor(cursor),
      // Opt-in only (api-spec §1): a `count` on every page is a second query
      // the switcher-style callers do not need.
      withTotal: withTotal === "true",
    });
  }

  /**
   * api-spec §3.8 — change a member's role. Answers with the §3.7 row, so a
   * client never has to refetch the list to render the new state.
   *
   * Errors: `403 FORBIDDEN` (missing capability, or the Owner-only rule) ·
   * `404 NOT_FOUND` (not an active member of this shop) · `409 LAST_OWNER` ·
   * `409 CONFLICT` + `details.reason="busy"` (lock contention) ·
   * `422 ROLE_INVALID` / `422 VALIDATION_FAILED` · `415`.
   */
  @RequireCapability(CAPABILITY_MANAGE_MEMBERS)
  @Patch(":userId")
  @UseGuards(JsonOnlyGuard)
  async updateRole(
    @Param("userId") userId: string,
    @Body() dto: UpdateMemberRoleDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MemberRow> {
    const roleId = typeof dto.roleId === "string" ? dto.roleId.trim() : "";
    if (roleId === "") {
      throw domainError("VALIDATION_FAILED", { fieldErrors: { roleId: ROLE_ID_REQUIRED_MESSAGE } });
    }
    // The response carries the target's email (it is the §3.7 row), so it
    // carries the §3.7 header policy with it.
    applyResponseHeaders(res, ORG_PROFILE_RESPONSE_HEADERS);
    return this.members.updateRole({ targetUserId: userId, roleId });
  }

  /**
   * api-spec §3.9 — remove a member. SOFT (`status='revoked'`): the row stays,
   * because history references it and because `revokedAt` is a security input
   * (an invitation issued before it can no longer be accepted — I-1).
   *
   * Removing YOURSELF through this route is allowed, but only for someone who
   * already holds `manage_members`; everybody else uses `DELETE …/membership`
   * (§3.17). This route grants nobody a softer path (D-029).
   */
  @RequireCapability(CAPABILITY_MANAGE_MEMBERS)
  @Delete(":userId")
  async revoke(
    @Param("userId") userId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RevokeMemberResult> {
    applyResponseHeaders(res, ORG_PROFILE_RESPONSE_HEADERS);
    return this.members.revoke({ targetUserId: userId });
  }
}
