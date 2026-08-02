// F-002 · T-002-05 ★ — the two frozen tables, pinned.
//
// Authority: architecture §3.1 (the `@AnyActiveMember()` allowlist, split into
// two tiers) · §12.2 item 7 (both tables are LITERAL endpoint lists, never
// regexes, exported from production so @qa's I-02/G-13 import them instead of
// re-declaring them) · api-spec §2 (the endpoint table these rows mirror).
//
// WHY THE TIERS ARE PINNED SEPARATELY: `@AnyActiveMember()` is the weakest layer
// in a default-deny system. If G-13 compared one total ("3 routes"), adding the
// cheapest possible read route could be hidden by dropping a mutating one. The
// sizes below are therefore asserted per tier — and so is the rule that a
// mutating verb may never sit in the `read` list (§3.1 / G-13 assertion ค).
import { describe, it, expect } from "vitest";
import {
  ANY_ACTIVE_MEMBER_ROUTES,
  CAPABILITY_MANAGE_ORG_SETTINGS,
  MUTATING_HTTP_METHODS,
  READ_HTTP_METHODS,
  ROUTE_CAPABILITIES,
  isMutatingMethod,
  routeKey,
  toTemplatePath,
} from "./route-capabilities";
import { CAPABILITY_MANAGE_MEMBERS } from "@omnistock/core-domain";

describe("ROUTE_CAPABILITIES (api-spec §2 · architecture §3.1)", () => {
  it("pins the F-002 endpoint→capability table exactly (10 rows)", () => {
    expect(ROUTE_CAPABILITIES.map(routeKey)).toEqual([
      "PATCH /orgs/{orgId}",
      "PUT /orgs/{orgId}/tax-profile",
      "POST /orgs/{orgId}/tax-profile/reveal",
      "GET /orgs/{orgId}/members",
      "PATCH /orgs/{orgId}/members/{userId}",
      "DELETE /orgs/{orgId}/members/{userId}",
      "GET /orgs/{orgId}/invitations",
      "POST /orgs/{orgId}/invitations",
      "POST /orgs/{orgId}/invitations/{invitationId}/link",
      "DELETE /orgs/{orgId}/invitations/{invitationId}",
    ]);
  });

  it("F-002 enforces exactly TWO capabilities (§3.1) — nothing invented here", () => {
    expect(new Set(ROUTE_CAPABILITIES.map((r) => r.capability))).toEqual(
      new Set([CAPABILITY_MANAGE_MEMBERS, CAPABILITY_MANAGE_ORG_SETTINGS]),
    );
  });

  it("the two READ routes that hold other people's email require manage_members (D-028/I-8/N-4)", () => {
    // NEW-3's whole point: the most expensive surface of F-002 is a read.
    for (const key of ["GET /orgs/{orgId}/members", "GET /orgs/{orgId}/invitations"]) {
      const row = ROUTE_CAPABILITIES.find((r) => routeKey(r) === key);
      expect(row?.capability).toBe(CAPABILITY_MANAGE_MEMBERS);
    }
  });

  it("is a frozen list of literal paths — never regexes (@qa's condition, §12.2 item 7)", () => {
    expect(Object.isFrozen(ROUTE_CAPABILITIES)).toBe(true);
    for (const row of ROUTE_CAPABILITIES) {
      expect(Object.isFrozen(row)).toBe(true);
      expect(typeof row.path).toBe("string");
      expect(row.path.startsWith("/orgs/{orgId}")).toBe(true);
    }
  });

  it("has no duplicate rows (one capability per endpoint, decided once)", () => {
    const keys = ROUTE_CAPABILITIES.map(routeKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("ANY_ACTIVE_MEMBER_ROUTES — two tiers, pinned separately (§3.1 · G-13)", () => {
  it("mutating = exactly DELETE /orgs/{orgId}/membership (1 route, D-029)", () => {
    expect(ANY_ACTIVE_MEMBER_ROUTES.mutating.map(routeKey)).toEqual([
      "DELETE /orgs/{orgId}/membership",
    ]);
  });

  it("read = exactly GET /orgs/{orgId} + GET /orgs/{orgId}/roles (2 routes)", () => {
    expect(ANY_ACTIVE_MEMBER_ROUTES.read.map(routeKey)).toEqual([
      "GET /orgs/{orgId}",
      "GET /orgs/{orgId}/roles",
    ]);
  });

  it("each tier's SIZE is pinned on its own — 1 and 2, never the sum", () => {
    // If this were `length === 3`, adding a read route could be masked by
    // removing a mutating one. That is exactly the hole NEW-3 closed.
    expect(ANY_ACTIVE_MEMBER_ROUTES.mutating.length).toBe(1);
    expect(ANY_ACTIVE_MEMBER_ROUTES.read.length).toBe(2);
  });

  it("a mutating verb can never sit in the `read` tier, and vice versa (G-13 ค)", () => {
    for (const route of ANY_ACTIVE_MEMBER_ROUTES.read) {
      expect(isMutatingMethod(route.method), routeKey(route)).toBe(false);
      expect(READ_HTTP_METHODS).toContain(route.method);
    }
    for (const route of ANY_ACTIVE_MEMBER_ROUTES.mutating) {
      expect(isMutatingMethod(route.method), routeKey(route)).toBe(true);
      expect(MUTATING_HTTP_METHODS).toContain(route.method);
    }
  });

  it("is frozen, literal, and disjoint from ROUTE_CAPABILITIES", () => {
    expect(Object.isFrozen(ANY_ACTIVE_MEMBER_ROUTES)).toBe(true);
    expect(Object.isFrozen(ANY_ACTIVE_MEMBER_ROUTES.mutating)).toBe(true);
    expect(Object.isFrozen(ANY_ACTIVE_MEMBER_ROUTES.read)).toBe(true);
    const capabilityKeys = new Set(ROUTE_CAPABILITIES.map(routeKey));
    for (const route of [...ANY_ACTIVE_MEMBER_ROUTES.mutating, ...ANY_ACTIVE_MEMBER_ROUTES.read]) {
      // A route declaring BOTH layers is a contradiction — the guard refuses it
      // at runtime, and it must not be expressible in the tables either.
      expect(capabilityKeys.has(routeKey(route))).toBe(false);
    }
  });
});

describe("path/method helpers (so tests and the router speak one dialect)", () => {
  it("toTemplatePath rewrites Nest ':param' into the api-spec '{param}' form", () => {
    expect(toTemplatePath("/orgs/:orgId/members/:userId")).toBe("/orgs/{orgId}/members/{userId}");
    expect(toTemplatePath("orgs/:orgId//roles/")).toBe("/orgs/{orgId}/roles");
    expect(toTemplatePath("/")).toBe("/");
  });

  it("routeKey normalizes method case and path shape", () => {
    expect(routeKey({ method: "get", path: "/orgs/:orgId" })).toBe("GET /orgs/{orgId}");
  });

  it("classifies every verb the router can produce", () => {
    for (const m of ["POST", "PUT", "PATCH", "DELETE"]) expect(isMutatingMethod(m)).toBe(true);
    for (const m of ["GET", "HEAD", "OPTIONS"]) expect(isMutatingMethod(m)).toBe(false);
  });
});
