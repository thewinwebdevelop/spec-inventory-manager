// F-002 · T-002-15 ★ — `POST /organizations` (api-spec §3.1, US-1).
//
// TIER: `@UserScoped()`. There is no org context on this request and there must
// not be one (I-3) — the shop does not exist yet, so any `X-Organization-Id` the
// caller sent is, by definition, about a different shop. `OrgScopeGuard` still
// demands a valid access token for this tier; `CapabilityGuard` returns early
// because a declared non-org tier has no capabilities to evaluate.
//
// ⛔ ON THE HANDLER, NOT THE CLASS (security review of f66451f, High-1). A tier
// declared at class level is INHERITED by every handler added later, and the
// inherited tier is the permissive one. On the handler, a new sibling defaults
// to org-scoped and fails closed.
//
// The identity comes from `req.orgAuth.userId`, which `OrgContextMiddleware`
// filled from the verified bearer token — NOT from `req.user`, which is set by
// the controller-level `JwtAuthGuard` and therefore exists only where that guard
// is applied (I-4). One source of "who is calling", set before any guard runs.
import { Body, Controller, HttpCode, HttpStatus, Inject, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { ORG_PROFILE_RESPONSE_HEADERS, applyResponseHeaders } from "./response-headers";
import { validateNewOrganization } from "@omnistock/core-domain";
import { domainError } from "../common";
import { OrgRateLimit } from "../common/org-rate-limit.decorator";
import { JsonOnlyGuard } from "../auth";
import { UserScoped, type OrgAuthRequest } from "../tenancy";
import { CreateOrganizationDto } from "./dto";
import { OrgProvisioningService, type CreatedOrganization } from "./system/org-provisioning.service";

@Controller("organizations")
export class OrganizationsController {
  // Explicit `@Inject` even though a controller is only constructed from the
  // compiled `dist/` build today: the rule "every injected parameter names its
  // token" costs nothing and removes a whole class of dev-only DI failure
  // (`tsx` emits no `design:paramtypes`).
  constructor(
    @Inject(OrgProvisioningService) private readonly provisioning: OrgProvisioningService,
  ) {}

  /**
   * Create a shop. `201` carries everything the client needs to enter it
   * immediately (ux Q5): the org, the creator's membership + role, the
   * entitlement and the default warehouse.
   *
   * Errors: `422 VALIDATION_FAILED` (+`fieldErrors`) · `409 ORG_LIMIT_REACHED`
   * (+`details.limit`) · `503 ORG_PROVISIONING_UNAVAILABLE` · `429 RATE_LIMITED`.
   */
  @UserScoped()
  // Abuse control only (10/hour/user). It is NOT what holds the 50-shop cap —
  // this layer fails OPEN when Redis is down, which is precisely why finding
  // I-10 moved the cap into the service as a fail-closed check.
  @OrgRateLimit("createOrganization")
  @Post()
  @UseGuards(JsonOnlyGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateOrganizationDto,
    @Req() req: OrgAuthRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CreatedOrganization> {
    // ★ B-3 — the 201 body names the shop, the caller's membership and the
    // plan bound to it. That is a fact about a person, whatever the status
    // code says.
    applyResponseHeaders(res, ORG_PROFILE_RESPONSE_HEADERS);
    const userId = req.orgAuth?.userId;
    if (!userId) {
      // Unreachable: `@UserScoped()` + `OrgScopeGuard` already answered 401 for
      // an invalid token. Reaching here means the chain is mis-wired — fail loud
      // rather than create a shop with no owner.
      throw domainError("INTERNAL");
    }

    const validated = validateNewOrganization(dto);
    if (!validated.ok) {
      throw domainError("VALIDATION_FAILED", { fieldErrors: validated.fieldErrors });
    }

    return this.provisioning.create({ userId, organization: validated.value });
  }
}
