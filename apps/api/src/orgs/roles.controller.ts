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
// editing — T-003-B23 lands `POST` (create, incl. clone), T-003-B24 `PATCH`,
// T-003-B25 `DELETE` (soft).
import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { CAPABILITY_MANAGE_ROLES, type CapabilityCatalogView } from "@omnistock/core-domain";
import { AnyActiveMember, RequireCapability, RoleWrite } from "../common/authz";
import { JsonOnlyGuard } from "../auth";
import { RolesService, type DeletedRole, type RoleListPage } from "./roles.service";
import { RoleReadService, type RoleDetail, type RoleDetailListPage } from "./role-read.service";
import { ORG_PROFILE_RESPONSE_HEADERS, applyResponseHeaders } from "./response-headers";

@Controller("orgs/:orgId/roles")
export class RolesController {
  constructor(
    @Inject(RolesService) private readonly roles: RolesService,
    @Inject(RoleReadService) private readonly reads: RoleReadService,
  ) {}

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

  /**
   * F-003 · T-003-B23 ★ — create a custom role (api-spec §1/§2). `201` + the
   * same `RoleDetail` `GET /roles/{id}` serves.
   *
   * Guard chain (api-spec §2, fixed): `manage_roles` (CapabilityGuard, 403
   * FORBIDDEN) → `ROLE_WRITES_ENABLED` (RoleWritesEnabledGuard, 503) → the
   * shared `roleWrite` quota (429) — all three from `@RequireCapability` +
   * `@RoleWrite()`. Everything after that is decided in the service, under the
   * org lock, on facts re-read there.
   *
   * The body is handed over RAW: its shape is checked after the in-tx
   * `manage_roles` floor (api-spec §2), and the handler never picks fields off
   * it — `key`/`isSystem`/`version` cannot reach the write (AC-1.4).
   */
  @RequireCapability(CAPABILITY_MANAGE_ROLES)
  @RoleWrite()
  @Post()
  @UseGuards(JsonOnlyGuard)
  async create(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RoleDetail> {
    applyResponseHeaders(res, ORG_PROFILE_RESPONSE_HEADERS);
    return this.roles.create(body);
  }

  /**
   * F-003 · T-003-B24 ★ — rename and/or replace the capabilities of a role
   * (api-spec §1/§2). `200` + the role's `RoleDetail` (the current one on a
   * no-op). Same guard chain as `create` (`manage_roles` → flag → `roleWrite`);
   * the body goes to the service RAW for the same reason — its shape is checked
   * after the in-tx floor and `ROLE_LOCKED`.
   */
  @RequireCapability(CAPABILITY_MANAGE_ROLES)
  @RoleWrite()
  @Patch(":roleId")
  @UseGuards(JsonOnlyGuard)
  async update(
    @Param("roleId") roleId: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RoleDetail> {
    applyResponseHeaders(res, ORG_PROFILE_RESPONSE_HEADERS);
    return this.roles.update(roleId, body);
  }

  /**
   * F-003 · T-003-B25 ★ — soft-delete a role (api-spec §1/§2 · data-model §2.2).
   * `200` + `DeletedRole { id, deletedAt }`. Same guard chain as create/update
   * (`manage_roles` → flag → `roleWrite`). No body and no `version` (api-spec §2),
   * so no JsonOnlyGuard: a client that sends no Content-Type is not a 415.
   */
  @RequireCapability(CAPABILITY_MANAGE_ROLES)
  @RoleWrite()
  @Delete(":roleId")
  async remove(
    @Param("roleId") roleId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<DeletedRole> {
    applyResponseHeaders(res, ORG_PROFILE_RESPONSE_HEADERS);
    return this.roles.delete(roleId);
  }

  /**
   * F-003 · T-003-B21 — api-spec §3 `RoleDetail`, one role (edit + "clone" screens).
   * `manage_roles` (api-spec §1). Another shop's id, a deleted role and an
   * unknown id are the same `404` (ORG_PRISMA + `LIVE_ROLE_WHERE`).
   */
  @RequireCapability(CAPABILITY_MANAGE_ROLES)
  @Get(":roleId")
  async detail(
    @Res({ passthrough: true }) res: Response,
    @Param("roleId") roleId: string,
  ): Promise<RoleDetail> {
    applyResponseHeaders(res, ORG_PROFILE_RESPONSE_HEADERS);
    return this.reads.getDetail(roleId);
  }
}

/**
 * F-003 · T-003-B21 — the two role-design reads that are NOT under `/roles`
 * (api-spec §1): `role-details` is its own path because one route = one
 * capability (F-002 §3.1) and `GET /roles` stays `@AnyActiveMember()`.
 * Both `manage_roles`, both org-scoped (the catalog is per shop — AC-7.4).
 * Declared per handler, never on the class (High-1).
 */
@Controller("orgs/:orgId")
export class RoleDesignController {
  constructor(@Inject(RoleReadService) private readonly reads: RoleReadService) {}

  @RequireCapability(CAPABILITY_MANAGE_ROLES)
  @Get("capabilities")
  capabilities(@Res({ passthrough: true }) res: Response): CapabilityCatalogView {
    applyResponseHeaders(res, ORG_PROFILE_RESPONSE_HEADERS);
    return this.reads.capabilities();
  }

  @RequireCapability(CAPABILITY_MANAGE_ROLES)
  @Get("role-details")
  async roleDetails(@Res({ passthrough: true }) res: Response): Promise<RoleDetailListPage> {
    applyResponseHeaders(res, ORG_PROFILE_RESPONSE_HEADERS);
    return this.reads.listDetails();
  }
}
