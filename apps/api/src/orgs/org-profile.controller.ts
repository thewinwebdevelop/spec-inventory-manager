// F-002 · T-002-16 — `GET /orgs/{orgId}` + `PATCH /orgs/{orgId}`
// (api-spec §3.3/§3.4).
//
// TIER: org-scoped — declared by saying NOTHING (§1.1 default-deny). What each
// handler DOES declare is its authorization, and it must: `CapabilityGuard`
// refuses any org-scoped route, read or write, that declares neither
// `@RequireCapability` nor `@AnyActiveMember` (NEW-3). Both declarations below
// have a matching row in `ROUTE_CAPABILITIES` / `ANY_ACTIVE_MEMBER_ROUTES`, and
// @qa's route-registry audit compares this router to those tables byte for byte.
//
//   GET   → @AnyActiveMember()  — every member may see their own shop's profile.
//                                 Safe because the body goes through the PDPA
//                                 mapper: no member list, no tax id (§3.3).
//   PATCH → @RequireCapability(manage_org_settings)
//
// `:orgId` is in the path so a client can address the shop without the header
// (§1.2 source 2). The HANDLERS NEVER READ IT: the org comes from the ALS
// context, which the guard chain has already tied to a proven active
// membership. Reading the path param inside a handler is how a "which org am I
// operating on?" bug gets written.
import {
  Body,
  Controller,
  Get,
  Inject,
  Patch,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import {
  CAPABILITY_MANAGE_ORG_SETTINGS,
  validateOrgProfilePatch,
  type OrgProfileView,
} from "@omnistock/core-domain";
import { domainError } from "../common";
import { AnyActiveMember, RequireCapability } from "../common/authz";
import { JsonOnlyGuard } from "../auth";
import { UpdateOrganizationDto } from "./dto";
import { OrgProfileService } from "./org-profile.service";
import { ORG_PROFILE_RESPONSE_HEADERS, applyResponseHeaders } from "./response-headers";

@Controller("orgs/:orgId")
export class OrgProfileController {
  constructor(@Inject(OrgProfileService) private readonly profile: OrgProfileService) {}

  /** api-spec §3.3. `Cache-Control: no-store` — the body carries PII. */
  @AnyActiveMember()
  @Get()
  async get(@Res({ passthrough: true }) res: Response): Promise<OrgProfileView> {
    applyResponseHeaders(res, ORG_PROFILE_RESPONSE_HEADERS);
    return this.profile.get();
  }

  /**
   * api-spec §3.4 — returns the same body as `GET`.
   *
   * `logo` accepts `null` and nothing else in Phase 0 (M-4): until F-040 mints
   * object keys, an arbitrary string here would make every member of the shop
   * load a URL chosen by whoever holds `manage_org_settings`.
   */
  @RequireCapability(CAPABILITY_MANAGE_ORG_SETTINGS)
  @Patch()
  @UseGuards(JsonOnlyGuard)
  async update(
    @Body() dto: UpdateOrganizationDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OrgProfileView> {
    const validated = validateOrgProfilePatch(dto);
    if (!validated.ok) {
      throw domainError("VALIDATION_FAILED", { fieldErrors: validated.fieldErrors });
    }
    applyResponseHeaders(res, ORG_PROFILE_RESPONSE_HEADERS);
    return this.profile.update(validated.value);
  }
}
