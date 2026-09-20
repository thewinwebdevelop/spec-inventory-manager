// F-002 · T-002-22 — the route-registry audit (test-plan I-02 / G-13,
// architecture §12.2 item 4 and item 7).
//
// WHAT IT IS FOR
// `CapabilityGuard` already makes "forgot to declare" fail at RUNTIME. That
// catches the route somebody actually calls. This catches the route nobody
// happened to write a test for: it walks the LIVE Nest router via
// `enumerateRoutes(app)` and compares it, row by row, with the two production
// tables (`ROUTE_CAPABILITIES`, `ANY_ACTIVE_MEMBER_ROUTES`).
//
// It imports both tables from production and re-declares NEITHER. A table
// re-typed inside the suite proves only that the suite agrees with itself.
//
// TWO DIRECTIONS, DELIBERATELY SEPARATE
//   router → table  (`declaration`, `capabilityMismatch`, `notAllowlisted`,
//                    `wrongTier`) — a NEW endpoint that forgot/mis-stated its
//                    declaration. Fatal from day one.
//   table  → router (`pending`) — a table row with no live route. Today that is
//                    every F-002 endpoint, because the controllers land in later
//                    waves; it is reported but not fatal unless the caller asks
//                    (`failOnPending`), which is what the wave that ships the
//                    controllers turns on. Meta-test proves the flag goes red.
//
// `HEAD` (T-002-13): express answers HEAD from the `@Get()` handler, so a HEAD
// row must be looked up against its GET row — `capabilityLookupMethod()` from
// production does that, and this kit calls it rather than reimplementing the
// rule (a second copy could drift to the weaker of the two).
import type { INestApplication } from "@nestjs/common";
import {
  ANY_ACTIVE_MEMBER_ROUTES,
  ROUTE_CAPABILITIES,
  enumerateRoutes,
  isMutatingMethod,
  routeKey,
  type RouteDeclaration,
} from "../src/common/authz";
import { capabilityLookupMethod } from "../src/common/authz/route-capabilities";

/** Path prefixes the audit ignores. Test fixtures live under `/__test__`. */
export const DEFAULT_IGNORED_PATH_PREFIXES: readonly string[] = Object.freeze(["/__test__"]);

export interface RouteRegistryAuditOptions {
  /** Prefixes to skip. Defaults to {@link DEFAULT_IGNORED_PATH_PREFIXES}. */
  readonly ignorePathPrefixes?: readonly string[];
}

/** One thing that is wrong, with the file to open. */
export interface RouteRegistryFinding {
  readonly kind:
    | "undeclared"
    | "conflict"
    | "capability-mismatch"
    | "not-allowlisted"
    | "wrong-tier"
    | "pending";
  readonly route: string;
  readonly source: string;
  readonly message: string;
}

export interface RouteRegistryReport {
  /** Every enumerated route, after prefix filtering. */
  readonly routes: readonly RouteDeclaration[];
  /** The org-scoped subset — the only tier that must declare authorization. */
  readonly orgScoped: readonly RouteDeclaration[];
  /** Org-scoped routes declaring nothing (I-02). */
  readonly undeclared: readonly RouteRegistryFinding[];
  /** Both markers on one target — the guard 500s on these. */
  readonly conflicts: readonly RouteRegistryFinding[];
  /** Declared capability ≠ the capability `ROUTE_CAPABILITIES` states. */
  readonly capabilityMismatch: readonly RouteRegistryFinding[];
  /** `@AnyActiveMember()` on a route missing from the pinned allowlist (G-13). */
  readonly notAllowlisted: readonly RouteRegistryFinding[];
  /** Allowlisted under the wrong tier (a mutating route filed under `read`). */
  readonly wrongTier: readonly RouteRegistryFinding[];
  /** Table rows with no live route (table → router direction). */
  readonly pending: readonly RouteRegistryFinding[];
  /** Everything except `pending`, flattened. */
  readonly problems: readonly RouteRegistryFinding[];
}

/** Convenience: enumerate the live router of `app` and audit it. */
export function auditApp(
  app: INestApplication,
  options: RouteRegistryAuditOptions = {},
): RouteRegistryReport {
  return auditRouteRegistry(enumerateRoutes(app), options);
}

/**
 * Audit an enumeration. Takes the ROUTES (not the app) so the meta-test can feed
 * it a deliberately broken router without having to build a broken application.
 */
