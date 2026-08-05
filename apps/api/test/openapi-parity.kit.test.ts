// F-002 · T-002-21 ★ — META-TEST for the router↔spec parity audit.
//
// The audit's job is to catch an endpoint the contract does not know about, and
// a contract entry no endpoint serves. The only way to know it can is to hand it
// one of each. Every case below feeds `auditOpenApiParity` a deliberately broken
// pair and asserts the specific finding.
//
// It also reads the REAL bundled contract from disk — so "the spec parses, has
// operations, and is a bundle rather than a pile of $refs" is proven in the unit
// lane, without a database.
import { describe, it, expect } from "vitest";
import type { RouteDeclaration } from "../src/common/authz";
import {
  DEFAULT_IGNORED_PATH_PREFIXES,
  assertOpenApiParity,
  auditOpenApiParity,
  readSpecOperations,
  resolveBundledSpecPath,
  type SpecOperation,
} from "./openapi-parity.kit";

function route(
  over: Partial<RouteDeclaration> & Pick<RouteDeclaration, "method" | "path">,
): RouteDeclaration {
  return {
    scope: "org",
    declaration: "any-active-member",
    mutating: ["POST", "PUT", "PATCH", "DELETE"].includes(over.method.toUpperCase()),
    source: "FakeController.handler",
    ...over,
  } as RouteDeclaration;
}

const op = (method: string, path: string, operationId?: string): SpecOperation => ({
  method,
  path,
  operationId,
});

/** A router and a spec that agree, so each RED case differs by exactly one thing. */
const ROUTER: readonly RouteDeclaration[] = [
  route({ method: "GET", path: "/orgs/{orgId}" }),
  route({ method: "PATCH", path: "/orgs/{orgId}" }),
  route({ method: "DELETE", path: "/orgs/{orgId}/membership" }),
];
const SPEC: readonly SpecOperation[] = [
  op("GET", "/orgs/{orgId}", "getOrganization"),
  op("PATCH", "/orgs/{orgId}", "updateOrganization"),
  op("DELETE", "/orgs/{orgId}/membership", "leaveOrganization"),
];

describe("auditOpenApiParity — the clean baseline", () => {
  it("a router and a spec that agree produce no problems", () => {
    const report = auditOpenApiParity(ROUTER, SPEC);
    expect(report.problems).toEqual([]);
    expect(() => assertOpenApiParity(report)).not.toThrow();
  });

  it("HEAD is looked up against its GET operation (express answers it from @Get)", () => {
    const report = auditOpenApiParity([...ROUTER, route({ method: "HEAD", path: "/orgs/{orgId}" })], SPEC);
    expect(report.problems).toEqual([]);
  });

  it("test fixtures under /__test__ are ignored by default", () => {
    expect(DEFAULT_IGNORED_PATH_PREFIXES).toContain("/__test__");
    const report = auditOpenApiParity(
      [...ROUTER, route({ method: "GET", path: "/__test__/boom", scope: "public" })],
      SPEC,
    );
    expect(report.problems).toEqual([]);
  });
});

