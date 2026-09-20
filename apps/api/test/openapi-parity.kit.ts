// F-002 · T-002-21 ★ — THE ROUTER↔SPEC PARITY AUDIT.
//
// ── THE HOLE THIS CLOSES ───────────────────────────────────────────────────
// On 2026-08-05 the F-002 endpoints were serving traffic and NOT ONE of them
// appeared in `packages/contracts/openapi/openapi.yaml`. Every gate was green,
// because every gate was answering a different question:
//
//   `contracts-drift`   generated client  ↔ spec      (not: spec ↔ server)
//   `oasdiff`           spec              ↔ spec      (a path that was never in
//                                                      the spec has nothing to
//                                                      diff)
//   `route-registry.kit` router           ↔ ROUTE_CAPABILITIES  (authorization,
//                                                      a different question)
//
// So an endpoint could ship that no client could ever know about, and the way
// we found out was a frontend developer failing to find a type. Splitting
// `openapi.yaml` into `paths/*.yaml` is tidying; THIS is the part that makes
// the spec trustworthy.
//
// ── TWO DIRECTIONS, AND BOTH ARE FATAL ─────────────────────────────────────
//   router → spec  (`missingFromSpec`)   we shipped an endpoint nobody can call
//                                        from a generated client.
//   spec  → router  (`missingFromRouter`) we published an endpoint that does not
//                                        exist. A client written against it
//                                        gets a 404 at runtime, which is worse
//                                        than a compile error.
// Unlike `route-registry.kit`'s `pending`, NEITHER direction is advisory here:
// there is no wave in which "the spec is ahead of the server" is acceptable —
// the contract is the promise, not the plan.
//
// ── IT READS THE BUNDLE, ON PURPOSE ────────────────────────────────────────
// `openapi/openapi.yaml` is the artifact `openapi-typescript`, the Dart
// generator, `redocly lint` and `oasdiff` all consume. Auditing the hand-written
// `root.yaml` instead would let a stale bundle pass this gate while every
// consumer saw something else.
//
// The comparison uses the api-spec dialect (`/orgs/{orgId}/members/{userId}`) on
// both sides: `enumerateRoutes` already converts Nest's `:orgId`, and the spec
// is written that way, so no path is normalised twice or in two places.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import type { INestApplication } from "@nestjs/common";
import { enumerateRoutes, type RouteDeclaration } from "../src/common/authz";
import { capabilityLookupMethod } from "../src/common/authz/route-capabilities";

/** Path prefixes the audit ignores. Test fixtures live under `/__test__`. */
export const DEFAULT_IGNORED_PATH_PREFIXES: readonly string[] = Object.freeze(["/__test__"]);

/**
 * The OpenAPI verbs a Path Item Object may carry. `parameters` (and any `$ref`,
 * `summary`, `description`) are path-level siblings, NOT operations — listing
 * the verbs explicitly is what keeps them out, and it is a literal list rather
 * than "anything that is an object" for the same reason `ROUTE_CAPABILITIES` is
 * a literal list: a rule that adopts whatever it finds adopts mistakes too.
 */
const OPENAPI_METHODS: readonly string[] = Object.freeze([
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
]);

/** One `METHOD /path` the contract publishes. */
export interface SpecOperation {
  readonly method: string;
  readonly path: string;
  /** `operationId`, so a red test can name the operation a client would call. */
  readonly operationId?: string;
}

/** The bundled contract, relative to the monorepo root. */
const SPEC_RELATIVE_PATH = join("packages", "contracts", "openapi", "openapi.yaml");

/**
 * Resolve the bundled contract by walking UP from the current working
 * directory until the monorepo root is recognised.
 *
 * Not `import.meta.url` (`tsc -p tsconfig.test.json` compiles with a CommonJS
 * module target and rejects it) and not a hard-coded `../../../packages/…`
 * (which silently reads nothing if this file ever moves — and "the spec has no
 * operations" would then be indistinguishable from a real emptiness). Walking
 * up works from `apps/api` (vitest's root) and from the repo root alike, and
 * throws with the paths it tried when it cannot find the file.
 */
export function resolveBundledSpecPath(startDir = process.cwd()): string {
  const tried: string[] = [];
  let dir = resolve(startDir);
  for (;;) {
    const candidate = join(dir, SPEC_RELATIVE_PATH);
    tried.push(candidate);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `OpenAPI parity: could not find ${SPEC_RELATIVE_PATH} above ${startDir}. Tried:\n` +
      tried.map((p) => `  ${p}`).join("\n"),
  );
}

/**
 * Every operation published by the BUNDLED contract.
 *
 * Throws when the file yields none: an audit over an empty spec agrees with
 * every router in existence, which is the single failure mode that would make
 * this whole gate decorative (the same reason `assertRouteRegistryClean` has a
 * `minRoutes` floor).
 */
export function readSpecOperations(specPath = resolveBundledSpecPath()): readonly SpecOperation[] {
  const raw = readFileSync(specPath, "utf8");
  const doc = parseYaml(raw) as { paths?: Record<string, Record<string, unknown>> } | null;
  const paths = doc?.paths;
  if (!paths || typeof paths !== "object") {
    throw new Error(`OpenAPI parity: ${specPath} has no \`paths\` object to compare against.`);
  }

  const operations: SpecOperation[] = [];
  for (const [path, item] of Object.entries(paths)) {
    if (!item || typeof item !== "object") continue;
    if ("$ref" in item) {
      // An unresolved $ref means the file being read is a SOURCE, not a bundle.
      // Comparing against it would compare against nothing.
      throw new Error(
        `OpenAPI parity: ${specPath} still contains an unresolved $ref at "${path}" — ` +
          `point the audit at the bundled artifact (run \`pnpm --filter ` +
          `@omnistock/contracts bundle\`), never at root.yaml.`,
      );
    }
    for (const [key, operation] of Object.entries(item)) {
      if (!OPENAPI_METHODS.includes(key.toLowerCase())) continue;
      const operationId =
        operation && typeof operation === "object" && "operationId" in operation
          ? String((operation as { operationId?: unknown }).operationId)
          : undefined;
      operations.push({ method: key.toUpperCase(), path, operationId });
    }
  }

  if (operations.length === 0) {
    throw new Error(
      `OpenAPI parity: ${specPath} declares ZERO operations. An audit against an ` +
        `empty spec passes for every router and proves nothing.`,
    );
  }
  return operations;
}

