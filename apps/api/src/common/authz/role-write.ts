// F-003 · T-003-B23 ★ — `@RoleWrite()` + `ROLE_WRITE_ROUTES` (architecture §12 "ผล" ·
// §13.2 (ก) · api-spec §1).
//
// ONE decorator marks a handler as "writes a Role" and does the two things every
// such route needs, so neither can be forgotten on its own:
//   1. the `ROLE_WRITE_KEY` marker `RoleWritesEnabledGuard` reads (flag off ⇒ 503);
//   2. the SHARED `roleWrite` quota (architecture §10: POST/PATCH/DELETE role
//      together, 60/h per shop).
// Capability (`manage_roles`) stays declared separately with
// `@RequireCapability`, so the route registry (I-02) still sees it.
//
// `ROLE_WRITE_ROUTES` is the literal table G3-01 compares the live router with
// (set-equality, both directions). Rows land with the route that serves them
// (Q-T1): B23 = POST, B24 = PATCH, B25 = DELETE.
import { SetMetadata, applyDecorators } from "@nestjs/common";
import { OrgRateLimit } from "../org-rate-limit.decorator";
import type { RouteDeclaration } from "./route-declarations";
import { routeKey } from "./route-capabilities";

/** Reflector key carrying the role-write marker. */
export const ROLE_WRITE_KEY = "omnistock:role-write";

/** Mark a handler as a Role write — flag-guarded and on the `roleWrite` quota. */
export const RoleWrite = (): MethodDecorator =>
  applyDecorators(SetMetadata(ROLE_WRITE_KEY, true), OrgRateLimit("roleWrite"));

export interface RoleWriteRoute {
  readonly method: string;
  readonly path: string;
}

/** Every route that writes `Role` (api-spec dialect, literal rows — never a pattern). */
export const ROLE_WRITE_ROUTES: readonly RoleWriteRoute[] = Object.freeze([
  Object.freeze({ method: "POST", path: "/orgs/{orgId}/roles" }),
]);

export interface RoleWriteAudit {
  /** In the table, but no live route carries `@RoleWrite()` (or no route at all). */
  readonly missingDecorator: readonly string[];
  /** Carries `@RoleWrite()`, but the table does not list it. */
  readonly notInTable: readonly string[];
}

/** G3-01 (ก) — the router's `@RoleWrite()` routes vs the table. Pure; both directions. */
export function auditRoleWriteRoutes(
  routes: readonly Pick<RouteDeclaration, "method" | "path" | "roleWrite">[],
  table: readonly RoleWriteRoute[] = ROLE_WRITE_ROUTES,
): RoleWriteAudit {
  const live = new Set(routes.filter((r) => r.roleWrite).map(routeKey));
  const listed = new Set(table.map(routeKey));
  return {
    missingDecorator: [...listed].filter((k) => !live.has(k)).sort(),
    notInTable: [...live].filter((k) => !listed.has(k)).sort(),
  };
}