describe("auditOpenApiParity — RED cases (each must be detected)", () => {
  it("RED router→spec: a shipped endpoint the contract never heard of", () => {
    // This is the exact 2026-08-05 situation, in miniature: the server answers,
    // every other gate is green, and no client can call it.
    const report = auditOpenApiParity(
      [...ROUTER, route({ method: "POST", path: "/orgs/{orgId}/invitations", source: "InvitationsController.create" })],
      SPEC,
    );
    expect(report.missingFromSpec).toHaveLength(1);
    expect(report.missingFromSpec[0]?.route).toBe("POST /orgs/{orgId}/invitations");
    expect(report.missingFromSpec[0]?.source).toBe("InvitationsController.create");
    expect(() => assertOpenApiParity(report)).toThrowError(/missing-from-spec/);
  });

  it("RED spec→router: a published operation nothing serves (would 404 at runtime)", () => {
    const report = auditOpenApiParity(ROUTER, [...SPEC, op("GET", "/orgs/{orgId}/roles", "listRoles")]);
    expect(report.missingFromRouter).toHaveLength(1);
    expect(report.missingFromRouter[0]?.route).toBe("GET /orgs/{orgId}/roles");
    expect(report.missingFromRouter[0]?.source).toContain("listRoles");
    expect(() => assertOpenApiParity(report)).toThrowError(/missing-from-router/);
  });

  it("RED: the same path with the WRONG verb counts as both directions", () => {
    // `PUT /orgs/{orgId}/tax-profile` implemented, `POST` documented: the path
    // matching on its own would call this fine. It is not fine.
    const report = auditOpenApiParity(
      [route({ method: "PUT", path: "/orgs/{orgId}/tax-profile" })],
      [op("POST", "/orgs/{orgId}/tax-profile", "putTaxProfile")],
    );
    expect(report.missingFromSpec.map((f) => f.route)).toEqual(["PUT /orgs/{orgId}/tax-profile"]);
    expect(report.missingFromRouter.map((f) => f.route)).toEqual(["POST /orgs/{orgId}/tax-profile"]);
  });

  it("RED: a path template that drifted by one character is NOT a match", () => {
    const report = auditOpenApiParity(
      [route({ method: "GET", path: "/orgs/{orgId}/member" })],
      [op("GET", "/orgs/{orgId}/members", "listMembers")],
    );
    expect(report.problems).toHaveLength(2);
  });
});

describe("assertOpenApiParity — the vacuity floors", () => {
  it("an EMPTY router is refused, not congratulated", () => {
    const report = auditOpenApiParity([], SPEC);
    // Note: with no routes there are no `missing-from-spec` findings at all, so
    // without this floor the audit would be green for a broken enumeration.
    expect(report.missingFromSpec).toEqual([]);
    expect(() => assertOpenApiParity(report, { minRoutes: 1 })).toThrowError(/VACUOUS/);
  });

  it("a spec with fewer operations than expected is refused", () => {
    const report = auditOpenApiParity(ROUTER, SPEC);
    expect(() => assertOpenApiParity(report, { minOperations: 99 })).toThrowError(/VACUOUS/);
  });
});

describe("readSpecOperations — against the REAL bundled contract", () => {
  it("resolves the bundle through the @omnistock/contracts dependency", () => {
    expect(resolveBundledSpecPath()).toMatch(/packages\/contracts\/openapi\/openapi\.yaml$/);
  });

  it("parses, and publishes every F-002 operation this task added", () => {
    const operations = readSpecOperations();
    const keys = new Set(operations.map((o) => `${o.method} ${o.path}`));

    // The 16 F-002 operations that exist in the router today (api-spec §2 minus
    // `GET /orgs/{orgId}/roles`, §3.6, which has no controller — see the
    // T-002-21 report). Listed literally: a computed expectation would agree
    // with whatever the spec happens to contain.
    for (const key of [
      "POST /organizations",
      "GET /me/organizations",
      "GET /orgs/{orgId}",
      "PATCH /orgs/{orgId}",
      "PUT /orgs/{orgId}/tax-profile",
      "POST /orgs/{orgId}/tax-profile/reveal",
      "GET /orgs/{orgId}/members",
      "PATCH /orgs/{orgId}/members/{userId}",
      "DELETE /orgs/{orgId}/members/{userId}",
      "DELETE /orgs/{orgId}/membership",
      "GET /orgs/{orgId}/invitations",
      "POST /orgs/{orgId}/invitations",
      "POST /orgs/{orgId}/invitations/{invitationId}/link",
      "DELETE /orgs/{orgId}/invitations/{invitationId}",
      "POST /invitations/preview",
      "POST /invitations/accept",
    ]) {
      expect(keys, `${key} must be published by openapi.yaml`).toContain(key);
    }
  });

  it("every operation has an operationId (the generated clients are named from it)", () => {
    const missing = readSpecOperations().filter((o) => !o.operationId || o.operationId === "undefined");
    expect(missing).toEqual([]);
  });

  it("refuses a SOURCE file — an unresolved $ref means we are not reading the bundle", () => {
    const root = resolveBundledSpecPath().replace(/openapi\.yaml$/, "root.yaml");
    expect(() => readSpecOperations(root)).toThrowError(/unresolved \$ref/);
  });
});
