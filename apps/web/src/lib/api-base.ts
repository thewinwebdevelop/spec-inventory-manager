/**
 * Same-origin API bases. Dev: apps/web/next.config.mjs rewrites both `/auth/*`
 * and `/api/*` to the real API origin server-side (T-001-11 devops proxy) so
 * the browser never makes a cross-origin request and `SameSite=Strict` on
 * `omni_rt` behaves exactly as it will in prod. We must NOT introduce a
 * `NEXT_PUBLIC_API_ORIGIN`-style cross-origin base here — that would defeat
 * the proxy and force `SameSite=None` (explicitly out of scope per the task
 * brief).
 *
 * Critical fix (client-security review, Option A, 2026-07-06): `omni_rt` is
 * scoped `Path=/auth` (api-spec §0/§2.2, C-1) — the browser only ever
 * attaches a cookie to requests whose PATH matches its scope. Routing the 8
 * auth endpoints through `/api/auth/*` made every request path-miss
 * `Path=/auth` (the actual request path was `/api/auth/refresh`, not
 * `/auth/refresh`), so the browser silently never sent `omni_rt` at all.
 * `AUTH_BASE` therefore points auth calls at the browser's own `/auth/*`
 * (converged contract: backend serves auth at `/auth/*` with no `/api`
 * prefix, devops's rewrite matches `/auth/:path*` before the general
 * `/api/:path*` rule). `API_BASE` remains for any future non-auth calls.
 */
export const AUTH_BASE = "/auth";
export const API_BASE = "/api";
