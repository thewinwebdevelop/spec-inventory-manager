// F-001 — auth config constants (apps/api side). The tunable knobs the arch
// says "live in one config constant" (argon2 params §5.1, throttle windows §8,
// cookie names §0). Kept together so they can be raised over time in one place.
//
// Token-lifetime constants (60d/90d/20) + backoff curve live in
// `@omnistock/core-domain` (pure). This file holds the framework-side knobs:
// argon2 params, Redis key prefixes/TTLs, and cookie names.
import * as argon2 from "argon2";

/**
 * argon2id params (arch §5.1 — OWASP-aligned starting point; tune to hardware).
 * memoryCost = 19 MiB, timeCost = 2, parallelism = 1. Raising these here is the
 * single place cost is bumped; rehash-on-login (§5.1) upgrades stored hashes.
 *
 * (M-10) The dummy hash used by the unknown-email dummy-verify (§9) is derived
 * from THESE params at boot — bumping params + regenerating the dummy hash is
 * one atomic change (see hashing.service.ts), never two independent ones.
 */
export const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB in KiB
  timeCost: 2,
  parallelism: 1,
};

// ─── Redis throttle keys + windows (arch §8, data-model §4) ──────────────────

/** IP sliding-window cap on /auth/login, /auth/signup, /auth/refresh. */
export const THROTTLE_IP_PREFIX = "throttle:ip:";
/** Account consecutive-failure backoff (login: emailNorm; change-pw: userId). */
export const THROTTLE_ACCT_PREFIX = "throttle:acct:";

/** IP sliding-window: max attempts before 429 (arch §8.1 "~20 / 5 min / IP"). */
export const IP_WINDOW_MAX = 20;
/** IP sliding-window length, seconds (5 min). */
export const IP_WINDOW_SECONDS = 5 * 60;

/** Account counter TTL (seconds) — long enough to hold the backoff ceiling. */
export const ACCT_COUNTER_TTL_SECONDS = 15 * 60;

/** Degraded in-process IP limiter cap when Redis is down (arch §8.3 M-7). */
export const DEGRADED_IP_MAX = 20;
/** Degraded in-process limiter window, ms. */
export const DEGRADED_IP_WINDOW_MS = 5 * 60 * 1000;

// ─── Cookies (api-spec §0) ───────────────────────────────────────────────────

/** httpOnly refresh-token cookie (web transport). Path=/auth (C-1). */
export const COOKIE_REFRESH = "omni_rt";
/** Readable double-submit CSRF cookie (web). NON-httpOnly (JS must read it). */
export const COOKIE_CSRF = "omni_csrf";
/**
 * Refresh cookie (omni_rt) path — `/auth` so the browser sends it to
 * `/auth/refresh`, `/auth/logout`, `/auth/sessions` (matches the browser
 * `/auth/*` path; C-1). Keeps the httpOnly refresh token off every non-auth
 * route.
 */
export const COOKIE_PATH = "/auth";
/**
 * CSRF cookie (omni_csrf) path — `/` (D-019 amendment to C-1, Option A). The
 * double-submit token must be readable via `document.cookie` from app PAGES
 * (`/login`, `/settings/security`, `/`), which are NOT under `/auth`, so it
 * cannot be path-scoped to `/auth` like the refresh cookie. Widening the path
 * loses nothing: omni_csrf carries no secret — its defense is SameSite=Strict +
 * the value-match against the `X-CSRF-Token` header, both path-independent.
 */
export const CSRF_COOKIE_PATH = "/";
/** Refresh cookie Max-Age (seconds) — 60d, matches per-token expiry. */
export const COOKIE_REFRESH_MAX_AGE_SECONDS = 60 * 24 * 60 * 60;

/** CSRF header the web client echoes the omni_csrf cookie value in. */
export const CSRF_HEADER = "x-csrf-token";
