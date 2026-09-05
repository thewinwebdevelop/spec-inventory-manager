// F-002 · T-002-18 ★ — what the four membership routes DECLARE.
//
// architecture §1.1 (tier) · §3.1 + NEW-3 (authorization) · api-spec §2.
//
// These assertions read the decorators off the controller classes, so they run
// with no database and no application. The live-router version (@qa's
// route-registry kit, which walks the running app) is in
// `test/members.e2e.int.test.ts`; this one exists so a dropped decorator is red
// in the UNIT lane too — and so the PATHS are compared to the contract tables on
// a machine with no Postgres.
//
// The single most important assertion in this file is the LAST one: the leave
// route is the only mutating route in the entire feature that any active member
// may call, and it is safe ONLY because it has no `:userId`. If that ever stops
// being true, everything §3.17 argues collapses (api-spec §3.17 reasons 1–3).
import { describe, it, expect } from "vitest";
import { PATH_METADATA } from "@nestjs/common/constants";
import { Reflector } from "@nestjs/core";
import { CAPABILITY_MANAGE_MEMBERS } from "@omnistock/core-domain";
import {
  ANY_ACTIVE_MEMBER_ROUTES,
  ANY_ACTIVE_MEMBER_KEY,
  CAPABILITY_KEY,
  ROUTE_CAPABILITIES,
  routeKey,
} from "../common/authz";
import { ORG_RATE_LIMIT_KEY } from "../common/org-rate-limit.decorator";
import { ROUTE_SCOPE_KEY } from "../tenancy";
import { MembersController } from "./members.controller";
import { MembershipController } from "./membership.controller";
import { RESPONSE_HEADER_POLICY, responseHeaderPolicyFor } from "./response-headers";

const reflector = new Reflector();

function declarationOf(target: object) {
  return {
    scope: reflector.get<string | undefined>(ROUTE_SCOPE_KEY, target as never),
    capability: reflector.get<string | undefined>(CAPABILITY_KEY, target as never),
    anyActiveMember: reflector.get<boolean | undefined>(ANY_ACTIVE_MEMBER_KEY, target as never),
    rateLimit: reflector.get<string | undefined>(ORG_RATE_LIMIT_KEY, target as never),
  };
}

const handlers = {
  list: MembersController.prototype.list,
  updateRole: MembersController.prototype.updateRole,
  revoke: MembersController.prototype.revoke,
  leave: MembershipController.prototype.leave,
};

describe("★ paths match api-spec §2 exactly", () => {
  it.each([
    [MembersController, "orgs/:orgId/members"],
    [MembershipController, "orgs/:orgId/membership"],
  ])("%s is mounted at /%s", (controller, path) => {
    expect(Reflect.getMetadata(PATH_METADATA, controller)).toBe(path);
  });

  it("★ every route has the ROUTE_CAPABILITIES / allowlist row it needs", () => {
    // A one-character drift in a controller path makes the capability lookup
    // miss, which `CapabilityGuard` answers with 403 for everybody. Compared on
    // the literal strings here rather than discovered at runtime.
    const members = `/${Reflect.getMetadata(PATH_METADATA, MembersController)}`;
    const membership = `/${Reflect.getMetadata(PATH_METADATA, MembershipController)}`;

    for (const method of ["GET"]) {
      expect(routeKey({ method, path: members })).toBe(
        routeKey(
          ROUTE_CAPABILITIES.find(
            (r) => r.method === method && r.path === "/orgs/{orgId}/members",
          )!,
        ),
      );
    }
    for (const method of ["PATCH", "DELETE"]) {
      expect(routeKey({ method, path: `${members}/:userId` })).toBe(
        routeKey(
          ROUTE_CAPABILITIES.find(
            (r) => r.method === method && r.path === "/orgs/{orgId}/members/{userId}",
          )!,
        ),
      );
    }
    expect(routeKey({ method: "DELETE", path: membership })).toBe(
      routeKey(ANY_ACTIVE_MEMBER_ROUTES.mutating.find((r) => r.path === "/orgs/{orgId}/membership")!),
    );
  });
});

