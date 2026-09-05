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
import {
  Inject,
  Injectable,
  Logger,
  Optional,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { domainError } from "../common";
import {
  CAPABILITY_EVENT_SINK,
  ORG_ACCESS_DENIED_EVENT,
  type CapabilityEventSink,
} from "../common/authz";
import type { OrgAuthRequest, OrgAuthState } from "./org-auth";
import { ROUTE_SCOPE_KEY, type RouteScope } from "./route-scope.decorator";
import { normalizePath } from "./route-scope.registry";

/** The tier as the DECORATORS declare it — the authority. */
type EffectiveTier = RouteScope | "org";

@Injectable()
export class OrgScopeGuard implements CanActivate {
  private readonly logger = new Logger(OrgScopeGuard.name);

  // Explicit @Inject — see the note in org-context.middleware.ts (tsx emits no
  // decorator metadata, so type-based DI would resolve `undefined` in dev).
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    // Optional so every existing test module that builds TenancyModule keeps
    // working; the composition root binds the real `SecurityEventsService`.
    @Optional()
    @Inject(CAPABILITY_EVENT_SINK)
    private readonly events: CapabilityEventSink | null = null,
  ) {}

  /**
   * Record a tenancy denial (§9 `org.access.denied`).
   *
   * Emitted for the three membership outcomes and for `mismatch`, because those
   * are the ones that describe someone reaching for an organization: the
   * *headline* insider-probing signal of F-002. Not emitted for
   * `UNAUTHENTICATED` — that is "no token", which F-001's auth events already
   * cover and which any unauthenticated scanner would flood.
   *
   * `userId` may be absent (`tokenValid` false paths do not reach here) and
   * `organizationId` is whatever the caller ASKED for — the value is a claim,
   * not a proven membership, which is exactly what makes it worth recording.
   */
  private recordDenial(
    reason: "no_membership" | "revoked" | "not_active" | "mismatch",
    auth: OrgAuthState,
    organizationId: string | undefined,
  ): void {
    this.events?.emit(ORG_ACCESS_DENIED_EVENT, {
      userId: auth.userId,
      organizationId,
      reason,
    });
  }

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== "http") {
      // No non-HTTP transport exists in apps/api today, and workers establish
      // their context with `OrgContextStore.run(...)` instead of passing through
      // guards. If one ever appears it must be designed — not defaulted open.
      this.logger.error(`refused a non-HTTP execution context (${context.getType()})`);
      throw domainError("FORBIDDEN");
    }

    const req = context.switchToHttp().getRequest<OrgAuthRequest>();
    // ★ A-11 — `normalizePath` strips the query string, exactly as
    // `capability.guard.ts` already does. Today no invitation route accepts its
    // token in the query (they are body-only, I-6), so nothing sensitive is in
    // there — but this string is logged, and the two guards differing meant one
    // of them would eventually log something the other would not.
    const route = `${req.method} ${normalizePath(req.originalUrl ?? req.url)}`;
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
    // T-002-13 — no bridge left: a route is what its decorators say, and saying
    // nothing means org-scoped. That is the whole default-deny rule, with no
    // second path that could quietly grow.
    const tier: EffectiveTier = declared ?? "org";

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
        // No token required and no org context (I-3). The route's own guards
        // (JsonOnlyGuard, JwtAuthGuard on the Bearer `/auth/*` endpoints, CSRF,
        // throttle) decide — this guard only declines to add a tenant check.
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
        {
          const requested = req.params?.orgId;
          return this.decideOrgScoped(auth, typeof requested === "string" ? requested : undefined);
        }
    }
  }

  /** §1.4, rows 1–5. */
  private decideOrgScoped(auth: OrgAuthState, requestedOrgId?: string): boolean {
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
        this.recordDenial("mismatch", auth, requestedOrgId);
        throw domainError("ORG_MISMATCH");
      case "no_membership":
      case "revoked":
      case "not_active":
        // One code for all three — including "the org does not exist" (I-5).
        // ⛔ Never split these: differentiating them is a cross-tenant existence
        // oracle. `FORBIDDEN` stays reserved for "member, but lacks capability".
        //
        // The EVENT does carry the precise reason, and that is not a
        // contradiction: the wire must not distinguish them because the caller
        // must learn nothing, while an investigator reading the audit trail
        // needs to tell "never was a member" from "was removed and came back".
        this.recordDenial(auth.orgOutcome, auth, requestedOrgId);
        throw domainError("ORG_ACCESS_DENIED");
      case "skipped":
        // org-scoped but the middleware never resolved — unreachable unless the
        // chain is mis-wired.
        this.logger.error("org-scoped route reached the guard with orgOutcome='skipped'");
        throw domainError("INTERNAL");
    }
  }
}