export function auditRouteRegistry(
  routes: readonly RouteDeclaration[],
  options: RouteRegistryAuditOptions = {},
): RouteRegistryReport {
  const ignored = options.ignorePathPrefixes ?? DEFAULT_IGNORED_PATH_PREFIXES;
  const kept = routes.filter((r) => !ignored.some((prefix) => r.path.startsWith(prefix)));
  const orgScoped = kept.filter((r) => r.scope === "org");

  const undeclared: RouteRegistryFinding[] = [];
  const conflicts: RouteRegistryFinding[] = [];
  const capabilityMismatch: RouteRegistryFinding[] = [];
  const notAllowlisted: RouteRegistryFinding[] = [];
  const wrongTier: RouteRegistryFinding[] = [];

  const allowlist = new Map<string, "mutating" | "read">();
  for (const row of ANY_ACTIVE_MEMBER_ROUTES.mutating) allowlist.set(routeKey(row), "mutating");
  for (const row of ANY_ACTIVE_MEMBER_ROUTES.read) allowlist.set(routeKey(row), "read");

  const capabilityTable = new Map(ROUTE_CAPABILITIES.map((row) => [routeKey(row), row.capability]));
  const seenInRouter = new Set<string>();

  for (const route of orgScoped) {
    // HEAD resolves to its GET row — never to a weaker row of its own.
    const key = `${capabilityLookupMethod(route.method)} ${route.path}`;
    seenInRouter.add(key);
    const label = `${route.method} ${route.path}`;

    switch (route.declaration) {
      case "none":
        undeclared.push({
          kind: "undeclared",
          route: label,
          source: route.source,
          message:
            `org-scoped route declares neither @RequireCapability(...) nor ` +
            `@AnyActiveMember() — the guard refuses it at runtime (I-02)`,
        });
        break;

      case "conflict":
        conflicts.push({
          kind: "conflict",
          route: label,
          source: route.source,
          message:
            `both authorization markers on the same target (or a malformed ` +
            `@RequireCapability) — CapabilityGuard answers 500, pick one`,
        });
        break;

      case "capability": {
        const expected = capabilityTable.get(key);
        if (expected === undefined) {
          capabilityMismatch.push({
            kind: "capability-mismatch",
            route: label,
            source: route.source,
            message:
              `declares @RequireCapability(${String(route.capability)}) but has NO row in ` +
              `ROUTE_CAPABILITIES — the table is the contract with api-spec §2`,
          });
        } else if (expected !== route.capability) {
          capabilityMismatch.push({
            kind: "capability-mismatch",
            route: label,
            source: route.source,
            message:
              `declares ${String(route.capability)} but ROUTE_CAPABILITIES says ${expected}`,
          });
        }
        break;
      }

      case "any-active-member": {
        const tier = allowlist.get(key);
        if (tier === undefined) {
          notAllowlisted.push({
            kind: "not-allowlisted",
            route: label,
            source: route.source,
            message:
              `wears @AnyActiveMember() but is absent from ANY_ACTIVE_MEMBER_ROUTES — ` +
              `the weakest layer of a default-deny system must be a pinned list (G-13)`,
          });
          break;
        }
        const actualTier = isMutatingMethod(route.method) ? "mutating" : "read";
        if (tier !== actualTier) {
          wrongTier.push({
            kind: "wrong-tier",
            route: label,
            source: route.source,
            message:
              `allowlisted under \`${tier}\` but ${route.method} is ${actualTier} — a ` +
              `mutating route hiding in the read tier is exactly what G-13 forbids`,
          });
        }
        break;
      }
    }
  }

  const pending: RouteRegistryFinding[] = [];
  for (const row of ROUTE_CAPABILITIES) {
    const key = routeKey(row);
    if (!seenInRouter.has(key)) {
      pending.push({
        kind: "pending",
        route: key,
        source: "ROUTE_CAPABILITIES",
        message: "declared in the capability table but no live route serves it",
      });
    }
  }
  for (const [key] of allowlist) {
    if (!seenInRouter.has(key)) {
      pending.push({
        kind: "pending",
        route: key,
        source: "ANY_ACTIVE_MEMBER_ROUTES",
        message: "allowlisted for @AnyActiveMember() but no live route serves it",
      });
    }
  }

  return {
    routes: kept,
    orgScoped,
    undeclared,
    conflicts,
    capabilityMismatch,
    notAllowlisted,
    wrongTier,
    pending,
    problems: [...undeclared, ...conflicts, ...capabilityMismatch, ...notAllowlisted, ...wrongTier],
  };
}

export interface AssertRouteRegistryOptions {
  /** Also fail on table rows with no live route (turn on once they ship). */
  readonly failOnPending?: boolean;
  /**
   * Minimum number of routes the enumeration must contain. A kit that
   * enumerates NOTHING is green forever — the single failure mode qa called the
   * most important one in the whole set (test-plan Q10 ซ). Default 1.
   */
  readonly minRoutes?: number;
}

/** Throw a single readable error listing every finding, or return silently. */
export function assertRouteRegistryClean(
  report: RouteRegistryReport,
  options: AssertRouteRegistryOptions = {},
): void {
  const minRoutes = options.minRoutes ?? 1;
  if (report.routes.length < minRoutes) {
    throw new Error(
      `route registry audit is VACUOUS: enumerated ${report.routes.length} route(s), ` +
        `expected at least ${minRoutes}. An audit over an empty router passes every ` +
        `check and proves nothing.`,
    );
  }
  const findings = options.failOnPending
    ? [...report.problems, ...report.pending]
    : report.problems;
  if (findings.length === 0) return;
  throw new Error(
    `route registry audit found ${findings.length} problem(s):\n` +
      findings.map((f) => `  [${f.kind}] ${f.route} (${f.source})\n      ${f.message}`).join("\n"),
  );
}
