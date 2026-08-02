// F-002 · T-002-04 — what the middleware hands the guard (architecture §1.3, I-4).
//
// I-4 in one line: `OrgScopeGuard` is a GLOBAL guard, so it runs BEFORE any
// controller-level `@UseGuards(JwtAuthGuard)` — `req.user` is still `undefined`
// at that moment, always. A guard that trusted `req.user` would either 401
// everything or, worse, get "fixed" by waving `@UserScoped()` routes through
// unauthenticated. Hence: the middleware verifies the bearer token itself and
// records the result here, and the guard decides from THIS object only.
import type { Request } from "express";

/**
 * Outcome of resolving the org for a request (architecture §1.3).
 * - `skipped`      — not an org-scoped route: no resolution was attempted (I-3).
 * - `none`         — org-scoped, but neither `X-Organization-Id` nor `:orgId`.
 * - `mismatch`     — header and path param disagree → refuse, never pick a side.
 * - `no_membership`— no membership row for (org, user) — INCLUDING "org does not
 *                    exist"; the two are indistinguishable on purpose (I-5).
 * - `revoked` / `not_active` — a membership exists but is not `active`.
 * - `ok`           — active membership; the org context was established.
 */
export type OrgAuthOutcome =
  | "ok"
  | "none"
  | "mismatch"
  | "no_membership"
  | "revoked"
  | "not_active"
  | "skipped";

/**
 * The route tier the MIDDLEWARE acted on. The guard re-derives the tier from the
 * decorators (`Reflector`, the authority) and refuses the request if the two
 * disagree — see `OrgScopeGuard`. `unknown` = the middleware could not identify
 * the route at all, so it deliberately created no context.
 */
export type AssumedRouteTier = "public" | "user" | "system" | "org" | "unknown";

/** Attached to every request by `OrgContextMiddleware`; read only by the guard. */
export interface OrgAuthState {
  /** Present only when `tokenValid` — the access token's `sub`. */
  userId?: string;
  /** A verifiable, unexpired, `typ:"access"` bearer token was presented. */
  tokenValid: boolean;
  orgOutcome: OrgAuthOutcome;
  /** What the middleware assumed this route was (cross-checked by the guard). */
  routeTier: AssumedRouteTier;
}

/** Express request carrying the middleware's verdict. */
export interface OrgAuthRequest extends Request {
  orgAuth?: OrgAuthState;
}
