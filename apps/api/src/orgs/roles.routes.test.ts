// F-003 · T-003-B21 — what the role READ routes DECLARE (api-spec §1), read off
// the decorators so a dropped `@RequireCapability` is red with no database.
// The live-router versions are the route-registry / parity int audits.
import { describe, it, expect } from "vitest";
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { RequestMethod } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { CAPABILITY_MANAGE_ROLES } from "@omnistock/core-domain";
import {
  ANY_ACTIVE_MEMBER_KEY,
  CAPABILITY_KEY,
  ROLE_WRITE_KEY,
  ROUTE_CAPABILITIES,
  routeKey,
  toTemplatePath,
} from "../common/authz";
import { ROUTE_SCOPE_KEY } from "../tenancy";
import { RoleDesignController, RolesController } from "./roles.controller";
import { responseHeaderPolicyFor } from "./response-headers";

const reflector = new Reflector();
const read = (key: string, target: object) => reflector.get(key, target as never);

const ROUTES = [
  [
    "GET /orgs/{orgId}/capabilities",
    RoleDesignController,
    RoleDesignController.prototype.capabilities,
  ],
  [
    "GET /orgs/{orgId}/role-details",
    RoleDesignController,
    RoleDesignController.prototype.roleDetails,
  ],
  ["GET /orgs/{orgId}/roles/{roleId}", RolesController, RolesController.prototype.detail],
] as const;

describe("T-003-B21 role READ routes — declarations", () => {
  it.each(ROUTES)(
    "%s → @RequireCapability(manage_roles), org-scoped, no-store policy row",
    (key, controller, handler) => {
      const sub = Reflect.getMetadata(PATH_METADATA, handler) as string;
      const base = Reflect.getMetadata(PATH_METADATA, controller) as string;
      expect(routeKey({ method: "GET", path: toTemplatePath(`/${base}/${sub}`) })).toBe(key);
      expect(read(CAPABILITY_KEY, handler)).toBe(CAPABILITY_MANAGE_ROLES);
      expect(read(ANY_ACTIVE_MEMBER_KEY, handler)).toBeUndefined();
      expect(read(ROUTE_SCOPE_KEY, handler)).toBeUndefined();
      expect(ROUTE_CAPABILITIES.find((r) => routeKey(r) === key)?.capability).toBe(
        CAPABILITY_MANAGE_ROLES,
      );
      expect(responseHeaderPolicyFor("GET", key.slice(4))?.headers["Cache-Control"]).toBe(
        "no-store",
      );
    },
  );

  it("nothing is declared on either CLASS (High-1)", () => {
    for (const c of [RoleDesignController, RolesController]) {
      expect(read(CAPABILITY_KEY, c)).toBeUndefined();
      expect(read(ANY_ACTIVE_MEMBER_KEY, c)).toBeUndefined();
      expect(read(ROUTE_SCOPE_KEY, c)).toBeUndefined();
    }
  });

  it("GET /roles stays @AnyActiveMember() — the detail route did not change its tier", () => {
    expect(read(ANY_ACTIVE_MEMBER_KEY, RolesController.prototype.list)).toBe(true);
    expect(read(CAPABILITY_KEY, RolesController.prototype.list)).toBeUndefined();
  });
});

// F-003 · T-003-B25 — what DELETE /roles/{roleId} DECLARES: manage_roles + the
// role-write marker (flag + shared roleWrite quota), org-scoped, no-store, and
// NO JsonOnlyGuard — the route takes no body (api-spec §2), so a client that
// sends no Content-Type must not get 415.
describe("T-003-B25 DELETE /orgs/{orgId}/roles/{roleId} — declarations", () => {
  const handler = RolesController.prototype.remove;

  it("routes to DELETE :roleId under the roles controller", () => {
    const sub = Reflect.getMetadata(PATH_METADATA, handler) as string;
    const base = Reflect.getMetadata(PATH_METADATA, RolesController) as string;
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.DELETE);
    expect(toTemplatePath(`/${base}/${sub}`)).toBe("/orgs/{orgId}/roles/{roleId}");
  });

  it("@RequireCapability(manage_roles) + @RoleWrite() — no AnyActiveMember, not user-scoped", () => {
    expect(read(CAPABILITY_KEY, handler)).toBe(CAPABILITY_MANAGE_ROLES);
    expect(read(ROLE_WRITE_KEY, handler)).toBe(true);
    expect(read(ANY_ACTIVE_MEMBER_KEY, handler)).toBeUndefined();
    expect(read(ROUTE_SCOPE_KEY, handler)).toBeUndefined();
    expect(
      ROUTE_CAPABILITIES.find((r) => routeKey(r) === "DELETE /orgs/{orgId}/roles/{roleId}")
        ?.capability,
    ).toBe(CAPABILITY_MANAGE_ROLES);
  });

  it("no JsonOnlyGuard (no body) — POST/PATCH keep theirs", () => {
    const guards = (h: object) =>
      ((Reflect.getMetadata(GUARDS_METADATA, h) as unknown[]) ?? []).map(
        (g) => (g as { name?: string }).name,
      );
    expect(guards(handler)).not.toContain("JsonOnlyGuard");
    expect(guards(RolesController.prototype.create)).toContain("JsonOnlyGuard");
    expect(guards(RolesController.prototype.update)).toContain("JsonOnlyGuard");
  });

  it("has a no-store response-header policy row", () => {
    expect(
      responseHeaderPolicyFor("DELETE", "/orgs/{orgId}/roles/{roleId}")?.headers["Cache-Control"],
    ).toBe("no-store");
  });
});
