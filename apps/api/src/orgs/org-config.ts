// F-002 · T-002-15 — the two env-derived values `orgs/` depends on, resolved
// ONCE at boot (architecture §6.2/§6.3/§6.4).
//
// WHY TOKENS AND NOT `loadEnv()` INSIDE THE SERVICE
//   1. `loadEnv` validates the WHOLE application env and `process.exit(1)`s when
//      anything is wrong. That belongs at boot (`main.ts` already does it), not
//      on the hot path of a request: a service that can take the process down
//      mid-request is a service nobody can unit-test either.
//   2. Reading env at construction makes the value explicit in the DI graph —
//      one place to look for "where does the cap come from", and one place a
//      test overrides.
//
// The values are still FAIL-CLOSED where it matters: `DEFAULT_ORG_PLAN_KEY` is
// `required` in the zod schema (§6.4), so the process does not boot without it,
// and `MAX_ORGS_PER_USER` defaults to 50 there rather than here — a default that
// lived in two places would drift.
import { loadEnv } from "@omnistock/config";
import type { Provider } from "@nestjs/common";

/** `PlanDefinition.key` a brand-new org is bound to (architecture §6.2). */
export const DEFAULT_ORG_PLAN_KEY = Symbol("DEFAULT_ORG_PLAN_KEY");

/** Maximum ACTIVE memberships one user may hold (architecture §6.3). */
export const MAX_ORGS_PER_USER = Symbol("MAX_ORGS_PER_USER");

/**
 * Cap on invitations that are pending AND still live (architecture §10, M-3).
 *
 * Counting EXPIRED pending rows too would let a shop lock itself out of
 * inviting anybody simply by leaving old links to rot — a self-inflicted denial
 * of service with no security benefit. The bound exists so the table cannot
 * grow without limit, not to ration invitations.
 */
export const INVITATION_PENDING_CAP = Symbol("INVITATION_PENDING_CAP");

/** Base URL the invite link is built on (architecture §7, `WEB_APP_BASE_URL`). */
export const WEB_APP_BASE_URL = Symbol("WEB_APP_BASE_URL");

/**
 * F-003 §12 — `ROLE_WRITES_ENABLED` as a boolean, resolved once at boot. Read
 * routes report `writes_disabled` from it (api-spec §3); the write guard (B23)
 * consumes the same token, so a verdict and a 503 cannot disagree.
 */
export const ROLE_WRITES_ENABLED = Symbol("ROLE_WRITES_ENABLED");

/** F-003 §10 — `{ maxRolesPerOrg, maxDeletedRolesPerOrg }` (packages/config). */
export const ROLE_CAPACITY_LIMITS = Symbol("ROLE_CAPACITY_LIMITS");

export interface RoleCapacityLimits {
  readonly maxRolesPerOrg: number;
  readonly maxDeletedRolesPerOrg: number;
}

/** api-spec §10 — the documented ceiling; env-tunable would be a policy change. */
export const INVITATION_PENDING_CAP_DEFAULT = 100;

export const orgConfigProviders: readonly Provider[] = Object.freeze([
  {
    provide: DEFAULT_ORG_PLAN_KEY,
    useFactory: (): string => loadEnv(process.env).DEFAULT_ORG_PLAN_KEY,
  },
  {
    provide: INVITATION_PENDING_CAP,
    useFactory: (): number => INVITATION_PENDING_CAP_DEFAULT,
  },
  {
    provide: WEB_APP_BASE_URL,
    // Validated at boot (url + https outside test), so by the time a request
    // reaches here the value is known-good and the read is just a lookup.
    useFactory: (): string => loadEnv(process.env).WEB_APP_BASE_URL,
  },
  {
    provide: MAX_ORGS_PER_USER,
    // `positiveIntEnv` keeps env values as strings (they are validated as digits
    // with a bound); the numeric conversion happens here, once.
    useFactory: (): number => Number(loadEnv(process.env).MAX_ORGS_PER_USER),
  },
  {
    provide: ROLE_WRITES_ENABLED,
    // Already a boolean (exact "true" only — `parseRoleWritesEnabled`).
    useFactory: (): boolean => loadEnv(process.env).ROLE_WRITES_ENABLED,
  },
  {
    provide: ROLE_CAPACITY_LIMITS,
    useFactory: (): RoleCapacityLimits => {
      const env = loadEnv(process.env);
      return Object.freeze({
        maxRolesPerOrg: Number(env.MAX_ROLES_PER_ORG),
        maxDeletedRolesPerOrg: Number(env.MAX_DELETED_ROLES_PER_ORG),
      });
    },
  },
]);
