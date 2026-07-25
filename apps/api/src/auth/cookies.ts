// F-001 · T-001-07 — refresh + CSRF cookie set/clear helpers (api-spec §0).
// SPLIT PATHS (D-019 amendment to C-1, Option A — client-security review):
//   omni_rt   (refresh, httpOnly): Path=/auth  — browser sends it to the
//             browser `/auth/*` routes (refresh/logout/sessions), off all else.
//   omni_csrf (double-submit, NON-httpOnly): Path=/  — must be readable via
//             document.cookie from app PAGES (/login, /settings/security, /),
//             which live outside /auth. SameSite=Strict + header value-match is
//             the real defense (path-independent); it carries no secret.
import type { Response } from "express";
import {
  COOKIE_REFRESH,
  COOKIE_CSRF,
  COOKIE_PATH,
  CSRF_COOKIE_PATH,
  COOKIE_REFRESH_MAX_AGE_SECONDS,
} from "./auth.constants";

/** Set the refresh (httpOnly, Path=/auth) + CSRF (readable, Path=/) cookies. */
export function setAuthCookies(res: Response, refreshValue: string, csrfValue: string): void {
  res.cookie(COOKIE_REFRESH, refreshValue, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: COOKIE_PATH,
    maxAge: COOKIE_REFRESH_MAX_AGE_SECONDS * 1000,
  });
  res.cookie(COOKIE_CSRF, csrfValue, {
    httpOnly: false, // readable so app pages can echo it in X-CSRF-Token
    secure: true,
    sameSite: "strict",
    path: CSRF_COOKIE_PATH, // "/" — readable from non-/auth pages (Option A)
    maxAge: COOKIE_REFRESH_MAX_AGE_SECONDS * 1000,
  });
}

/** Re-set only the refresh cookie (rotation keeps the same csrf for the session). */
export function setRefreshCookie(res: Response, refreshValue: string): void {
  res.cookie(COOKIE_REFRESH, refreshValue, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: COOKIE_PATH,
    maxAge: COOKIE_REFRESH_MAX_AGE_SECONDS * 1000,
  });
}

/** Clear both auth cookies (logout / logout-all). Path must match to clear —
 *  omni_rt at /auth, omni_csrf at / (Option A). */
export function clearAuthCookies(res: Response): void {
  res.clearCookie(COOKIE_REFRESH, { path: COOKIE_PATH });
  res.clearCookie(COOKIE_CSRF, { path: CSRF_COOKIE_PATH });
}
