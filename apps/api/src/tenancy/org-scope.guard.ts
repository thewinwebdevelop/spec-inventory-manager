// F-002 · T-002-04 ★ — the default-deny org guard (architecture §1.1/§1.4).
//
// Registered globally, so EVERY route is org-scoped unless it says otherwise:
// a new endpoint that forgets to declare its tier demands an org context and
// fails (401/422/403). "ลืมแล้วพัง ไม่ใช่ลืมแล้วรั่ว" — forgetting breaks the
// route instead of silently serving unfiltered data.
//
// It decides from `req.orgAuth` ONLY (I-4). `req.user` does not exist yet at
// this point: this is a global guard, and `JwtAuthGuard` is bound per
// controller, i.e. strictly later. Reading `req.user` here would 401 everything
// — and the "fix" someone would reach for under time pressure (waving
// `@UserScoped()` through) removes authentication from the central guard
// entirely. So the middleware verifies the bearer and records the result, and
// this class only maps that record onto the wire.
//
// F-000's note on this file still stands and is why the ALS lives in the
// middleware: a `CanActivate` cannot wrap the rest of the request, so it cannot
// be the thing that opens the org context.
import { Inject, Injectable, Logger, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { domainError } from "../common";
import type { OrgAuthRequest, OrgAuthState } from "./org-auth";
import { isLegacySelfGovernedRoute } from "./legacy-routes";
import { ROUTE_SCOPE_KEY, type RouteScope } from "./route-scope.decorator";

/** The tier as the DECORATORS declare it — the authority. */
type EffectiveTier = RouteScope | "org" | "legacy";

@Injectable()
export class OrgScopeGuard implements CanActivate {
  private readonly logger = new Logger(OrgScopeGuard.name);

  // Explicit @Inject — see the note in org-context.middleware.ts (tsx emits no
  // decorator metadata, so type-based DI would resolve `undefined` in dev).
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== "http") {
      // No non-HTTP transport exists in apps/api today, and workers establish
      // their context with `OrgContextStore.run(...)` instead of passing through
      // guards. If one ever appears it must be designed — not defaulted open.
      this.logger.error(`refused a non-HTTP execution context (${context.getType()})`);
      throw domainError("FORBIDDEN");
    }

    const req = context.switchToHttp().getRequest<OrgAuthRequest>();
    const route = `${req.method} ${req.originalUrl ?? req.url}`;
    const auth = req.orgAuth;
    if (!auth) {
      // OrgContextMiddleware did not run for this request — every guarantee
      // below is void. Never "carry on".
      this.logger.error(`no req.orgAuth on ${route} — OrgContextMiddleware is not wired`);
      throw domainError("INTERNAL");
    }

    const declared = this.reflector.getAllAndOverride<RouteScope | undefined>(ROUTE_SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const legacy = isLegacySelfGovernedRoute(req.method, req.originalUrl ?? req.url);
    const tier: EffectiveTier = declared ?? (legacy ? "legacy" : "org");

    // The middleware had to identify the tier from Nest's route metadata (it has
    // no Reflector). Here we know for certain — so any disagreement means the
    // request was prepared under the wrong assumption and MUST NOT proceed:
    // either an org context exists on a route that should have none (I-3), or an
    // org-scoped route has no context at all. Both are our bug; both fail loud.
    if (auth.routeTier !== "unknown" && auth.routeTier !== tier) {
      this.logger.error(
        `route tier mismatch on ${route}: middleware assumed '${auth.routeTier}', ` +
          `decorators say '${tier}'`,
      );
      throw domainError("INTERNAL");
    }
    if (auth.routeTier === "unknown" && tier === "org") {
      this.logger.error(
        `org-scoped route ${route} was not identified by RouteScopeRegistry, so no org ` +
          `context could be established`,
      );
      throw domainError("INTERNAL");
    }

    switch (tier) {
      case "public":
      case "legacy":
        // `legacy` = an F-001 route that still governs itself (legacy-routes.ts).
        // Its own controller guards decide, exactly as they do today.
        return true;

      case "user":
        // Authenticated, but NOT about one org: no context was created even if
        // the caller sent `X-Organization-Id` (I-3).
        if (!auth.tokenValid) throw domainError("UNAUTHENTICATED");
        return true;

      case "system":
        // §1.1 declares the tier; F-085 brings `SuperAdminGuard` + `@Audited`.
        // Until then a cross-org route is refused — an unenforced tier must
        // never be the permissive one.
        this.logger.warn(`@SystemScoped() route ${route} refused: SuperAdminGuard lands with F-085`);
        throw domainError("FORBIDDEN");

      case "org":
        return this.decideOrgScoped(auth);
    }
  }

  /** §1.4, rows 1–5. */
  private decideOrgScoped(auth: OrgAuthState): boolean {
    if (!auth.tokenValid) throw domainError("UNAUTHENTICATED");

    switch (auth.orgOutcome) {
      case "ok":
        return true;
      case "none":
        throw domainError("ORG_CONTEXT_REQUIRED");
      case "mismatch":
        // 422, NOT 403: header and path disagreeing is a CLIENT BUG, and
        // answering 403 would bounce a perfectly valid member out of the org
        // they are looking at (N-1 / api-spec §4).
        throw domainError("ORG_MISMATCH");
      case "no_membership":
      case "revoked":
      case "not_active":
        // One code for all three — including "the org does not exist" (I-5).
        // ⛔ Never split these: differentiating them is a cross-tenant existence
        // oracle. `FORBIDDEN` stays reserved for "member, but lacks capability".
        throw domainError("ORG_ACCESS_DENIED");
      case "skipped":
        // org-scoped but the middleware never resolved — unreachable unless the
        // chain is mis-wired.
        this.logger.error("org-scoped route reached the guard with orgOutcome='skipped'");
        throw domainError("INTERNAL");
    }
  }
}
