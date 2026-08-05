// F-002 · T-002-15/16 — request bodies for the org endpoints.
//
// ⚠️ THESE DTOs VALIDATE ALMOST NOTHING, ON PURPOSE.
//
// The global `ValidationPipe` turns the FIRST failing constraint's message into
// the wire `error.code` (see `main.ts`). That is the shape F-001 shipped and it
// works there because auth's codes ARE constraint messages (`EMAIL_INVALID`).
// api-spec §3.1/§3.4 asks for something different: `422 VALIDATION_FAILED` with
// a `fieldErrors` map naming every bad field at once. Class-validator cannot
// produce that shape, so every rule lives in the core-domain validators
// (`validateNewOrganization`, `validateOrgProfilePatch`) and the DTO's only job
// is to let the raw value through.
//
// `@Allow()` is required rather than optional: the pipe runs with
// `whitelist: true`, which DELETES every property that carries no decorator. A
// bare `name?: string` would arrive as `undefined` and the endpoint would answer
// "name is required" for a request that contained one.
import { Allow } from "class-validator";

/** `POST /organizations` (api-spec §3.1). */
export class CreateOrganizationDto {
  @Allow()
  name?: unknown;

  /** Optional; defaults to Asia/Bangkok. Validated against the IANA whitelist. */
  @Allow()
  timezone?: unknown;

  // ⛔ There is deliberately NO `planKey`, `currency` or `id` field. The plan is
  // resolved server-side from the env seam (architecture §6.2) and the currency
  // is fixed by D-013; accepting either would let a caller grant itself a tier.
}

/** `PATCH /orgs/{orgId}` (api-spec §3.4). */
export class UpdateOrganizationDto {
  @Allow()
  name?: unknown;

  /** Phase 0: `null` is the ONLY accepted value (M-4). */
  @Allow()
  logo?: unknown;

  @Allow()
  timezone?: unknown;
}

/**
 * `PUT /orgs/{orgId}/tax-profile` (api-spec §3.5).
 *
 * All four values arrive as `unknown` for the reason at the top of this file,
 * and one more that matters here: the all-or-nothing rule (data-model §3.3) is
 * a rule ABOUT THE COMBINATION of fields. `@IsOptional() @IsString()` per field
 * cannot express "these three arrive together or not at all", so splitting the
 * check between decorators and `validateTaxProfilePut` would leave half the rule
 * in a place the next reader does not look.
 *
 * ⚠️ `taxId` must never be logged — not by an interceptor, not by a validation
 * error message. That is why no class-validator constraint touches it: a failed
 * constraint's message is what the global pipe puts on the wire.
 */
export class PutTaxProfileDto {
  @Allow()
  entityType?: unknown;

  @Allow()
  taxId?: unknown;

  @Allow()
  vatRegistered?: unknown;

  @Allow()
  branchCode?: unknown;
}
