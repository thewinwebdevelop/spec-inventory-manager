// F-002 · T-002-15/16 ★ — what the four org routes DECLARE.
//
// architecture §1.1 (tier) · §3.1 + NEW-3 (authorization) · §8 (rate limit) ·
// api-spec §2 (the endpoint table).
//
// These assertions read the decorators off the controller classes, so they run
// without a database or an application. The live-router version of the same
// check (@qa's route-registry kit, which compares the running app against
// `ROUTE_CAPABILITIES` byte for byte) is in `orgs.e2e.int.test.ts`; this one
// exists so a dropped decorator is caught in the unit lane too — and so the
// PATHS are compared to the contract table even on a machine with no Postgres.
import { describe, it, expect } from "vitest";
import { PATH_METADATA } from "@nestjs/common/constants";
import { Reflector } from "@nestjs/core";
import { CAPABILITY_MANAGE_ORG_SETTINGS } from "@omnistock/core-domain";
import {
  ANY_ACTIVE_MEMBER_ROUTES,
  ANY_ACTIVE_MEMBER_KEY,
  CAPABILITY_KEY,
  ROUTE_CAPABILITIES,
  routeKey,
} from "../common/authz";
import { ORG_RATE_LIMIT_KEY } from "../common/org-rate-limit.decorator";
import { ROUTE_SCOPE_KEY } from "../tenancy";
import { MyOrganizationsController } from "./my-organizations.controller";
import { OrgProfileController } from "./org-profile.controller";
import { OrganizationsController } from "./organizations.controller";

const reflector = new Reflector();

/** `Controller.handler` → the metadata the guards will read. */
function declarationOf(target: object) {
  return {
    scope: reflector.get<string | undefined>(ROUTE_SCOPE_KEY, target as never),
    capability: reflector.get<string | undefined>(CAPABILITY_KEY, target as never),
    anyActiveMember: reflector.get<boolean | undefined>(ANY_ACTIVE_MEMBER_KEY, target as never),
    rateLimit: reflector.get<string | undefined>(ORG_RATE_LIMIT_KEY, target as never),
  };
}

const handlers = {
  create: OrganizationsController.prototype.create,
  list: MyOrganizationsController.prototype.list,
  get: OrgProfileController.prototype.get,
  update: OrgProfileController.prototype.update,
};

describe("★ paths match api-spec §2 exactly", () => {
  it.each([
    [OrganizationsController, "organizations"],
    [MyOrganizationsController, "me/organizations"],
    [OrgProfileController, "orgs/:orgId"],
  ])("%s is mounted at /%s", (controller, path) => {
    expect(Reflect.getMetadata(PATH_METADATA, controller)).toBe(path);
  });

  it("★ the org-profile routes match their ROUTE_CAPABILITIES / allowlist rows", () => {
    // The rows exist already (T-002-05 wrote them from api-spec §2). If the
    // controller path drifts by one character, the capability lookup misses and
    // `CapabilityGuard` refuses the route — so the comparison is made here, on
    // the literal strings, rather than discovered at runtime.
    const template = `/${Reflect.getMetadata(PATH_METADATA, OrgProfileController)}`;
    expect(routeKey({ method: "PATCH", path: template })).toBe(
      routeKey(ROUTE_CAPABILITIES.find((r) => r.method === "PATCH" && r.path === "/orgs/{orgId}")!),
    );
    expect(routeKey({ method: "GET", path: template })).toBe(
      routeKey(ANY_ACTIVE_MEMBER_ROUTES.read.find((r) => r.path === "/orgs/{orgId}")!),
    );
  });
});

describe("★ tiers (architecture §1.1, I-3)", () => {
  it("POST /organizations is @UserScoped — no org exists yet", () => {
    expect(declarationOf(handlers.create).scope).toBe("user");
  });

  it("GET /me/organizations is @UserScoped — the question spans orgs", () => {
    expect(declarationOf(handlers.list).scope).toBe("user");
  });

  it.each([
    ["get", handlers.get],
    ["update", handlers.update],
  ])("GET/PATCH /orgs/{orgId} declare NO tier — org-scoped is the default (%s)", (_name, handler) => {
    expect(declarationOf(handler).scope).toBeUndefined();
  });

  it("★ the tier is declared on the HANDLER, never on the class (High-1)", () => {
    // A tier at class level is INHERITED by every handler added later, and the
    // inherited tier is the permissive one. `MembersController` learned this the
    // expensive way in the f66451f review.
    for (const controller of [OrganizationsController, MyOrganizationsController, OrgProfileController]) {
      expect(reflector.get(ROUTE_SCOPE_KEY, controller)).toBeUndefined();
      expect(reflector.get(CAPABILITY_KEY, controller)).toBeUndefined();
      expect(reflector.get(ANY_ACTIVE_MEMBER_KEY, controller)).toBeUndefined();
    }
  });
});

describe("★ authorization (architecture §3.1 · NEW-3)", () => {
  it("GET /orgs/{orgId} declares @AnyActiveMember()", () => {
    const declaration = declarationOf(handlers.get);
    expect(declaration.anyActiveMember).toBe(true);
    expect(declaration.capability).toBeUndefined();
  });

  it("PATCH /orgs/{orgId} declares @RequireCapability(manage_org_settings)", () => {
    const declaration = declarationOf(handlers.update);
    expect(declaration.capability).toBe(CAPABILITY_MANAGE_ORG_SETTINGS);
    expect(declaration.anyActiveMember).toBeUndefined();
  });

  it("★ no handler carries BOTH markers (the guard 500s on that)", () => {
    for (const handler of Object.values(handlers)) {
      const declaration = declarationOf(handler);
      expect(declaration.capability !== undefined && declaration.anyActiveMember === true).toBe(false);
    }
  });

  it("★ the user-scoped routes declare no capability — there is none to check", () => {
    // I-3: no org context exists on those requests, so a capability declaration
    // would be evaluated against an empty list and mean nothing.
    for (const handler of [handlers.create, handlers.list]) {
      expect(declarationOf(handler).capability).toBeUndefined();
      expect(declarationOf(handler).anyActiveMember).toBeUndefined();
    }
  });
});

describe("rate limit (architecture §8)", () => {
  it("POST /organizations declares @OrgRateLimit('createOrganization')", () => {
    expect(declarationOf(handlers.create).rateLimit).toBe("createOrganization");
  });

  it("the read routes declare none — abuse control is per-action, not blanket", () => {
    for (const handler of [handlers.list, handlers.get, handlers.update]) {
      expect(declarationOf(handler).rateLimit).toBeUndefined();
    }
  });
});