/** One disagreement, with the file to open. */
export interface OpenApiParityFinding {
  readonly kind: "missing-from-spec" | "missing-from-router";
  readonly route: string;
  readonly source: string;
  readonly message: string;
}

export interface OpenApiParityReport {
  /** Every enumerated route, after prefix filtering. */
  readonly routes: readonly RouteDeclaration[];
  /** Every operation the contract publishes. */
  readonly operations: readonly SpecOperation[];
  /** Live route with no operation in the contract (router → spec). */
  readonly missingFromSpec: readonly OpenApiParityFinding[];
  /** Published operation with no live route (spec → router). */
  readonly missingFromRouter: readonly OpenApiParityFinding[];
  /** Both directions, flattened. */
  readonly problems: readonly OpenApiParityFinding[];
}

export interface OpenApiParityOptions {
  readonly ignorePathPrefixes?: readonly string[];
}

/** Convenience: enumerate the live router of `app` and audit it against the bundle. */
export function auditAppAgainstSpec(
  app: INestApplication,
  options: OpenApiParityOptions = {},
): OpenApiParityReport {
  return auditOpenApiParity(enumerateRoutes(app), readSpecOperations(), options);
}

/**
 * Audit an enumeration against a set of published operations.
 *
 * Takes both sides as arguments (not the app, not a file path) so the meta-test
 * can feed it a deliberately broken pair without having to build a broken
 * application or write a broken spec to disk.
 */
export function auditOpenApiParity(
  routes: readonly RouteDeclaration[],
  operations: readonly SpecOperation[],
  options: OpenApiParityOptions = {},
): OpenApiParityReport {
  const ignored = options.ignorePathPrefixes ?? DEFAULT_IGNORED_PATH_PREFIXES;
  const kept = routes.filter((r) => !ignored.some((prefix) => r.path.startsWith(prefix)));

  // `HEAD` is answered by the `@Get()` handler (express), so it is looked up
  // against its GET row — exactly as the capability audit does, via the SAME
  // production function. A second copy of that rule could drift.
  const key = (method: string, path: string) => `${capabilityLookupMethod(method)} ${path}`;

  const inSpec = new Set(operations.map((op) => key(op.method, op.path)));
  const inRouter = new Set(kept.map((r) => key(r.method, r.path)));

  const missingFromSpec: OpenApiParityFinding[] = [];
  for (const route of kept) {
    if (inSpec.has(key(route.method, route.path))) continue;
    missingFromSpec.push({
      kind: "missing-from-spec",
      route: `${route.method} ${route.path}`,
      source: route.source,
      message:
        `the server answers this route but packages/contracts/openapi declares no ` +
        `operation for it — no generated client can call it, and neither ` +
        `contracts-drift nor oasdiff can see that. Add a path file under ` +
        `openapi/paths/ and re-bundle.`,
    });
  }

  const missingFromRouter: OpenApiParityFinding[] = [];
  for (const op of operations) {
    if (inRouter.has(key(op.method, op.path))) continue;
    missingFromRouter.push({
      kind: "missing-from-router",
      route: `${op.method} ${op.path}`,
      source: op.operationId ? `openapi operationId: ${op.operationId}` : "openapi paths",
      message:
        `the contract publishes this operation but no live route serves it — a ` +
        `client generated from this spec would compile and then 404 at runtime. ` +
        `Either implement the route or remove it from the contract.`,
    });
  }

  return {
    routes: kept,
    operations,
    missingFromSpec,
    missingFromRouter,
    problems: [...missingFromSpec, ...missingFromRouter],
  };
}

export interface AssertOpenApiParityOptions {
  /**
   * Minimum number of routes the enumeration must contain. An audit over an
   * empty router is green forever; qa called that the most important failure
   * mode in the whole kit set (test-plan Q10 ซ). Default 1.
   */
  readonly minRoutes?: number;
  /** Minimum number of operations the spec must publish. Default 1. */
  readonly minOperations?: number;
}

/** Throw a single readable error listing every disagreement, or return silently. */
export function assertOpenApiParity(
  report: OpenApiParityReport,
  options: AssertOpenApiParityOptions = {},
): void {
  const minRoutes = options.minRoutes ?? 1;
  const minOperations = options.minOperations ?? 1;
  if (report.routes.length < minRoutes) {
    throw new Error(
      `OpenAPI parity audit is VACUOUS: enumerated ${report.routes.length} route(s), ` +
        `expected at least ${minRoutes}.`,
    );
  }
  if (report.operations.length < minOperations) {
    throw new Error(
      `OpenAPI parity audit is VACUOUS: the spec declares ${report.operations.length} ` +
        `operation(s), expected at least ${minOperations}.`,
    );
  }
  if (report.problems.length === 0) return;
  throw new Error(
    `router ↔ OpenAPI parity found ${report.problems.length} disagreement(s):\n` +
      report.problems
        .map((f) => `  [${f.kind}] ${f.route} (${f.source})\n      ${f.message}`)
        .join("\n"),
  );
}
