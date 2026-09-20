// F-002 · T-002-17 ★ — `PUT /orgs/{orgId}/tax-profile` +
// `POST /orgs/{orgId}/tax-profile/reveal` (api-spec §3.5 / §3.16).
//
// TIER: org-scoped — declared by saying NOTHING (§1.1 default-deny). Both
// handlers declare `@RequireCapability(manage_org_settings)` and both have a
// matching row in `ROUTE_CAPABILITIES`.
//
// WHY REVEAL IS ITS OWN ENDPOINT, A `POST`, AND STILL ONLY `manage_org_settings`
// (D-030 / NEW-11 — user-approved):
//   * `manage_org_settings` is in Admin's set, so an Admin can see the owner's
//     national ID. That was argued and decided: the person who files the shop's
//     tax documents has to be able to read the number. It is fenced by CONTROLS
//     rather than by hiding it from the people who need it —
//       (a) a deliberate action, never a side effect of opening the shop page;
//       (b) `org.tax_profile.revealed` on every success (no TIN in the event);
//       (c) 20/hour per (userId, organizationId);
//       (d) `no-store` + `no-referrer`;
//       (e) `TAX_ID_RESPONSE_ALLOWLIST` = this route and nothing else.
//   * `POST`, not `GET`: a GET would put the request in browser history, in
//     proxy access logs and in the `Referer` header of the next outbound link.
//     None of those are places a national ID lookup should be recorded.
//
// The handlers never read `:orgId` — the org comes from the ALS context the
// guard chain already tied to a proven active membership.
import { Body, Controller, HttpCode, HttpStatus, Inject, Post, Put, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import {
  CAPABILITY_MANAGE_ORG_SETTINGS,
  validateTaxProfilePut,
  type OrgProfileView,
  type RevealedTaxProfile,
} from "@omnistock/core-domain";
import { domainError } from "../common";
import { RequireCapability } from "../common/authz";
import { OrgRateLimit } from "../common/org-rate-limit.decorator";
import { JsonOnlyGuard } from "../auth";
import { PutTaxProfileDto } from "./dto";
import { TaxProfileService } from "./tax-profile.service";
import {
  ORG_PROFILE_RESPONSE_HEADERS,
  TAX_ID_REVEAL_RESPONSE_HEADERS,
  applyResponseHeaders,
} from "./response-headers";

@Controller("orgs/:orgId/tax-profile")
export class TaxProfileController {
  constructor(@Inject(TaxProfileService) private readonly taxProfile: TaxProfileService) {}

  /**
   * api-spec §3.5 — declare (or clear) the shop's legal identity. Complete set
   * or empty set; there is no half-declared state (data-model §3.3).
   *
   * Errors: `422 TAX_ID_INVALID` (+ `fieldErrors.taxId`) · `422
   * VALIDATION_FAILED` (+ `fieldErrors`) · `403 FORBIDDEN` · `415`.
   *
   * The response is the ordinary §3.3 profile body: `taxIdMasked` at most, never
   * the number that was just sent.
   */
  @RequireCapability(CAPABILITY_MANAGE_ORG_SETTINGS)
  @Put()
  @UseGuards(JsonOnlyGuard)
  async put(
    @Body() dto: PutTaxProfileDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OrgProfileView> {
    const validated = validateTaxProfilePut(dto);
    if (!validated.ok) {
      // The pure fn decided WHICH code (api-spec §4): `TAX_ID_INVALID` when the
      // number itself is wrong, `VALIDATION_FAILED` for everything else. The
      // message never contains the value.
      throw domainError(validated.code, { fieldErrors: validated.fieldErrors });
    }
    applyResponseHeaders(res, ORG_PROFILE_RESPONSE_HEADERS);
    return this.taxProfile.set(validated.value);
  }

  /**
   * api-spec §3.16 — hand over the full TIN, on purpose and on the record.
   *
   * `200` (not `201`): nothing was created. The body is
   * `{ taxId, entityType?, revealedAt }` and this is the ONLY response in the
   * system that carries a full tax id.
   *
   * Errors: `403 FORBIDDEN` · `404 NOT_FOUND` (nothing declared) ·
   * `429 RATE_LIMITED` · `403 ORG_ACCESS_DENIED` (not a member) · `415`.
   */
  @RequireCapability(CAPABILITY_MANAGE_ORG_SETTINGS)
  // 20/hour per (userId, organizationId) — the quota itself lives in
  // `@omnistock/config` (architecture §8), never inline here. This is what makes
  // "a session somebody stole cannot be used to harvest the number" true; the
  // capability check alone would let one compromised Admin token read it in a
  // loop.
  @OrgRateLimit("revealTaxProfile")
  @Post("reveal")
  @UseGuards(JsonOnlyGuard)
  @HttpCode(HttpStatus.OK)
  async reveal(@Res({ passthrough: true }) res: Response): Promise<RevealedTaxProfile> {
    // Set BEFORE the value is fetched: a response that carries the number must
    // never be able to leave without these, not even on a path added later that
    // returns early.
    applyResponseHeaders(res, TAX_ID_REVEAL_RESPONSE_HEADERS);
    // `now` is produced here, at the edge — the service and the pure mapper both
    // take it as an argument (golden rule #6).
    return this.taxProfile.reveal(new Date());
  }
}
