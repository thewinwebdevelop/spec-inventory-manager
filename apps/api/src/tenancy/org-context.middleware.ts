// F-002 · T-002-04 ★ — the chain of architecture §1.3, in one middleware.
//
//   Authorization: Bearer …  →  verify HERE (guards have not run yet — I-4)
//   route tier                →  @Public()/@UserScoped()/@SystemScoped() ⇒ STOP,
//                                no org resolution, no context at all (I-3)
//   org id                    →  X-Organization-Id, else :orgId (§1.2);
//                                both present and different ⇒ mismatch
//   membership                →  findUnique(organizationId_userId), `active` only
//   context                   →  OrgContextStore.run(ctx, next)  (the single ALS
//                                that packages/db's org lock also reads)
//
// It NEVER throws and never writes a response: every outcome is recorded on
// `req.orgAuth` and `OrgScopeGuard` turns it into 401/422/403. Keeping status
// decisions out of here is what guarantees this layer cannot change the wire
// behaviour of a route that governs itself.
import { Inject, Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Response } from "express";
import type { GuardedPrismaClient } from "../prisma/prisma.service";
import { OrgContextStore, type OrgRequestContext } from "./org-context";
import type { AssumedRouteTier, OrgAuthOutcome, OrgAuthRequest } from "./org-auth";
import { RouteScopeRegistry } from "./route-scope.registry";
import { SYSTEM_PRISMA } from "./prisma-tokens";
import { ACCESS_TOKEN_VERIFIER, type AccessTokenVerifier } from "./access-token-verifier";

const BEARER_PREFIX = "bearer ";
/** D-025 — the org travels in this header; `:orgId` in the path is the fallback. */
export const ORG_HEADER = "x-organization-id";

@Injectable()
export class OrgContextMiddleware implements NestMiddleware {
  constructor(
    // Explicit @Inject on EVERY param (not just the symbol tokens): type-based
    // DI needs `emitDecoratorMetadata`, which esbuild/tsx (`pnpm dev`) does not
    // produce — only the tsc build does. Being explicit keeps this layer working
    // under both toolchains instead of failing at boot in dev only.
    @Inject(OrgContextStore) private readonly store: OrgContextStore,
    @Inject(RouteScopeRegistry) private readonly routes: RouteScopeRegistry,
    @Inject(ACCESS_TOKEN_VERIFIER) private readonly tokens: AccessTokenVerifier,
    // M-1: `tenancy/` is on the SYSTEM_PRISMA allowlist precisely for this
    // chicken-and-egg read — the membership must be known BEFORE a context can
    // exist, so ORG_PRISMA cannot be used. Allowed scope: the `Membership` row
    // of the resolved (organizationId, userId) pair and its role's capabilities.
    // Nothing else, and never a write.
    @Inject(SYSTEM_PRISMA) private readonly prisma: GuardedPrismaClient,
  ) {}

  use(req: OrgAuthRequest, _res: Response, next: NextFunction): void {
    const verified = this.verifyBearer(req);
    const auth = {
      userId: verified?.userId,
      tokenValid: verified !== null,
      orgOutcome: "skipped" as OrgAuthOutcome,
      routeTier: "unknown" as AssumedRouteTier,
    };
    req.orgAuth = auth;

    const path = req.originalUrl ?? req.url;

    const match = this.routes.match(req.method, path);
    // I-3 — anything that is not org-scoped gets NO context. An unidentifiable
    // route (`unknown`) also gets none: the guard turns that into a loud failure
    // if the decorators say it should have had one.
    if (!match || match.scope !== "org") {
      auth.routeTier = match?.scope ?? "unknown";
      next();
      return;
    }

    auth.routeTier = "org";
    void this.resolveOrgScoped(req, auth, match.params.orgId, next);
  }

  private async resolveOrgScoped(
    req: OrgAuthRequest,
    auth: { userId?: string; tokenValid: boolean; orgOutcome: OrgAuthOutcome },
    pathOrgId: string | undefined,
    next: NextFunction,
  ): Promise<void> {
    try {
      const headerOrgId = readHeader(req, ORG_HEADER);
      const paramOrgId = pathOrgId?.trim() || undefined;

      // §1.2 step 3 — ambiguity is refused; we never pick a side, and we do it
      // BEFORE any authorization work so a client bug can never read as a
      // permission result (N-1: this is a 422, not a 403).
      if (headerOrgId && paramOrgId && headerOrgId !== paramOrgId) {
        auth.orgOutcome = "mismatch";
        next();
        return;
      }

      const organizationId = headerOrgId ?? paramOrgId;
      if (!organizationId) {
        auth.orgOutcome = "none";
        next();
        return;
      }
      // No token ⇒ nothing to look a membership up for. The guard 401s; we must
      // not spend a DB round-trip on an unauthenticated request.
      if (!auth.tokenValid || !auth.userId) {
        auth.orgOutcome = "none";
        next();
        return;
      }

      // AC US-5 — NO CACHE. One indexed read per request on
      // @@unique([organizationId, userId]) is the price of "revoked takes effect
      // on the very next request" (§1.5).
      const membership = await this.prisma.membership.findUnique({
        where: { organizationId_userId: { organizationId, userId: auth.userId } },
        // `select`, never `include` (C-4): `include` on a relation chain is how
        // `passwordHash` and other tenants' rows end up in memory.
        select: {
          id: true,
          status: true,
          roleId: true,
          role: { select: { capabilities: true } },
        },
      });

      if (!membership) {
        // ⛔ Do NOT probe whether the organization exists to "improve" this.
        // "no such org" and "not your org" must be indistinguishable (I-5).
        auth.orgOutcome = "no_membership";
        next();
        return;
      }
      if (membership.status !== "active") {
        auth.orgOutcome = membership.status === "revoked" ? "revoked" : "not_active";
        next();
        return;
      }

      const ctx: OrgRequestContext = {
        organizationId,
        userId: auth.userId,
        membershipId: membership.id,
        roleId: membership.roleId,
        capabilities: Object.freeze([...(membership.role?.capabilities ?? [])]),
      };
      auth.orgOutcome = "ok";
      // The ONE storage: packages/db's, so `lockCurrentOrganization` (T-002-03)
      // and `withOrgScope` see the same context this request resolved.
      this.store.run(ctx, () => next());
    } catch (err) {
      // A lookup failure must not become "no org context, carry on" — hand it to
      // Express so the exception filter renders a 500 (fail loud, never open).
      next(err);
    }
  }

  private verifyBearer(req: OrgAuthRequest): { userId: string } | null {
    const header = req.headers.authorization;
    if (typeof header !== "string") return null;
    if (!header.toLowerCase().startsWith(BEARER_PREFIX)) return null;
    const token = header.slice(BEARER_PREFIX.length).trim();
    if (!token) return null;
    return this.tokens.verify(token);
  }
}

function readHeader(req: OrgAuthRequest, name: string): string | undefined {
  const raw = req.headers[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : undefined;
}
