// F-002 · T-002-05 ★ — "what did every route actually declare?", read off the
// live Nest router (architecture §2.3 item 5, §12.2 item 4; test-plan I-02/G-13).
//
// The guard makes forgetting fail at RUNTIME. This makes it fail in CI, which is
// the half that catches the route nobody happened to call in a test. @qa builds
// I-02 (every org-scoped route — including `GET`/`HEAD` — declares something)
// and G-13 (`@AnyActiveMember()` routes match the pinned allowlist, per tier) on
// top of this, so the enumeration lives in production code and is imported, not
// re-implemented inside the suite.
//
// It reports the DECLARATION, never a verdict: `conflict` is surfaced as its own
// kind instead of being resolved, because a caller of this function that had to
// guess would be re-implementing the guard.
import { RequestMethod, type INestApplication } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { DiscoveryService, MetadataScanner, Reflector } from "@nestjs/core";
import { ROUTE_SCOPE_KEY, type RouteScope } from "../../tenancy/route-scope.decorator";
import { ANY_ACTIVE_MEMBER_KEY, CAPABILITY_KEY } from "./capability.decorator";
import { isMutatingMethod, toTemplatePath } from "./route-capabilities";

/** How a route declared its authorization — `none` is the failure I-2 hunts. */
export type RouteDeclarationKind = "capability" | "any-active-member" | "conflict" | "none";

export interface RouteDeclaration {
  /** Upper-case HTTP verb (`ALL` when the handler answers every verb). */
  readonly method: string;
  /** api-spec dialect: `/orgs/{orgId}/members/{userId}`. */
  readonly path: string;
  /** Tier — `org` is the default (§1.1). */
  readonly scope: RouteScope | "org";
  readonly declaration: RouteDeclarationKind;
  /** Present only for `declaration === "capability"`. */
  readonly capability?: string;
  /** True for POST/PUT/PATCH/DELETE — lets I-02 count read vs mutating apart. */
  readonly mutating: boolean;
  /** `Controller.handler` — so a red test names the file to open. */
  readonly source: string;
}

/**
 * Every route the application registered, with the authorization it declares.
 *
 * `strict: false` (the default for `app.get`) resolves `DiscoveryService` from
 * whichever module imported `DiscoveryModule` — `TenancyModule` does.
 */
export function enumerateRoutes(app: INestApplication): readonly RouteDeclaration[] {
  const discovery = app.get(DiscoveryService, { strict: false });
  const reflector = new Reflector();
  const scanner = new MetadataScanner();
  const routes: RouteDeclaration[] = [];

  for (const wrapper of discovery.getControllers()) {
    const instance = wrapper.instance as object | undefined;
    const metatype = wrapper.metatype as (new (...args: never[]) => unknown) | undefined;
    if (!instance || !metatype) continue;

    const controllerPaths = toPaths(Reflect.getMetadata(PATH_METADATA, metatype));
    const classScope = reflector.get<RouteScope | undefined>(ROUTE_SCOPE_KEY, metatype);
    const classDeclaration = declarationOf(reflector, metatype);
    const prototype = Object.getPrototypeOf(instance) as Record<string, unknown>;

    for (const methodName of scanner.getAllMethodNames(prototype)) {
      const handler = prototype[methodName];
      if (typeof handler !== "function") continue;
      const requestMethod = Reflect.getMetadata(METHOD_METADATA, handler) as
        | RequestMethod
        | undefined;
      if (requestMethod === undefined) continue; // not a route handler

      const handlerScope = reflector.get<RouteScope | undefined>(ROUTE_SCOPE_KEY, handler);
      const declaredScope = handlerScope ?? classScope;
      const handlerDeclaration = declarationOf(reflector, handler);
      // Handler overrides class — the same resolution CapabilityGuard performs.
      const declaration =
        handlerDeclaration.declaration === "none" ? classDeclaration : handlerDeclaration;
      const method = RequestMethod[requestMethod] ?? String(requestMethod);

      for (const controllerPath of controllerPaths) {
        for (const handlerPath of toPaths(Reflect.getMetadata(PATH_METADATA, handler))) {
          const path = toTemplatePath(`${controllerPath}/${handlerPath}`);
          routes.push({
            method,
            path,
            scope: declaredScope ?? "org",
            ...declaration,
            mutating: isMutatingMethod(method),
            source: `${metatype.name}.${methodName}`,
          });
        }
      }
    }
  }
  return routes;
}

function declarationOf(
  reflector: Reflector,
  target: Parameters<Reflector["get"]>[1],
): { declaration: RouteDeclarationKind; capability?: string } {
  const capability = reflector.get<unknown>(CAPABILITY_KEY, target);
  const anyActiveMember = reflector.get<unknown>(ANY_ACTIVE_MEMBER_KEY, target) === true;
  if (capability !== undefined && anyActiveMember) return { declaration: "conflict" };
  if (typeof capability === "string" && capability.trim() !== "") {
    return { declaration: "capability", capability };
  }
  if (capability !== undefined) return { declaration: "conflict" }; // malformed = not a declaration
  if (anyActiveMember) return { declaration: "any-active-member" };
  return { declaration: "none" };
}

function toPaths(meta: unknown): string[] {
  if (Array.isArray(meta)) return meta.filter((p): p is string => typeof p === "string");
  if (typeof meta === "string") return [meta];
  return ["/"];
}
