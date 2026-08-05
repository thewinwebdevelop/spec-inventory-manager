// F-002 · T-002-16b — `GET /orgs/{orgId}/roles` (api-spec §3.6).
//
// WHY THIS EXISTS AT ALL: AC US-3 makes choosing a role MANDATORY when inviting
// somebody. Without this endpoint the invite screen has no way to populate that
// dropdown, so the acceptance criterion cannot be met by any client. It was in
// the signed contract and in `ANY_ACTIVE_MEMBER_ROUTES` from the start — it was
// missing from the task board, and the router↔spec parity gate (T-002-21) is
// what finally made the absence visible.
//
// TIER: org-scoped by saying nothing (§1.1 default-deny), `@AnyActiveMember()`
// because it carries no PII and nothing about anybody else: three role names
// the caller can already see on their own membership. Requiring
// `manage_members` here would mean a Staff member could not be shown the name
// of their own role.
//
// READ-ONLY in F-002. F-003 adds create/update/delete and per-role capability
// editing; publishing a write path now would put a shape on the wire that F-003
// has to change.
import { Controller, Get, Inject, Res } from "@nestjs/common";
import type { Response } from "express";
import { AnyActiveMember } from "../common/authz";
import { RolesService, type RoleListPage } from "./roles.service";
import { ORG_PROFILE_RESPONSE_HEADERS, applyResponseHeaders } from "./response-headers";

@Controller("orgs/:orgId/roles")
export class RolesController {
  constructor(@Inject(RolesService) private readonly roles: RolesService) {}

  /**
   * api-spec §3.6 — `{ items, nextCursor }`.
   *
   * `nextCursor` is always `null` in F-002: a shop has exactly the three system
   * roles until F-003 lets people add more. It is still in the response because
   * the shape is the project's list convention (§1) and the client that reads
   * it today should not need rewriting the day a fourth role exists.
   */
  @AnyActiveMember()
  @Get()
  async list(@Res({ passthrough: true }) res: Response): Promise<RoleListPage> {
    applyResponseHeaders(res, ORG_PROFILE_RESPONSE_HEADERS);
    return this.roles.list();
  }
}
