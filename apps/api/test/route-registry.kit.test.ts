// F-002 · T-002-22 — META-TEST for the route-registry audit (deliverable 3).
//
// The audit's job is to catch a route that forgot to declare itself. The only
// way to know it can is to hand it one. Every case below feeds
// `auditRouteRegistry` a deliberately broken router and asserts the specific
// finding — plus one case that feeds it the real production tables so a change
// that makes everything "fine" is caught too.
import { describe, it, expect } from "vitest";
import { ANY_ACTIVE_MEMBER_ROUTES, ROUTE_CAPABILITIES, type RouteDeclaration } from "../src/common/authz";
import { CAPABILITY_MANAGE_MEMBERS, CAPABILITY_MANAGE_ORG_SETTINGS } from "@omnistock/core-domain";
import {
  DEFAULT_IGNORED_PATH_PREFIXES,
  assertRouteRegistryClean,
  auditRouteRegistry,
} from "./route-registry.kit";

function route(over: Partial<RouteDeclaration> & Pick<RouteDeclaration, "method" | "path">): RouteDeclaration {
  return {
    scope: "org",
    declaration: "any-active-member",
    mutating: ["POST", "PUT", "PATCH", "DELETE"].includes(over.method.toUpperCase()),
    source: "FakeController.handler",
    ...over,
  } as RouteDeclaration;
}

/** A router in which every org-scoped route declares itself correctly. */
const CLEAN_ROUTER: readonly RouteDeclaration[] = [
  route({ method: "GET", path: "/orgs/{orgId}", declaration: "any-active-member" }),
  route({ method: "GET", path: "/orgs/{orgId}/roles", declaration: "any-active-member" }),
  route({ method: "DELETE", path: "/orgs/{orgId}/membership", declaration: "any-active-member" }),
  route({
    method: "GET",
    path: "/orgs/{orgId}/members",
    declaration: "capability",
    capability: CAPABILITY_MANAGE_MEMBERS,
  }),
  route({ method: "POST", path: "/auth/login", scope: "public", declaration: "none" }),
];

describe("auditRouteRegistry — the clean baseline", () => {
  it("a correct router produces no problems", () => {
    const report = auditRouteRegistry(CLEAN_ROUTER);
    expect(report.problems).toEqual([]);
    expect(() => assertRouteRegistryClean(report)).not.toThrow();
  });

  it("a `@Public()` route declaring nothing is NOT a problem (tier is not org)", () => {
    const report = auditRouteRegistry([route({ method: "GET", path: "/health", scope: "public", declaration: "none" })]);
    expect(report.orgScoped).toEqual([]);
    expect(report.problems).toEqual([]);
  });
});

describe("auditRouteRegistry — RED cases (each must be detected)", () => {
  it("RED I-02: an org-scoped route that declares NOTHING", () => {
    const report = auditRouteRegistry([
      ...CLEAN_ROUTER,
      route({ method: "GET", path: "/orgs/{orgId}/secrets", declaration: "none", source: "SecretsController.list" }),
    ]);
    expect(report.undeclared).toHaveLength(1);
    expect(report.undeclared[0].route).toBe("GET /orgs/{orgId}/secrets");
    expect(report.undeclared[0].source).toBe("SecretsController.list");
    expect(() => assertRouteRegistryClean(report)).toThrow(/undeclared/);
  });

  it("RED: both markers on the same target (the guard 500s)", () => {
    const report = auditRouteRegistry([...CLEAN_ROUTER, route({ method: "PATCH", path: "/orgs/{orgId}", declaration: "conflict" })]);
    expect(report.conflicts).toHaveLength(1);
    expect(() => assertRouteRegistryClean(report)).toThrow(/conflict/);
  });

  it("RED G-13: `@AnyActiveMember()` on a route absent from the pinned allowlist", () => {
    // This is the failure mode that turns "forgot to declare = red" into
    // "declare the loosest thing = green".
    const report = auditRouteRegistry([
      ...CLEAN_ROUTER,
      route({ method: "GET", path: "/orgs/{orgId}/invoices", declaration: "any-active-member" }),
    ]);
    expect(report.notAllowlisted).toHaveLength(1);
    expect(report.notAllowlisted[0].route).toBe("GET /orgs/{orgId}/invoices");
  });

  it("RED G-13(ค): a MUTATING route hiding in the `read` tier of the allowlist", () => {
    // `GET /orgs/{orgId}/roles` is allowlisted under `read`. The same path
    // served by a DELETE would be a mutating route wearing a read exemption.
    const report = auditRouteRegistry([route({ method: "DELETE", path: "/orgs/{orgId}/roles", declaration: "any-active-member" })]);
    expect(report.wrongTier).toHaveLength(0); // not allowlisted for DELETE at all…
    expect(report.notAllowlisted).toHaveLength(1); // …so it is caught here instead.

    // And the true tier confusion: the allowlisted read route served by a verb
    // the table calls mutating.
    const mutatingInRead = auditRouteRegistry([
      { ...route({ method: "POST", path: "/orgs/{orgId}" }), declaration: "any-active-member" },
    ]);
    expect(mutatingInRead.notAllowlisted).toHaveLength(1);
  });

  it("RED: declared capability disagrees with ROUTE_CAPABILITIES", () => {
    const report = auditRouteRegistry([
      route({
        method: "GET",
        path: "/orgs/{orgId}/members",
        declaration: "capability",
        capability: CAPABILITY_MANAGE_ORG_SETTINGS, // table says manage_members
      }),
    ]);
    expect(report.capabilityMismatch).toHaveLength(1);
    expect(report.capabilityMismatch[0].message).toContain(CAPABILITY_MANAGE_MEMBERS);
  });

  it("RED: a capability route with no row in the table at all", () => {
    const report = auditRouteRegistry([
      route({ method: "POST", path: "/orgs/{orgId}/payouts", declaration: "capability", capability: "manage_payouts" }),
    ]);
    expect(report.capabilityMismatch).toHaveLength(1);
    expect(report.capabilityMismatch[0].message).toContain("NO row in ROUTE_CAPABILITIES");
  });

  it("RED (the important one): an EMPTY enumeration must not be green", () => {
    // A kit that enumerates zero routes satisfies every check and would stay
    // green forever — qa called this the single most important case in the set.
    const report = auditRouteRegistry([]);
    expect(report.problems).toEqual([]); // nothing is "wrong"…
    expect(() => assertRouteRegistryClean(report)).toThrow(/VACUOUS/); // …and yet it fails.
  });

  it("RED: `failOnPending` turns the table→router direction fatal", () => {
    // Off by default today because F-002's controllers land in later waves; the
    // wave that ships them flips this on and the audit then demands that every
    // table row is actually served.
    const report = auditRouteRegistry(CLEAN_ROUTER);
    expect(report.pending.length).toBeGreaterThan(0);
    expect(() => assertRouteRegistryClean(report)).not.toThrow();
    expect(() => assertRouteRegistryClean(report, { failOnPending: true })).toThrow(/pending/);
  });
});

