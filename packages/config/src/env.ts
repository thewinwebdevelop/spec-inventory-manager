// Environment variable validation (F-000 · T-000-02 · AC14).
// Spec: docs/features/F-000/infra.md §8.1/§8.2.
//
// This module owns the SHAPE of process.env that apps/api needs to boot.
// The list of required vars mirrors .env.example at the repo root exactly —
// as backend-api's features land, both files grow together.
//
// Consumers call `loadEnv(process.env)` (or `envSchema.parse(...)` directly)
// as the very first thing at boot, before any framework bootstrap. On
// failure this module prints the offending variable name(s) to stderr and
// exits the process non-zero — it does not throw past the caller, so a
// missing var can never surface as an unhandled framework stack trace.
import { z } from "zod";
import {
  MAX_ORGS_PER_USER_DEFAULT,
  ORG_RATE_LIMIT_DEFAULTS,
  ORG_TX_TIMEOUT_DEFAULTS,
  type OrgRateLimits,
  type OrgTxTimeouts,
} from "./org-policy";

/**
 * A numeric env var that must be a positive integer (≥ 1). `"0"`, `"-1"`,
 * `"1.5"` and any non-digit input fail at boot — a zero quota/timeout is never
 * an intended configuration, it is a typo that would silently disable the knob.
 */
/**
 * Upper bound on every positive-integer env var.
 *
 * Digits-only already made these safe to interpolate into SQL, but a 22-digit
 * value passes that check and then stringifies as `1e+21` — which would reach
 * Postgres as `SET LOCAL lock_timeout = '1e+21ms'` and fail at REQUEST time
 * with a 500, long after boot (security review of f66451f, Low). Bounding it
 * here turns that into a startup failure with a named variable. `Number.
 * MAX_SAFE_INTEGER` is where the exponent notation starts to matter; the real
 * ceiling is well below it for every current use (timeouts in ms, hourly
 * quotas), so this is a guard against typos, not a policy limit.
 */
const POSITIVE_INT_ENV_MAX = 1_000_000_000;

function positiveIntEnv(name: string, defaultValue: number) {
  return z
    .string()
    .regex(/^\d+$/, `${name} must be a positive integer (digits only)`)
    .refine((v) => Number(v) >= 1, `${name} must be at least 1`)
    .refine(
      (v) => Number(v) <= POSITIVE_INT_ENV_MAX,
      `${name} must be at most ${POSITIVE_INT_ENV_MAX}`,
    )
    .default(String(defaultValue));
}

// --- F-002 §5.2 · tx/lock timeout policy -------------------------------------
// Shared shape so `envSchema` (boot validation) and `orgTxTimeoutsSchema`
// (the resolver `packages/db`'s org-lock helper reads) can never drift.
const orgTxTimeoutShape = {
  ORG_LOCK_TIMEOUT_MS: positiveIntEnv("ORG_LOCK_TIMEOUT_MS", ORG_TX_TIMEOUT_DEFAULTS.lockTimeoutMs),
  ORG_TX_TIMEOUT_MS: positiveIntEnv("ORG_TX_TIMEOUT_MS", ORG_TX_TIMEOUT_DEFAULTS.txTimeoutMs),
  ORG_TX_MAX_WAIT_MS: positiveIntEnv("ORG_TX_MAX_WAIT_MS", ORG_TX_TIMEOUT_DEFAULTS.maxWaitMs),
};

function refineOrgTxTimeouts(
  value: { ORG_LOCK_TIMEOUT_MS: string; ORG_TX_TIMEOUT_MS: string },
  ctx: z.RefinementCtx,
): void {
  if (Number(value.ORG_LOCK_TIMEOUT_MS) >= Number(value.ORG_TX_TIMEOUT_MS)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ORG_LOCK_TIMEOUT_MS"],
      message:
        "ORG_LOCK_TIMEOUT_MS must be strictly less than ORG_TX_TIMEOUT_MS (F-002 architecture.md §5.2) — " +
        "a lock wait that outlives the transaction surfaces as an ambiguous P2028 instead of the mappable 55P03, " +
        "so the 409 CONFLICT/busy mapping would silently degrade to 500",
    });
  }
}

