// F-003 · T-003-B23 ★ — `@RoleWrite()` · `ROLE_WRITE_ROUTES` · `RoleWritesEnabledGuard`
// (architecture §12 "ผล" · §13.2 (ก) · api-spec §1 flag + §2 fixed check order).
//
// What this unit file proves (the int lane proves the same on the real router):
//   G3-01 (ก) the audit `@RoleWrite()` routes ↔ `ROLE_WRITE_ROUTES` is
//         set-equality and goes red in BOTH directions (fixture router);
//   the decorator carries the flag marker AND the shared `roleWrite` quota;
//   the guard refuses a role write with `503 ROLE_WRITES_DISABLED` when the
//         flag is off, passes everything else, and fails CLOSED when no flag
//         was bound at all;
//   MUT-11 the guard is registered AFTER `CapabilityGuard` and BEFORE the
//         rate-limit guard (api-spec §2: capability → flag → rate limit).
import { describe, it, expect } from "vitest";
import { APP_GUARD, Reflector } from "@nestjs/core";
import type { ExecutionContext } from "@nestjs/common";
import { DomainException } from "../domain-exception";
import { ORG_RATE_LIMIT_KEY } from "../org-rate-limit.decorator";
import { OrgRateLimitGuard } from "../org-rate-limit.guard";
import { TenancyModule } from "../../tenancy/tenancy.module";
import { OrgScopeGuard } from "../../tenancy/org-scope.guard";
import { CapabilityGuard } from "./capability.guard";
import type { RouteDeclaration } from "./route-declarations";
import { routeKey } from "./route-capabilities";
import { ROLE_WRITE_KEY, ROLE_WRITE_ROUTES, RoleWrite, auditRoleWriteRoutes } from "./role-write";
import { RoleWritesEnabledGuard } from "./role-writes-enabled.guard";

function decl(
  over: Partial<RouteDeclaration> & Pick<RouteDeclaration, "method" | "path">,
): RouteDeclaration {
  return {
    scope: "org",
    declaration: "capability",
    capability: "manage_roles",
    mutating: true,
    roleWrite: false,
    source: "FakeController.handler",
    ...over,
  } as RouteDeclaration;
}

/** A router whose role writes are exactly the table. */
const CLEAN: readonly RouteDeclaration[] = [
  ...ROLE_WRITE_ROUTES.map((r) => decl({ method: r.method, path: r.path, roleWrite: true })),
  decl({ method: "GET", path: "/orgs/{orgId}/roles/{roleId}", mutating: false }),
  decl({ method: "PATCH", path: "/orgs/{orgId}/members/{userId}", capability: "manage_members" }),
];