describe("★ tiers (architecture §1.1, I-3)", () => {
  it.each(Object.entries(handlers))(
    "%s declares NO tier — org-scoped is the default",
    (_name, handler) => {
      expect(declarationOf(handler).scope).toBeUndefined();
    },
  );

  it("★ nothing is declared on the CLASS (High-1)", () => {
    // A class-level marker is inherited by every handler added later, and the
    // inherited one is always the permissive one. On `MembershipController` that
    // would be catastrophic: `@AnyActiveMember()` at class level would silently
    // apply to any future handler mounted under `/orgs/{orgId}/membership`.
    for (const controller of [MembersController, MembershipController]) {
      expect(reflector.get(ROUTE_SCOPE_KEY, controller)).toBeUndefined();
      expect(reflector.get(CAPABILITY_KEY, controller)).toBeUndefined();
      expect(reflector.get(ANY_ACTIVE_MEMBER_KEY, controller)).toBeUndefined();
    }
  });
});

describe("★ authorization (architecture §3.1 · NEW-3 · D-028)", () => {
  it.each([
    ["list", handlers.list],
    ["updateRole", handlers.updateRole],
    ["revoke", handlers.revoke],
  ])("%s declares @RequireCapability(manage_members)", (_name, handler) => {
    const declaration = declarationOf(handler);
    expect(declaration.capability).toBe(CAPABILITY_MANAGE_MEMBERS);
    expect(declaration.anyActiveMember).toBeUndefined();
  });

  it("★ the READ is capability-gated too (NEW-3 / PDPA) — not just the writes", () => {
    // `GET /orgs/{orgId}/members` returns every member's email address. It is
    // the concrete surface that made fail-closed cover read routes: a refactor
    // dropping this decorator must break the route, not open the directory.
    expect(declarationOf(handlers.list).capability).toBe(CAPABILITY_MANAGE_MEMBERS);
  });

  it("★ leave declares @AnyActiveMember() and NO capability (D-029)", () => {
    const declaration = declarationOf(handlers.leave);
    expect(declaration.anyActiveMember).toBe(true);
    expect(declaration.capability).toBeUndefined();
  });

  it("★ no handler carries BOTH markers (the guard 500s on that)", () => {
    for (const handler of Object.values(handlers)) {
      const declaration = declarationOf(handler);
      expect(declaration.capability !== undefined && declaration.anyActiveMember === true).toBe(
        false,
      );
    }
  });

  it("★ leave is the ONE mutating route on the @AnyActiveMember allowlist (G-13)", () => {
    // Its safety is STRUCTURAL: the path has no `:userId`, so the target is
    // `ctx.userId` and nothing in the request can point it elsewhere. A second
    // mutating entry would not have that property for free, which is why the
    // tier is pinned by size and not merely by set membership.
    expect(ANY_ACTIVE_MEMBER_ROUTES.mutating).toHaveLength(1);
    expect(ANY_ACTIVE_MEMBER_ROUTES.mutating[0]).toMatchObject({
      method: "DELETE",
      path: "/orgs/{orgId}/membership",
    });
    expect(Reflect.getMetadata(PATH_METADATA, MembershipController)).not.toContain(":userId");
  });
});