// --- F-002 §8 · rate limit quotas (defaults come from ORG_RATE_LIMIT_DEFAULTS) -
const orgRateLimitShape = {
  ORG_RATE_LIMIT_CREATE_ORG_PER_HOUR: positiveIntEnv(
    "ORG_RATE_LIMIT_CREATE_ORG_PER_HOUR",
    ORG_RATE_LIMIT_DEFAULTS.createOrganization.limit,
  ),
  ORG_RATE_LIMIT_INVITE_CREATE_PER_HOUR: positiveIntEnv(
    "ORG_RATE_LIMIT_INVITE_CREATE_PER_HOUR",
    ORG_RATE_LIMIT_DEFAULTS.createInvitation.limit,
  ),
  ORG_RATE_LIMIT_INVITE_LINK_PER_HOUR: positiveIntEnv(
    "ORG_RATE_LIMIT_INVITE_LINK_PER_HOUR",
    ORG_RATE_LIMIT_DEFAULTS.reissueInvitationLink.limit,
  ),
  ORG_RATE_LIMIT_INVITE_PUBLIC_PER_HOUR: positiveIntEnv(
    "ORG_RATE_LIMIT_INVITE_PUBLIC_PER_HOUR",
    ORG_RATE_LIMIT_DEFAULTS.publicInvitationEntry.limit,
  ),
  ORG_RATE_LIMIT_TAX_REVEAL_PER_HOUR: positiveIntEnv(
    "ORG_RATE_LIMIT_TAX_REVEAL_PER_HOUR",
    ORG_RATE_LIMIT_DEFAULTS.revealTaxProfile.limit,
  ),
};

/** `http://` is only tolerated on loopback outside production (local dev/test). */
function isAcceptableWebAppBaseUrl(raw: string, nodeEnv: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol === "https:") return true;
  if (url.protocol !== "http:") return false;
  if (nodeEnv === "production") return false;
  return ["localhost", "127.0.0.1", "[::1]", "::1"].includes(url.hostname);
}

