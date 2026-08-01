// F-002 · T-002-04 — "which tier is this route?", answered in MIDDLEWARE.
//
// THE PROBLEM THIS SOLVES
// §1.3 puts three things in the middleware: verify the bearer, resolve the org,
// establish the ALS context. It must be the middleware, because only a
// middleware's `next()` continuation wraps the rest of the request (a guard
// returns a boolean; an ALS scope entered inside `canActivate` is gone before
// the handler runs) — and since T-002-03 the storage lives in `packages/db`
// (`runWithOrgContext`), which has no `enterWith`-style escape hatch. But I-3
// says a `@Public()`/`@UserScoped()` route must get NO context, and middleware
// has no `ExecutionContext`, hence no `Reflector`, hence no decorators.
//
// So the tier is read from Nest's own route metadata at runtime: controllers →
// handlers → (PATH_METADATA, METHOD_METADATA, ROUTE_SCOPE_KEY), compiled into
// method+path matchers. Matching also yields `:orgId` (§1.2 source 2) without
// guessing at URL shapes.
//
// FAIL-CLOSED BY CONSTRUCTION: this registry is only ever an ASSUMPTION. The
// guard re-derives the tier from the decorators with `Reflector` (the authority)
// and refuses the request outright if the two disagree, so a matching bug can
// only ever produce a loud 500 — never a request served against the wrong tier.
// A route it cannot represent (wildcards) is reported `unknown`, which means "no
// context was created", which again can only fail loudly at the guard.
import { Inject, Injectable, RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { DiscoveryService, MetadataScanner, Reflector } from "@nestjs/core";
import { ROUTE_SCOPE_KEY, type RouteScope } from "./route-scope.decorator";

/** A route's tier as this registry sees it — `"org"` is the default (§1.1). */
export type RegisteredScope = RouteScope | "org";

interface CompiledRoute {
  /** `RequestMethod.ALL` matches every verb. */
  readonly method: RequestMethod;
  readonly pattern: RegExp;
  readonly paramNames: readonly string[];
  readonly scope: RegisteredScope;
  /** `Controller.handler`, for debugging only. */
  readonly source: string;
}

export interface RouteScopeMatch {
  readonly scope: RegisteredScope;
  readonly params: Readonly<Record<string, string>>;
}

@Injectable()
export class RouteScopeRegistry {
  private compiled?: CompiledRoute[];

  // Explicit @Inject — see the note in org-context.middleware.ts.
  constructor(
    @Inject(DiscoveryService) private readonly discovery: DiscoveryService,
    @Inject(MetadataScanner) private readonly scanner: MetadataScanner,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  /**
   * The tier + path params of the route serving `method path`, or `undefined`
   * when no route (or more than one route, disagreeing) matches.
   */
  match(method: string, path: string): RouteScopeMatch | undefined {
    const routes = (this.compiled ??= this.build());
    const verb = method.toUpperCase();
    const pathname = normalizePath(path);

    let found: RouteScopeMatch | undefined;
    for (const route of routes) {
      if (!methodMatches(route.method, verb)) continue;
      const m = route.pattern.exec(pathname);
      if (!m) continue;
      const params: Record<string, string> = {};
      route.paramNames.forEach((name, i) => {
        const value = m[i + 1];
        if (value !== undefined) params[name] = decodeParam(value);
      });
      // Two different routes claiming the same request with DIFFERENT tiers is
      // ambiguity we refuse to resolve — report "no match" so no context is
      // created and the guard fails loudly.
      if (found && found.scope !== route.scope) return undefined;
      found ??= { scope: route.scope, params };
    }
    return found;
  }

  /** Every registered route + its tier. Exists for tests/diagnostics. */
  list(): readonly { method: string; source: string; scope: RegisteredScope }[] {
    return (this.compiled ??= this.build()).map((r) => ({
      method: RequestMethod[r.method] ?? String(r.method),
      source: r.source,
      scope: r.scope,
    }));
  }

  private build(): CompiledRoute[] {
    const routes: CompiledRoute[] = [];
    for (const wrapper of this.discovery.getControllers()) {
      const instance = wrapper.instance as object | undefined;
      const metatype = wrapper.metatype as (new (...args: never[]) => unknown) | undefined;
      if (!instance || !metatype) continue;

      const controllerPaths = toPaths(Reflect.getMetadata(PATH_METADATA, metatype));
      const classScope = this.reflector.get<RouteScope | undefined>(ROUTE_SCOPE_KEY, metatype);
      const prototype = Object.getPrototypeOf(instance) as Record<string, unknown>;

      for (const methodName of this.scanner.getAllMethodNames(prototype)) {
        const handler = prototype[methodName];
        if (typeof handler !== "function") continue;
        const requestMethod = Reflect.getMetadata(METHOD_METADATA, handler) as
          | RequestMethod
          | undefined;
        if (requestMethod === undefined) continue; // not a route handler

        const handlerScope = this.reflector.get<RouteScope | undefined>(ROUTE_SCOPE_KEY, handler);
        const scope: RegisteredScope = handlerScope ?? classScope ?? "org";

        for (const controllerPath of controllerPaths) {
          for (const handlerPath of toPaths(Reflect.getMetadata(PATH_METADATA, handler))) {
            const compiled = compilePath(joinPaths(controllerPath, handlerPath));
            if (!compiled) continue; // unrepresentable (wildcard) → stays unknown
            routes.push({
              method: requestMethod,
              pattern: compiled.pattern,
              paramNames: compiled.paramNames,
              scope,
              source: `${metatype.name}.${methodName}`,
            });
          }
        }
      }
    }
    return routes;
  }
}

function toPaths(meta: unknown): string[] {
  if (Array.isArray(meta)) return meta.filter((p): p is string => typeof p === "string");
  if (typeof meta === "string") return [meta];
  return ["/"];
}

function joinPaths(a: string, b: string): string {
  return `/${[a, b].join("/")}`.replace(/\/+/g, "/");
}

/** `/orgs/:orgId/members` → anchored regex + ordered param names. */
function compilePath(path: string): { pattern: RegExp; paramNames: string[] } | undefined {
  const segments = normalizePath(path).split("/").filter(Boolean);
  const paramNames: string[] = [];
  const parts: string[] = [];
  for (const segment of segments) {
    // Wildcards (`*`, `*splat`, `{*splat}`) cannot be represented as a single
    // segment; refusing them is what keeps "unknown ⇒ no context" honest.
    if (segment.includes("*") || segment.includes("{")) return undefined;
    if (segment.startsWith(":")) {
      paramNames.push(segment.slice(1));
      parts.push("([^/]+)");
      continue;
    }
    parts.push(escapeRegExp(segment));
  }
  return { pattern: new RegExp(`^/${parts.join("/")}/?$`), paramNames };
}

function methodMatches(method: RequestMethod, verb: string): boolean {
  if (method === RequestMethod.ALL) return true;
  return RequestMethod[method] === verb;
}

/** Strips the query string and collapses duplicate/trailing slashes. */
export function normalizePath(path: string): string {
  const [pathname = ""] = path.split("?");
  const collapsed = `/${pathname}`.replace(/\/+/g, "/");
  return collapsed.length > 1 ? collapsed.replace(/\/$/, "") : "/";
}

function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
