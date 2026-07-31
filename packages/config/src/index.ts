// Entry point for @omnistock/config.
// Re-exports the zod env schema (packages/config/src/env.ts, T-000-02/AC14) so
// consumers whose TS `moduleResolution` doesn't follow package.json `exports`
// subpaths (e.g. apps/api's default "node" resolution) can still import
// `loadEnv`/`Env` from the package root instead of the `./env` subpath.
// `@omnistock/config/env` remains valid wherever subpath exports resolve
// (e.g. tsx-run scripts) — this barrel is an additive, equivalent path.
export { envSchema, loadEnv } from "./env";
export type { Env } from "./env";
// F-002 policy surface (architecture.md §5.2/§8/§15 row 8): the pinned defaults
// plus the env-tunable effective values. `packages/db`'s org-lock helper and
// apps/api's org rate-limit guard read these instead of hardcoding numbers.
export {
  ORG_RATE_LIMITS,
  ORG_TX_TIMEOUTS,
  orgRateLimitsSchema,
  orgTxTimeoutsSchema,
  resolveOrgRateLimits,
  resolveOrgTxTimeouts,
} from "./env";
export {
  MAX_ORGS_PER_USER_DEFAULT,
  ORG_RATE_LIMIT_DEFAULTS,
  ORG_RATE_LIMIT_ENV_VARS,
  ORG_TX_TIMEOUT_DEFAULTS,
} from "./org-policy";
export type {
  OrgRateLimitAction,
  OrgRateLimitKeyDimension,
  OrgRateLimitRule,
  OrgRateLimits,
  OrgTxTimeouts,
} from "./org-policy";
