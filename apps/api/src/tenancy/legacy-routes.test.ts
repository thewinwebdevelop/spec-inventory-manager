// F-002 · T-002-04 — the F-001 legacy bridge (temporary, owned by T-002-13).
//
// Default-deny flipped ON in this task, but marking the ALREADY SHIPPED routes
// with `@Public()`/`@UserScoped()` belongs to T-002-13 (and this task must not
// touch src/auth/**). Until then this closed, exact list keeps their wire
// behaviour byte-identical: the global guard steps aside and each route's own
// controller-level guards (JwtAuthGuard/JsonOnlyGuard) decide exactly as they do
// today. Everything NOT on this list is org-scoped by default.
//
// The list is pinned here so that adding an entry is a deliberate, reviewable
// diff — never something that quietly widens the bypass.
import { describe, it, expect } from "vitest";
import { LEGACY_SELF_GOVERNED_ROUTES, isLegacySelfGovernedRoute } from "./legacy-routes";

describe("legacy self-governed routes (F-001 · removed by T-002-13)", () => {
  it("is exactly the shipped surface — 3 entries, no more", () => {
    expect(LEGACY_SELF_GOVERNED_ROUTES.map((r) => r.description)).toEqual([
      "GET /health (F-000 probe — @Public() in T-002-13)",
      "/auth/* (F-001 — @Public() in T-002-13)",
      "POST /orgs/:orgId/members/:userId/reset-password (F-001 — @UserScoped() in T-002-13)",
    ]);
  });

  it("matches every route F-001 actually ships", () => {
    const shipped: [string, string][] = [
      ["GET", "/health"],
      ["POST", "/auth/signup"],
      ["POST", "/auth/login"],
      ["POST", "/auth/refresh"],
      ["POST", "/auth/logout"],
      ["POST", "/auth/logout-all"],
      ["GET", "/auth/sessions"],
      ["POST", "/auth/change-password"],
      ["POST", "/orgs/org_123/members/usr_456/reset-password"],
    ];
    for (const [method, path] of shipped) {
      expect(isLegacySelfGovernedRoute(method, path), `${method} ${path}`).toBe(true);
    }
  });

  it("does NOT widen to anything else — new routes stay org-scoped", () => {
    const notLegacy: [string, string][] = [
      ["GET", "/orgs/org_123/members"], // F-002's expensive read
      ["PATCH", "/orgs/org_123/members/usr_456"],
      ["DELETE", "/orgs/org_123/members/usr_456/reset-password"], // wrong method
      ["GET", "/orgs/org_123/members/usr_456/reset-password"], // wrong method
      ["POST", "/orgs/org_123/members/usr_456/reset-password/extra"],
      ["GET", "/healthz"],
      ["GET", "/health/deep"],
      ["POST", "/auth/login/../orgs"], // no traversal past one segment
      ["POST", "/authx/login"],
      ["POST", "/organizations"],
    ];
    for (const [method, path] of notLegacy) {
      expect(isLegacySelfGovernedRoute(method, path), `${method} ${path}`).toBe(false);
    }
  });

  it("ignores query strings and trailing slashes consistently", () => {
    expect(isLegacySelfGovernedRoute("GET", "/health/")).toBe(true);
    expect(isLegacySelfGovernedRoute("get", "/health")).toBe(true);
    expect(isLegacySelfGovernedRoute("GET", "/orgs/org_1/members/")).toBe(false);
  });
});
