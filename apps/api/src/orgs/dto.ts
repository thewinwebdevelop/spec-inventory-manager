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
 * `PATCH /orgs/{orgId}/members/{userId}` (api-spec §3.8).
 *
 * `roleId` arrives as `unknown` for the reason at the top of this file, plus one
 * that is specific to it: whether the id is acceptable is not a STRING question
 * but a TENANCY one — "is this a role of THIS shop?" — and only a query through
 * `ORG_PRISMA` can answer it (`422 ROLE_INVALID`). A class-validator constraint
 * here could only ever check the shape, and having half the rule in a decorator
 * is how the other half stops being read.
 */
export class UpdateMemberRoleDto {
  @Allow()
  roleId?: unknown;

  // ⛔ Deliberately NO `status` field. "Remove this member" is
  // `DELETE …/members/{userId}`, an endpoint with its own capability row, its
  // own Owner-only rule and its own event. A `status: "revoked"` accepted here
  // would be a second, undeclared revoke path.
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

/**
 * `POST /orgs/{orgId}/invitations` (api-spec §3.11).
 *
 * `unknown` for the same reason as every DTO in this file: a class-validator
 * constraint's MESSAGE is what the global pipe puts in `error.code`, so a
 * failed `@IsEmail()` would ship a human sentence where the client expects a
 * machine code. Shape is checked in the handler and the rules live in
 * core-domain, which keeps `422 VALIDATION_FAILED` + `fieldErrors` uniform.
 */
export class CreateInvitationDto {
  @Allow()
  email?: unknown;

  @Allow()
  roleId?: unknown;

  // ⛔ Deliberately NO `expiresAt` / `ttl`. The lifetime is decided by the
  // ROLE being invited (24h elevated / 7 days otherwise, D-028/I-7). A
  // caller-supplied expiry would let somebody mint a year-long Owner link.
}

/**
 * `POST /invitations/preview` and `POST /invitations/accept` (api-spec
 * §3.14/§3.15) — T-002-20.
 *
 * ⛔ THE TOKEN ARRIVES IN THE BODY, AND ONLY IN THE BODY (I-6). Neither handler
 * reads a query parameter, which is why both routes are POSTs at all: a token
 * in a query string is written to the access log, to every proxy in front of
 * us, and to the `Referer` header of anything the invite page loads from
 * another origin. It is the single secret standing between a stranger and
 * membership of a shop, and in Phase 0 there is no email verification behind it
 * (architecture §7.6) — whoever holds it can redeem it.
 *
 * ⛔ And no other field. `organizationId`, `roleId` or `email` accepted here
 * would be a caller-chosen value on a route with no org context (I-3); every
 * one of those facts comes from the invitation ROW instead.
 */
export class RedeemInvitationDto {
  @Allow()
  token?: unknown;
}
