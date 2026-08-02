// F-002 · T-002-14 — `@OrgRateLimit(action)`, the marker the central guard reads.
//
// Metadata-only (SetMetadata), same shape as the tenancy/authz decorators: all
// behaviour lives in `OrgRateLimitGuard`, so a decorator can never be "half
// applied".
//
// ⚠️ UNLIKE the authz decorators, an undeclared route is NOT refused here. Rate
// limiting is abuse control, not authorization (architecture §8): the endpoints
// that need it name themselves, and everything else is simply unlimited. A
// fail-closed default would turn a Redis hiccup or a missing annotation into an
// outage on routes that never needed the protection — and authorization is
// already enforced fail-closed one layer up, by OrgScopeGuard + CapabilityGuard.
import { SetMetadata, type CustomDecorator } from "@nestjs/common";
import type { OrgRateLimitAction } from "@omnistock/config";

/** Reflector key carrying the rate-limit action. */
export const ORG_RATE_LIMIT_KEY = "omnistock:org-rate-limit";

/**
 * Apply the quota `action` (defined once in `@omnistock/config`,
 * `ORG_RATE_LIMIT_DEFAULTS`) to this route.
 *
 * The action — not the numbers — is what a route declares. Quotas are policy
 * and live in config where `U-CFG-06` compares them against architecture §8;
 * a handler that hard-coded "30 per hour" would put the policy in two places
 * and let them drift apart silently.
 */
export const OrgRateLimit = (action: OrgRateLimitAction): CustomDecorator<string> =>
  SetMetadata(ORG_RATE_LIMIT_KEY, action);
