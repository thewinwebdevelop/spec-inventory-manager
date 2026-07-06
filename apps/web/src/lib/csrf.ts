/**
 * T-001-16 — CSRF double-submit helper (api-spec.md §0 "CSRF on
 * /auth/refresh (cookie path only)").
 *
 * `omni_csrf` is a deliberately non-httpOnly cookie (the server sets it that
 * way so the client CAN read it — that's the double-submit design, not a
 * security bug). This module only ever reads `document.cookie`; it never
 * writes/mints a CSRF value client-side (the server mints it at login).
 */

const CSRF_COOKIE_NAME = "omni_csrf";

/** Reads the `omni_csrf` cookie value, or null if absent (body-transport /
 * mobile path, or not logged in via cookie transport). */
export function readCsrfCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${CSRF_COOKIE_NAME}=`));
  if (!match) return null;
  const value = match.slice(CSRF_COOKIE_NAME.length + 1);
  return value ? decodeURIComponent(value) : null;
}

/** Builds the `X-CSRF-Token` header, only when a csrf cookie is present
 * (mirrors api-spec.md §0 N-3: the check applies only on the cookie path —
 * sending an empty/absent header on the body/mobile path is correct, not an
 * omission). */
export function csrfHeader(): Record<string, string> {
  const token = readCsrfCookie();
  return token ? { "X-CSRF-Token": token } : {};
}
