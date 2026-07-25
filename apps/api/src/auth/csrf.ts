// F-001 · T-001-07 — double-submit CSRF check for the cookie transport (api-spec
// §0, N-3). The check applies WHENEVER the refresh token is resolved from the
// omni_rt cookie (the web/cookie path) — keyed on WHICH TRANSPORT authenticated
// the token, NOT on whether a body field is present. Body/mobile transport (no
// ambient cookie authority) skips CSRF.
//
// Rule: if the omni_rt cookie is present, require X-CSRF-Token header ===
// omni_csrf cookie; mismatch/missing → 403 CSRF_FAILED. Throwing here is a
// pre-mutation short-circuit.
import { ForbiddenException } from "@nestjs/common";
import type { Request } from "express";
import { COOKIE_REFRESH, COOKIE_CSRF, CSRF_HEADER } from "./auth.constants";
import { randomBytes } from "node:crypto";

/** Mint a fresh ≥128-bit CSRF token value (M-6). Independent random, NOT derived
 *  from any other secret — double-submit only needs unguessability + presence. */
export function mintCsrfToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Read a cookie value from the parsed request cookies (cookie-parser). */
function cookie(req: Request, name: string): string | undefined {
  const jar = (req as Request & { cookies?: Record<string, string> }).cookies;
  return jar ? jar[name] : undefined;
}

/**
 * Enforce CSRF on the cookie path. If omni_rt is present, X-CSRF-Token must
 * equal the omni_csrf cookie. Throws ForbiddenException (403 CSRF_FAILED) on
 * failure. No-op when there is no omni_rt cookie (body/mobile path).
 */
export function enforceCsrfIfCookiePath(req: Request): void {
  const rt = cookie(req, COOKIE_REFRESH);
  if (!rt) return; // body/mobile transport — no ambient cookie authority
  const csrfCookie = cookie(req, COOKIE_CSRF);
  const header = req.headers[CSRF_HEADER];
  const headerValue = Array.isArray(header) ? header[0] : header;
  if (!csrfCookie || !headerValue || headerValue !== csrfCookie) {
    throw new ForbiddenException({ error: { code: "CSRF_FAILED", message: "CSRF token ไม่ถูกต้อง" } });
  }
}

/** True if the request is on the cookie transport (omni_rt present). */
export function isCookiePath(req: Request): boolean {
  return cookie(req, COOKIE_REFRESH) !== undefined;
}

/** Resolve the presented refresh token: cookie first, then body (api-spec §0
 *  resolution order). Returns undefined if neither present. */
export function resolvePresentedRefreshToken(req: Request, bodyToken?: string): string | undefined {
  const rt = cookie(req, COOKIE_REFRESH);
  if (rt) return rt;
  return bodyToken;
}
