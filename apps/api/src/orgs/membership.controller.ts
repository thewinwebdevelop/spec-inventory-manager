// F-002 · T-002-18 ★ — `DELETE /orgs/{orgId}/membership` (api-spec §3.17, D-029).
//
// ── WHY THIS IS A SEPARATE ROUTE AND NOT A RELAXATION OF §3.9 ──────────────
// The obvious alternative is "let `DELETE /orgs/{orgId}/members/{userId}` skip
// the capability check when `userId === ctx.userId`". It was rejected, and the
// reasons are structural rather than stylistic (api-spec §3.17):
//
//  1. CONFUSED DEPUTY, CLOSED BY SHAPE. This route has NO `userId` anywhere in
//     it. The target is `ctx.userId`, always, so no bug in the handler or the
//     service can ever point it at another person. The alternative closes the
//     same hole with an `if`, and an `if` is exactly what C-1 was.
//  2. THE ROUTE REGISTRY STAYS DECIDABLE. `CapabilityGuard` reads metadata and
//     nothing else. "The capability this route needs depends on a value in the
//     path" cannot be expressed in metadata, so the decision would have to move
//     into the service — where forgetting it is silent (I-2).
//  3. DIFFERENT EVENT, DIFFERENT QUESTION. This emits `org.member.left`, not
//     `org.member.revoked`. Afterwards, "did the team walk out or did the owner
//     clear them out?" is answerable — and with one shared event type it is not.
//
// `@AnyActiveMember()` is a POSITIVE declaration ("no capability is needed, on
// purpose"), not an omission, and it is pinned in
// `ANY_ACTIVE_MEMBER_ROUTES.mutating` — the ONE mutating route in that list
// (G-13 asserts the tier and the size, so a second one cannot arrive quietly).
import { Controller, Delete, HttpCode, HttpStatus, Inject, Res } from "@nestjs/common";
import type { Response } from "express";
import { AnyActiveMember } from "../common/authz";
import { MembersService, type LeaveOrgResult } from "./members.service";
import { ORG_PROFILE_RESPONSE_HEADERS, applyResponseHeaders } from "./response-headers";

@Controller("orgs/:orgId/membership")
export class MembershipController {
  constructor(@Inject(MembersService) private readonly members: MembersService) {}

  /**
   * api-spec §3.17 — leave the shop.
   *
   * `200` with a body (not `204`): the caller needs `cancelledInvitations` to
   * tell the user that a pending invitation of theirs was withdrawn too, and
   * `revokedAt` for the confirmation copy.
   *
   * Errors: `409 LAST_OWNER` (the only Owner cannot leave — promote somebody
   * first) · `403 ORG_ACCESS_DENIED` (not an active member, which covers
   * pressing the button twice) · `409 CONFLICT` + `details.reason="busy"`.
   * ⛔ There is NO `403 FORBIDDEN` on this route: there is no capability to
   * lack, so a client seeing 403 here can only be looking at ORG_ACCESS_DENIED.
   */
  @AnyActiveMember()
  @Delete()
  @HttpCode(HttpStatus.OK)
  async leave(@Res({ passthrough: true }) res: Response): Promise<LeaveOrgResult> {
    // "When did this person leave which shop" is a fact about a person; api-spec
    // §1 puts §3.10–§3.17 under `no-store` for that reason, even though this
    // body carries no email.
    applyResponseHeaders(res, ORG_PROFILE_RESPONSE_HEADERS);
    return this.members.leave();
  }
}