export const envSchema = z
  .object({
    DATABASE_URL: z
      .string({ required_error: "DATABASE_URL is required" })
      .min(1, "DATABASE_URL is required")
      .url("DATABASE_URL must be a valid connection string URL"),
    REDIS_URL: z
      .string({ required_error: "REDIS_URL is required" })
      .min(1, "REDIS_URL is required")
      .url("REDIS_URL must be a valid connection string URL"),
    JWT_ACCESS_SECRET: z
      .string({ required_error: "JWT_ACCESS_SECRET is required" })
      .min(32, "JWT_ACCESS_SECRET must be at least 32 chars (256-bit random) — F-001 I-4"),
    JWT_REFRESH_SECRET: z
      .string({ required_error: "JWT_REFRESH_SECRET is required" })
      .min(32, "JWT_REFRESH_SECRET must be at least 32 chars (256-bit random) — F-001 I-4"),
    PORT: z
      .string({ required_error: "PORT is required" })
      .min(1, "PORT is required")
      .regex(/^\d+$/, "PORT must be numeric"),
    NODE_ENV: z.enum(["development", "test", "production"], {
      required_error: "NODE_ENV is required",
      invalid_type_error: "NODE_ENV must be one of development|test|production",
    }),
    // --- Trusted-proxy hop count (F-001 security review · T-001-06/12) --------
    // How many X-Forwarded-For hops to trust, counting from the right (Express
    // `trust proxy` numeric semantics). Defaults to "0" — trust NO hop, so
    // req.ip is the socket peer and a client can NEVER spoof X-Forwarded-For to
    // forge req.ip and bypass the IP throttle (arch §8.1/§8.3). Prod behind one
    // reverse proxy sets "1"; raise only for a real longer known chain. Garbage
    // (non-integer/negative) fails fast at boot.
    TRUST_PROXY_HOPS: z
      .string()
      .regex(/^\d+$/, "TRUST_PROXY_HOPS must be a non-negative integer")
      .default("0"),
    // --- CORS allow-list (F-001 T-001-11) ------------------------------------
    // Comma-separated browser origins the API may set Access-Control-Allow-
    // Origin + Allow-Credentials:true for. Parsed to a string[] (blank entries
    // dropped). main.ts passes THIS EXPLICIT LIST to enableCors — never `*`/
    // `true` with credentials, which would break the login-CSRF "preflight the
    // API won't allow" property (api-spec §0). Default "" = no cross-origin
    // allowed (same-origin dev proxy path, apps/web rewrites).
    CORS_ALLOWED_ORIGINS: z
      .string()
      .default("")
      .transform((raw) =>
        raw
          .split(",")
          .map((o) => o.trim())
          .filter((o) => o.length > 0),
      ),
    // --- F-002 (org/license/membership) · architecture.md §6.4 ---------------
    // HMAC key for `Invitation.tokenHash` (§7.3). Separate key from auth on
    // purpose: sharing the JWT secret would make a leak on either side spread
    // to the other instantly. Rotating this INVALIDATES every pending
    // invitation silently (hashes are one-way) — see §6.4 for the drill.
    INVITATION_TOKEN_SECRET: z
      .string({ required_error: "INVITATION_TOKEN_SECRET is required" })
      .min(
        32,
        "INVITATION_TOKEN_SECRET must be at least 32 chars (256-bit random) — F-002 §7.3",
      ),
    // Base origin the API prefixes onto `inviteUrl` (`${base}/invite?token=…`).
    // Must be https so the invitation token never travels in clear text; local
    // dev/test may use http on loopback only.
    WEB_APP_BASE_URL: z
      .string({ required_error: "WEB_APP_BASE_URL is required" })
      .min(1, "WEB_APP_BASE_URL is required")
      .url("WEB_APP_BASE_URL must be a valid absolute URL (e.g. https://app.example.com)"),
    // Plan key `PlanProvisioningService.resolveForNewOrg()` looks up in
    // PlanDefinition. REQUIRED, no default, no silent fallback: an unset value
    // must make `POST /organizations` fail closed (503
    // ORG_PROVISIONING_UNAVAILABLE), never hand out a free plan (§6.2, AC US-1).
    DEFAULT_ORG_PLAN_KEY: z
      .string({ required_error: "DEFAULT_ORG_PLAN_KEY is required" })
      .min(
        1,
        "DEFAULT_ORG_PLAN_KEY is required — F-002 §6.2 forbids falling back to a free plan; an unset value must stop the boot, not provision the wrong tier",
      ),
    // Cap on active orgs per user, enforced fail-closed in the service (§6.3).
    MAX_ORGS_PER_USER: positiveIntEnv("MAX_ORGS_PER_USER", MAX_ORGS_PER_USER_DEFAULT),
    ...orgTxTimeoutShape,
    ...orgRateLimitShape,
  })
  .superRefine((env, ctx) => {
    if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["JWT_REFRESH_SECRET"],
        message:
          "JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ (F-001 I-4) — using the same value for both defeats the separate-scope guarantee (architecture.md §9)",
      });
    }

    // Key separation (F-002 §7.3): the invitation HMAC key must not be reused
    // from either auth secret.
    if (
      env.INVITATION_TOKEN_SECRET === env.JWT_ACCESS_SECRET ||
      env.INVITATION_TOKEN_SECRET === env.JWT_REFRESH_SECRET
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["INVITATION_TOKEN_SECRET"],
        message:
          "INVITATION_TOKEN_SECRET must differ from both JWT_ACCESS_SECRET and JWT_REFRESH_SECRET (F-002 §6.4/§7.3) — reusing an auth secret means a leak on either side compromises the other",
      });
    }

    if (!isAcceptableWebAppBaseUrl(env.WEB_APP_BASE_URL, env.NODE_ENV)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["WEB_APP_BASE_URL"],
        message:
          "WEB_APP_BASE_URL must use https:// (F-002 §6.4) — plain http is accepted only on localhost/127.0.0.1 outside production, because this origin carries the invitation token",
      });
    }

    refineOrgTxTimeouts(env, ctx);
  });