describe("G3-01 (ก) · @RoleWrite() routes ↔ ROLE_WRITE_ROUTES (set-equality)", () => {
  it("non-vacuity: the table is not empty and B23's POST /roles is in it", () => {
    expect(ROLE_WRITE_ROUTES.length).toBeGreaterThan(0);
    expect(ROLE_WRITE_ROUTES.map(routeKey)).toContain("POST /orgs/{orgId}/roles");
  });

  it("a router that matches the table is clean", () => {
    expect(auditRoleWriteRoutes(CLEAN)).toEqual({ missingDecorator: [], notInTable: [] });
  });

  it("RED (table → router): a listed role write that forgot @RoleWrite()", () => {
    const router = CLEAN.map((r) =>
      routeKey(r) === "POST /orgs/{orgId}/roles" ? { ...r, roleWrite: false } : r,
    );
    expect(auditRoleWriteRoutes(router).missingDecorator).toEqual(["POST /orgs/{orgId}/roles"]);
  });

  it("RED (table → router): a listed role write with no route at all", () => {
    const router = CLEAN.filter((r) => routeKey(r) !== "POST /orgs/{orgId}/roles");
    expect(auditRoleWriteRoutes(router).missingDecorator).toEqual(["POST /orgs/{orgId}/roles"]);
  });

  it("RED (router → table): a @RoleWrite() route the table does not list", () => {
    const router = [
      ...CLEAN,
      decl({ method: "POST", path: "/orgs/{orgId}/roles/{roleId}/clone", roleWrite: true }),
    ];
    expect(auditRoleWriteRoutes(router).notInTable).toEqual([
      "POST /orgs/{orgId}/roles/{roleId}/clone",
    ]);
  });

  it("table rows are literal, upper-case, api-spec dialect (no regex, no :param)", () => {
    for (const row of ROLE_WRITE_ROUTES) {
      expect(row.method).toBe(row.method.toUpperCase());
      expect(row.path).not.toMatch(/:|\*|\(/);
      expect(row.path.startsWith("/orgs/{orgId}/roles")).toBe(true);
    }
  });
});

describe("@RoleWrite() — one decorator, both halves", () => {
  class Probe {
    @RoleWrite()
    create(): void {}
  }
  const handler = Object.getOwnPropertyDescriptor(Probe.prototype, "create")!.value as object;

  it("marks the handler for RoleWritesEnabledGuard", () => {
    expect(Reflect.getMetadata(ROLE_WRITE_KEY, handler)).toBe(true);
  });

  it("applies the SHARED `roleWrite` quota (architecture §10: POST/PATCH/DELETE role together)", () => {
    expect(Reflect.getMetadata(ORG_RATE_LIMIT_KEY, handler)).toBe("roleWrite");
  });
});

function contextFor(handler: object): ExecutionContext {
  class Holder {}
  return {
    getHandler: () => handler,
    getClass: () => Holder,
  } as unknown as ExecutionContext;
}

describe("RoleWritesEnabledGuard — 503 ROLE_WRITES_DISABLED (architecture §12)", () => {
  class Routes {
    @RoleWrite()
    write(): void {}
    read(): void {}
  }
  const write = Object.getOwnPropertyDescriptor(Routes.prototype, "write")!.value as object;
  const read = Object.getOwnPropertyDescriptor(Routes.prototype, "read")!.value as object;
  const reflector = new Reflector();

  it("★ flag off + role write → 503 ROLE_WRITES_DISABLED", () => {
    const guard = new RoleWritesEnabledGuard(reflector, false);
    let caught: unknown;
    try {
      guard.canActivate(contextFor(write));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(DomainException);
    expect((caught as DomainException).code).toBe("ROLE_WRITES_DISABLED");
    expect((caught as DomainException).getStatus()).toBe(503);
  });

  it("flag on + role write → passes", () => {
    expect(new RoleWritesEnabledGuard(reflector, true).canActivate(contextFor(write))).toBe(true);
  });

  it("flag off + any other route → passes (the flag gates Role writes only — §12 'ครอบอะไร')", () => {
    expect(new RoleWritesEnabledGuard(reflector, false).canActivate(contextFor(read))).toBe(true);
  });

  it("no flag bound at all → CLOSED (undefined is not 'enabled')", () => {
    const guard = new RoleWritesEnabledGuard(reflector, undefined);
    expect(() => guard.canActivate(contextFor(write))).toThrow(DomainException);
  });

  it("only the literal `true` opens it (a truthy non-boolean is a mis-wiring)", () => {
    const guard = new RoleWritesEnabledGuard(reflector, "true" as unknown as boolean);
    expect(() => guard.canActivate(contextFor(write))).toThrow(DomainException);
  });
});

describe("★ MUT-11 · guard order: OrgScope → Capability → RoleWritesEnabled → OrgRateLimit", () => {
  it("TenancyModule registers the four APP_GUARDs in exactly this order", () => {
    const providers = (Reflect.getMetadata("providers", TenancyModule) ?? []) as Array<{
      provide?: unknown;
      useClass?: unknown;
    }>;
    const guards = providers.filter((p) => p.provide === APP_GUARD).map((p) => p.useClass);
    expect(guards).toEqual([
      OrgScopeGuard,
      CapabilityGuard,
      RoleWritesEnabledGuard,
      OrgRateLimitGuard,
    ]);
  });
});
