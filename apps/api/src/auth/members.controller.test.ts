// F-002 · T-002-13 — where the route-tier mark is ALLOWED to sit.
//
// Written after the security review of f66451f (High-1) caught `@UserScoped()`
// on the `MembersController` CLASS. Nothing was broken at the time — the
// controller had exactly one handler — but the prefix
// `/orgs/:orgId/members/:userId` is precisely where `PATCH` and `DELETE` member
// land in T-002-18, and `ROUTE_CAPABILITIES` already declares both as
// `manage_members` routes.
//
// A sibling handler added to that class would have INHERITED the class mark,
// and then both guards step aside: `OrgScopeGuard`'s `user` branch checks only
// that a token is valid, and `CapabilityGuard` returns early for any declared
// tier. Any logged-in user could have changed roles or revoked members in any
// organization. Default-deny does not catch it, because the class DID declare a
// tier — the failure mode is a correct-looking annotation in the wrong place.
//
// So the rule is structural, not a matter of remembering: on a controller whose
// path carries an org parameter, the tier belongs on the HANDLER. Then a new
// sibling inherits nothing, falls back to org-scoped, and fails closed.
import { describe, it, expect } from "vitest";
import { PATH_METADATA } from "@nestjs/common/constants";
import { ROUTE_SCOPE_KEY } from "../tenancy/route-scope.decorator";
import { MembersController } from "./members.controller";
import { AuthController } from "./auth.controller";
import { HealthController } from "../health/health.controller";

/** Controllers this app declares, paired with the file that owns them. */
const CONTROLLERS = [MembersController, AuthController, HealthController];

function controllerPaths(target: object): string[] {
  const raw: unknown = Reflect.getMetadata(PATH_METADATA, target);
  return (Array.isArray(raw) ? raw : [raw ?? "/"]).map(String);
}

function classScope(target: object): string | undefined {
  return Reflect.getMetadata(ROUTE_SCOPE_KEY, target) as string | undefined;
}

function handlerScope(target: { prototype: object }, method: string): string | undefined {
  const handler = (target.prototype as Record<string, unknown>)[method];
  return typeof handler === "function"
    ? (Reflect.getMetadata(ROUTE_SCOPE_KEY, handler) as string | undefined)
    : undefined;
}

describe("route-tier marks are placed where a new sibling cannot inherit them", () => {
  it("no controller whose path carries :orgId declares a tier at CLASS level", () => {
    const offenders = CONTROLLERS.filter(
      (c) => controllerPaths(c).some((p) => p.includes(":orgId")) && classScope(c) !== undefined,
    ).map((c) => `${c.name} (@${classScope(c)})`);

    // If this fails, the fix is to move the decorator onto each handler — not
    // to add the controller to an exception list. The whole value of the rule
    // is that it holds without anyone having to notice.
    expect(offenders).toEqual([]);
  });

  it("MembersController marks reset-password on the handler, and the class not at all", () => {
    expect(classScope(MembersController)).toBeUndefined();
    expect(handlerScope(MembersController, "resetPassword")).toBe("user");
  });

  it("class-level marks are still fine where the path has no org parameter", () => {
    // The rule is about inheritance reaching an org-scoped sibling — not about
    // class-level marks being wrong in general. `/auth/*` is genuinely public
    // as a whole, and a future `/auth/...` endpoint SHOULD inherit that.
    expect(controllerPaths(AuthController).some((p) => p.includes(":orgId"))).toBe(false);
    expect(classScope(AuthController)).toBe("public");
    expect(classScope(HealthController)).toBe("public");
  });
});