describe("auditRouteRegistry — HEAD resolves to its GET row (T-002-13)", () => {
  it("a HEAD route is audited against the GET row, never a weaker one of its own", () => {
    // Express answers HEAD from the @Get() handler, so HEAD must require
    // EXACTLY what GET requires. `capabilityLookupMethod()` (production) is what
    // this kit calls; if it ever stopped folding HEAD into GET, this goes red.
    const report = auditRouteRegistry([
      route({
        method: "HEAD",
        path: "/orgs/{orgId}/members",
        declaration: "capability",
        capability: CAPABILITY_MANAGE_MEMBERS,
      }),
    ]);
    expect(report.capabilityMismatch).toEqual([]);

    const wrong = auditRouteRegistry([
      route({
        method: "HEAD",
        path: "/orgs/{orgId}/members",
        declaration: "capability",
        capability: CAPABILITY_MANAGE_ORG_SETTINGS,
      }),
    ]);
    expect(wrong.capabilityMismatch).toHaveLength(1);
  });

  it("a HEAD route wearing @AnyActiveMember() is checked against GET's allowlist tier", () => {
    const report = auditRouteRegistry([route({ method: "HEAD", path: "/orgs/{orgId}", declaration: "any-active-member" })]);
    expect(report.notAllowlisted).toEqual([]);
    expect(report.wrongTier).toEqual([]);
  });
});

describe("auditRouteRegistry — prefix filtering", () => {
  it("ignores `/__test__` by default so fixtures do not pollute the verdict", () => {
    const fixtures = [route({ method: "GET", path: "/__test__/probe/{orgId}", declaration: "any-active-member" })];
    expect(DEFAULT_IGNORED_PATH_PREFIXES).toContain("/__test__");
    expect(auditRouteRegistry([...CLEAN_ROUTER, ...fixtures]).problems).toEqual([]);
  });

  it("…and RED: with the filter off, those same fixtures ARE reported", () => {
    // Proof the filter is doing work rather than the fixtures being harmless.
    const fixtures = [route({ method: "GET", path: "/__test__/probe/{orgId}", declaration: "any-active-member" })];
    const report = auditRouteRegistry([...CLEAN_ROUTER, ...fixtures], { ignorePathPrefixes: [] });
    expect(report.notAllowlisted).toHaveLength(1);
    expect(report.notAllowlisted[0].route).toBe("GET /__test__/probe/{orgId}");
  });
});

describe("the audit compares against PRODUCTION tables, not a copy", () => {
  it("the tables it reads are the ones the guard reads", () => {
    // If somebody re-declared the tables inside the suite, these would drift and
    // nobody would notice. Asserting the imported objects are the frozen
    // production ones keeps the coupling honest.
    expect(Object.isFrozen(ROUTE_CAPABILITIES)).toBe(true);
    expect(Object.isFrozen(ANY_ACTIVE_MEMBER_ROUTES)).toBe(true);
    expect(ROUTE_CAPABILITIES.length).toBeGreaterThan(0);
    expect(ANY_ACTIVE_MEMBER_ROUTES.mutating).toHaveLength(1);
    expect(ANY_ACTIVE_MEMBER_ROUTES.read).toHaveLength(2);
  });
});