describe("response headers (api-spec §1 · I-05)", () => {
  it.each([
    ["GET", "/orgs/{orgId}/members"],
    ["PATCH", "/orgs/{orgId}/members/{userId}"],
    ["DELETE", "/orgs/{orgId}/members/{userId}"],
    ["DELETE", "/orgs/{orgId}/membership"],
  ])("%s %s has a policy row demanding no-store", (method, path) => {
    const row = responseHeaderPolicyFor(method, path);
    expect(row, `${method} ${path} is missing from RESPONSE_HEADER_POLICY`).toBeDefined();
    expect(row!.headers["Cache-Control"]).toBe("no-store");
  });

  it("★ B-2 · no route appears TWICE in the table — the resolver takes the first", () => {
    // Security review B-2. `responseHeaderPolicyFor` is a `.find()`, so a
    // second row for the same route is unreachable code that still READS like
    // enforcement. Four invitation routes were listed twice: the earlier rows
    // carried the weaker header set and `carries: ["tin"]`, the later ones the
    // correct `no-referrer` set and `["token","email"]` — and the earlier ones
    // won every lookup.
    //
    // The file's own header claims the table is checked in both directions.
    // Neither direction can see this: a duplicate key is not a missing route
    // and not an unclassified body.
    const seen = new Map<string, number>();
    for (const row of RESPONSE_HEADER_POLICY) {
      const key = `${row.method} ${row.path}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    const duplicated = [...seen.entries()].filter(([, n]) => n > 1).map(([key]) => key);
    expect(
      duplicated,
      "a second row for the same route can never be reached — merge them, " +
        "taking the STRICTER headers and the union of `carries`",
    ).toEqual([]);
  });

  it("★ B-2 · every invitation route resolves to the no-referrer policy (I-6)", () => {
    // The consequence, asserted on the resolver rather than on the table, so
    // it stays true however the rows are arranged. `Referrer-Policy:
    // no-referrer` is not decoration here: these bodies carry a bearer
    // credential for membership, and a Referer header would hand it to
    // whatever the invite page links to next.
    for (const [method, path] of [
      ["GET", "/orgs/{orgId}/invitations"],
      ["POST", "/orgs/{orgId}/invitations"],
      ["POST", "/orgs/{orgId}/invitations/{invitationId}/link"],
      ["DELETE", "/orgs/{orgId}/invitations/{invitationId}"],
    ] as const) {
      const row = responseHeaderPolicyFor(method, path);
      expect(row, `${method} ${path} is missing from RESPONSE_HEADER_POLICY`).toBeDefined();
      expect(row!.headers["Referrer-Policy"], `${method} ${path}`).toBe("no-referrer");
      expect(row!.headers["Cache-Control"], `${method} ${path}`).toBe("no-store");
    }
  });

  it("★ B-2 · invitation routes are classified by what they actually carry", () => {
    // All four were `["tin"]`, which none of them carries. An assertion
    // written against the truth (`toContain("email")`) would have gone red for
    // a reason nobody could explain — and the likely repair is to weaken the
    // assertion rather than fix the table.
    expect(responseHeaderPolicyFor("POST", "/orgs/{orgId}/invitations")!.carries).toEqual(
      expect.arrayContaining(["token", "email"]),
    );
    expect(
      responseHeaderPolicyFor("POST", "/orgs/{orgId}/invitations/{invitationId}/link")!.carries,
    ).toEqual(expect.arrayContaining(["token", "email"]));
    expect(responseHeaderPolicyFor("GET", "/orgs/{orgId}/invitations")!.carries).toContain("email");
    expect(
      responseHeaderPolicyFor("DELETE", "/orgs/{orgId}/invitations/{invitationId}")!.carries,
    ).toContain("email");
  });

  it("★ the two routes that carry an email are classified as carrying one", () => {
    // The §3.7 row includes `email`, and `PATCH` answers with that same row —
    // the classification follows the SHAPE, not the section number.
    for (const [method, path] of [
      ["GET", "/orgs/{orgId}/members"],
      ["PATCH", "/orgs/{orgId}/members/{userId}"],
    ] as const) {
      expect(responseHeaderPolicyFor(method, path)!.carries).toContain("email");
    }
    expect(RESPONSE_HEADER_POLICY.length).toBeGreaterThan(0);
  });
});

describe("rate limit (architecture §8)", () => {
  it("none of the membership routes declares one — abuse control is per-action", () => {
    // §19 of api-spec lists quotas for shop creation, invitations, preview/accept
    // and the TIN reveal. Membership changes are not on that list: they are
    // already gated by `manage_members` and serialized by the org lock, and a
    // quota here would mostly punish a shop cleaning up its team.
    for (const handler of Object.values(handlers)) {
      expect(declarationOf(handler).rateLimit).toBeUndefined();
    }
  });
});