export type Env = z.infer<typeof envSchema>;

/**
 * Parses & validates `source` (normally `process.env`) against `envSchema`.
 * Returns the typed, validated env on success; never returns on failure —
 * prints every offending variable name + reason to stderr and calls
 * `process.exit(1)`.
 *
 * This is the seam every app boot (apps/api's main.ts, T-000-08) calls
 * before `NestFactory.create(...)`.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const offending = result.error.issues.map((issue) => {
      const varName = issue.path.join(".") || "(unknown)";
      return `${varName}: ${issue.message}`;
    });

    // eslint-disable-next-line no-console
    console.error("Invalid environment variables:");
    for (const line of offending) {
      // eslint-disable-next-line no-console
      console.error(`  - ${line}`);
    }

    process.exit(1);
  }

  return result.data;
}

// -----------------------------------------------------------------------------
// F-002 · effective (env-tunable) policy values
//
// qa Q11 / test-plan U-CFG-06/07: **policy is pinned at config, behaviour reads
// from config**. Anything that acts on these numbers — `lockCurrentOrganization`
// (packages/db), the org rate-limit guard (apps/api), and the tests that drive
// them — MUST read `ORG_TX_TIMEOUTS` / `ORG_RATE_LIMITS` instead of writing
// 3000/5000/10 into its own file. The `ORG_*_DEFAULTS` constants in
// ./org-policy.ts stay the one place the numbers are declared.
// -----------------------------------------------------------------------------

/** Standalone schema for the §5.2 knobs — same shape + invariant as `envSchema`. */
export const orgTxTimeoutsSchema = z
  .object(orgTxTimeoutShape)
  .superRefine(refineOrgTxTimeouts)
  .transform(
    (v): OrgTxTimeouts =>
      Object.freeze({
        lockTimeoutMs: Number(v.ORG_LOCK_TIMEOUT_MS),
        txTimeoutMs: Number(v.ORG_TX_TIMEOUT_MS),
        maxWaitMs: Number(v.ORG_TX_MAX_WAIT_MS),
      }),
  );

/** Standalone schema for the §8 quotas. Window length is not env-tunable. */
export const orgRateLimitsSchema = z.object(orgRateLimitShape).transform(
  (v): OrgRateLimits =>
    Object.freeze({
      createOrganization: Object.freeze({
        ...ORG_RATE_LIMIT_DEFAULTS.createOrganization,
        limit: Number(v.ORG_RATE_LIMIT_CREATE_ORG_PER_HOUR),
      }),
      createInvitation: Object.freeze({
        ...ORG_RATE_LIMIT_DEFAULTS.createInvitation,
        limit: Number(v.ORG_RATE_LIMIT_INVITE_CREATE_PER_HOUR),
      }),
      reissueInvitationLink: Object.freeze({
        ...ORG_RATE_LIMIT_DEFAULTS.reissueInvitationLink,
        limit: Number(v.ORG_RATE_LIMIT_INVITE_LINK_PER_HOUR),
      }),
      publicInvitationEntry: Object.freeze({
        ...ORG_RATE_LIMIT_DEFAULTS.publicInvitationEntry,
        limit: Number(v.ORG_RATE_LIMIT_INVITE_PUBLIC_PER_HOUR),
      }),
      revealTaxProfile: Object.freeze({
        ...ORG_RATE_LIMIT_DEFAULTS.revealTaxProfile,
        limit: Number(v.ORG_RATE_LIMIT_TAX_REVEAL_PER_HOUR),
      }),
    }),
);

/**
 * Resolves the effective tx/lock timeouts from `source` (default `process.env`).
 * Throws if a value is invalid — by the time anything calls this, `loadEnv` has
 * already validated the same fields at boot, so a throw here means the process
 * env was mutated after boot with a bad value.
 */
