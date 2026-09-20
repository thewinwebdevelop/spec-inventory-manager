// F-002 org-policy constants — the SINGLE source of the default values that
// architecture.md pins in prose. Spec: docs/features/F-002/architecture.md
// §5.2 (tx/lock timeout policy) · §8 (rate limit / abuse control) · §15 row 8.
//
// Why constants live HERE and not in the guard/lock helper:
//   - qa Q11 splits the two concerns explicitly — **policy is pinned at config,
//     behaviour reads from config**. Tests that assert behaviour (rate limiting,
//     lock timeout mapping) set a low quota via env and READ the effective value
//     from `@omnistock/config`; they must never hardcode 10/3000/5000. The
//     numbers below are asserted literally by exactly one test (U-CFG-06/07), so
//     lowering a quota or stretching a timeout silently turns CI red and someone
//     has to explain it in the PR.
//   - `packages/db`'s org-lock helper and `apps/api`'s org-rate-limit guard both
//     import from here, so the two never drift apart.
//
// These are DEFAULTS. The effective values are env-tunable — see
// `ORG_TX_TIMEOUTS` / `ORG_RATE_LIMITS` in ./env.ts.

/** Transaction/lock timing policy for every write that grabs the org row lock. */
export interface OrgTxTimeouts {
  /** Postgres `SET LOCAL lock_timeout` inside `lockCurrentOrganization`. */
  readonly lockTimeoutMs: number;
  /** Prisma interactive-transaction `timeout` (max lifetime of the tx). */
  readonly txTimeoutMs: number;
  /** Prisma `maxWait` — how long a request may queue for a pool connection. */
  readonly maxWaitMs: number;
}

/**
 * architecture.md §5.2. `lockTimeoutMs` MUST stay strictly below `txTimeoutMs`:
 * a lock wait that outlives the transaction surfaces as an ambiguous `P2028`
 * instead of the mappable `55P03`, which is the whole technical reason §5.2
 * exists. env.ts enforces that invariant at boot (fail-closed, not a warning).
 */
export const ORG_TX_TIMEOUT_DEFAULTS: OrgTxTimeouts = Object.freeze({
  lockTimeoutMs: 3_000,
  txTimeoutMs: 5_000,
  maxWaitMs: 2_000,
});

/** Which dimension a rate-limit bucket is keyed by (architecture.md §8). */
export type OrgRateLimitKeyDimension =
  | "userId"
  | "organizationId"
  | "ip"
  | "userId+organizationId";

export interface OrgRateLimitRule {
  /** Allowed requests per window. */
  readonly limit: number;
  /** Window length in seconds (all §8 rows are hourly). */
  readonly windowSec: number;
  /** Bucket key dimension — `ip` means IPv6 collapsed to /64 (N-3). */
  readonly key: OrgRateLimitKeyDimension;
}

/** The rate-limited actions F-002 introduces (architecture.md §8 table rows). */
export type OrgRateLimitAction =
  | "createOrganization"
  | "createInvitation"
  | "reissueInvitationLink"
  | "publicInvitationEntry"
  | "revealTaxProfile";

export type OrgRateLimits = Readonly<Record<OrgRateLimitAction, OrgRateLimitRule>>;

const HOUR_SEC = 3_600;

/**
 * architecture.md §8, row for row:
 *
 * | action                                          | key                  | quota   |
 * |-------------------------------------------------|----------------------|---------|
 * | `POST /organizations`                           | userId               | 10 / hr |
 * | `POST /orgs/{id}/invitations`                   | organizationId       | 30 / hr |
 * | `POST …/invitations/{id}/link`                  | organizationId       | 60 / hr |
 * | `POST /invitations/preview` + `…/accept`        | ip (IPv6 → /64)      | 30 / hr |
 * | `POST …/tax-profile/reveal`                     | userId+organizationId| 20 / hr |
 *
 * Window length is fixed at one hour (not env-tunable) — behaviour tests lower
 * the *limit*, not the window.
 */
export const ORG_RATE_LIMIT_DEFAULTS: OrgRateLimits = Object.freeze({
  createOrganization: Object.freeze({ limit: 10, windowSec: HOUR_SEC, key: "userId" as const }),
  createInvitation: Object.freeze({ limit: 30, windowSec: HOUR_SEC, key: "organizationId" as const }),
  reissueInvitationLink: Object.freeze({
    limit: 60,
    windowSec: HOUR_SEC,
    key: "organizationId" as const,
  }),
  publicInvitationEntry: Object.freeze({ limit: 30, windowSec: HOUR_SEC, key: "ip" as const }),
  revealTaxProfile: Object.freeze({
    limit: 20,
    windowSec: HOUR_SEC,
    key: "userId+organizationId" as const,
  }),
});

/** env var that overrides each action's `limit` (see ./env.ts). */
export const ORG_RATE_LIMIT_ENV_VARS: Readonly<Record<OrgRateLimitAction, string>> = Object.freeze({
  createOrganization: "ORG_RATE_LIMIT_CREATE_ORG_PER_HOUR",
  createInvitation: "ORG_RATE_LIMIT_INVITE_CREATE_PER_HOUR",
  reissueInvitationLink: "ORG_RATE_LIMIT_INVITE_LINK_PER_HOUR",
  publicInvitationEntry: "ORG_RATE_LIMIT_INVITE_PUBLIC_PER_HOUR",
  revealTaxProfile: "ORG_RATE_LIMIT_TAX_REVEAL_PER_HOUR",
});

/** Default cap on how many active orgs one user may belong to (§6.3, D-029). */
export const MAX_ORGS_PER_USER_DEFAULT = 50;
