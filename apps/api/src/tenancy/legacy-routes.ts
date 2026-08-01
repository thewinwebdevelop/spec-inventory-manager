// F-002 · T-002-04 — the F-001 legacy bridge. TEMPORARY, owned by T-002-13.
//
// Default-deny goes live in this task, but marking the ALREADY SHIPPED routes
// with `@Public()` / `@UserScoped()` is T-002-13's job (and this task must not
// touch `src/auth/**`). Until then this closed, exact list keeps their wire
// behaviour byte-identical: the global guard steps aside and each route's own
// controller-level guards (`JsonOnlyGuard`, `JwtAuthGuard`) decide exactly as
// they do today — including `/auth/*`'s 401/415 ordering and reset-password's
// 404-never-403. Anything NOT on this list is org-scoped by default.
//
// It is a *path* list rather than decorators for one reason only: the ownership
// rule for this task forbids editing `src/auth/**`. It is pinned by
// legacy-routes.test.ts so widening it is a deliberate, reviewable diff, and
// T-002-13 deletes the file when the real marks land.
import { normalizePath } from "./route-scope.registry";

export interface LegacyRoute {
  /** `"*"` = any verb. */
  readonly method: string;
  readonly pattern: RegExp;
  readonly description: string;
}

export const LEGACY_SELF_GOVERNED_ROUTES: readonly LegacyRoute[] = Object.freeze([
  Object.freeze({
    method: "GET",
    pattern: /^\/health$/,
    description: "GET /health (F-000 probe — @Public() in T-002-13)",
  }),
  Object.freeze({
    // Every /auth/* endpoint (signup, login, refresh, logout, logout-all,
    // sessions, change-password) — exactly one segment deep, which is the whole
    // shipped surface.
    method: "*",
    pattern: /^\/auth\/[^/]+$/,
    description: "/auth/* (F-001 — @Public() in T-002-13)",
  }),
  Object.freeze({
    method: "POST",
    pattern: /^\/orgs\/[^/]+\/members\/[^/]+\/reset-password$/,
    description:
      "POST /orgs/:orgId/members/:userId/reset-password (F-001 — @UserScoped() in T-002-13)",
  }),
]);

/**
 * True when this request targets a route F-001 already shipped and still governs
 * itself. Such a route gets NO org context (I-3) and no global auth decision.
 */
export function isLegacySelfGovernedRoute(method: string, path: string): boolean {
  const verb = method.toUpperCase();
  const pathname = normalizePath(path);
  return LEGACY_SELF_GOVERNED_ROUTES.some(
    (route) => (route.method === "*" || route.method === verb) && route.pattern.test(pathname),
  );
}