export function resolveOrgTxTimeouts(source: NodeJS.ProcessEnv = process.env): OrgTxTimeouts {
  return orgTxTimeoutsSchema.parse(source);
}

/** Resolves the effective §8 quotas from `source` (default `process.env`). */
export function resolveOrgRateLimits(source: NodeJS.ProcessEnv = process.env): OrgRateLimits {
  return orgRateLimitsSchema.parse(source);
}

/**
 * Resolves `INVITATION_TOKEN_SECRET` alone — the keyed-hash secret behind
 * `hashInvitationToken` (D-018, F-002 §7).
 *
 * A NARROW resolver, like the two above, because `packages/db` is a library:
 * calling `loadEnv` there would validate the WHOLE application env and
 * `process.exit(1)` on a variable that has nothing to do with hashing a token.
 * A library must be able to fail with an exception its caller can see, not take
 * the process down.
 *
 * ★ A-8 — it also enforces the §7.3 KEY SEPARATION rule, not only "present and
 * long enough". That rule used to live exclusively in `loadEnv`'s whole-env
 * `superRefine`, i.e. only at boot. Anything that does not boot through
 * `loadEnv` — a seed script, a future worker, a test harness that sets env by
 * hand — would then hash invitation tokens with a JWT key and work perfectly,
 * and the day a JWT secret leaked it would mint invitation tokens too. That is
 * the exact outcome §7.3 separates them to prevent.
 *
 * `packages/db` calls this on every hash, so this is the check that runs where
 * the key is actually used, rather than where the process happened to start.
 */
export function resolveInvitationTokenSecret(source: NodeJS.ProcessEnv = process.env): string {
  const secret = z
    .string({ required_error: "INVITATION_TOKEN_SECRET is required" })
    .min(32, "INVITATION_TOKEN_SECRET must be at least 32 chars (256-bit random) — F-002 §7.3")
    .parse(source.INVITATION_TOKEN_SECRET);

  // Compared only against JWT secrets that are actually present: a process
  // that has no JWT config is not thereby suspicious.
  for (const name of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"] as const) {
    if (source[name] !== undefined && source[name] === secret) {
      // The message names the VARIABLES, never the value — it reaches logs,
      // and naming it would put both secrets in them.
      throw new Error(
        `INVITATION_TOKEN_SECRET must be separate from ${name} (F-002 §7.3): ` +
          "one leaked key must not also forge invitation tokens.",
      );
    }
  }
  return secret;
}

/**
 * Live view of the effective §5.2 timeouts. Accessors read `process.env` on
 * every get (three regex checks — negligible next to a DB round trip) so a lane
 * that sets `ORG_LOCK_TIMEOUT_MS` low before booting the app gets the low value
 * without any module-load ordering games (test-plan U-CFG-07(ง), I-C-13).
 */
export const ORG_TX_TIMEOUTS: OrgTxTimeouts = Object.freeze({
  get lockTimeoutMs() {
    return resolveOrgTxTimeouts().lockTimeoutMs;
  },
  get txTimeoutMs() {
    return resolveOrgTxTimeouts().txTimeoutMs;
  },
  get maxWaitMs() {
    return resolveOrgTxTimeouts().maxWaitMs;
  },
});

/** Live view of the effective §8 quotas (same rationale as `ORG_TX_TIMEOUTS`). */
export const ORG_RATE_LIMITS: OrgRateLimits = Object.freeze({
  get createOrganization() {
    return resolveOrgRateLimits().createOrganization;
  },
  get createInvitation() {
    return resolveOrgRateLimits().createInvitation;
  },
  get reissueInvitationLink() {
    return resolveOrgRateLimits().reissueInvitationLink;
  },
  get publicInvitationEntry() {
    return resolveOrgRateLimits().publicInvitationEntry;
  },
  get revealTaxProfile() {
    return resolveOrgRateLimits().revealTaxProfile;
  },
});
