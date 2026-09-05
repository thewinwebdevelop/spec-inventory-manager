// F-002 · T-002-04 — the request-scoped org context (architecture §1.3/§2.1).
// (F-000 · T-000-08 established this file as the seam; this is the real thing.)
//
// ⚠️ ONE AsyncLocalStorage, NOT TWO. `packages/db` (T-002-03, org-lock.ts) owns
// the storage: `runWithOrgContext` / `getOrgContext`. `lockCurrentOrganization`
// — the anchor that makes "Owner ≥ 1" and "revoke ‖ accept" actually hold —
// reads THAT store. If apps/api kept its own AsyncLocalStorage instance, both
// sides would look correct, both sides' tests would be green, and every §5
// transaction would either throw or serialize on the wrong row. So this class is
// a thin, injectable ADAPTER over the packages/db storage, not a second one.
// `org-context.test.ts` proves the identity (`store.get() === getOrgContext()`),
// not merely that this class remembers what it was told.
//
// WHO ESTABLISHES IT: `OrgContextMiddleware`, once per request, and only for
// org-scoped routes (I-3 — a `@Public()`/`@UserScoped()` route must have NO
// context, otherwise the CALLER picks our tenant via a header). Middleware is
// also the only layer that CAN: a guard's `canActivate` returns before the
// handler runs, so an ALS scope entered there is already gone by then (the F-000
// note in org-scope.guard.ts spelled this out).
import { Injectable } from "@nestjs/common";
import { getOrgContext, runWithOrgContext, type OrgScopeContext } from "@omnistock/db";

/**
 * What a resolved request knows about its tenant. `organizationId` is the part
 * `withOrgScope` / `lockCurrentOrganization` need (`OrgScopeContext`); the rest
 * is what authorization layers on top read — `CapabilityGuard` (T-002-05) uses
 * `capabilities`.
 */
export interface OrgRequestContext extends OrgScopeContext {
  organizationId: string;
  /** The authenticated caller (the access token's `sub`), when there is one. */
  userId?: string;
  membershipId?: string;
  roleId?: string;
  /** Capabilities of the caller's role in THIS org (`full_access` ⇒ all). */
  capabilities?: readonly string[];
}

/**
 * Injectable accessor for the current org context. Feature code injects this
 * (or just uses `ORG_PRISMA`, which reads it on every property access) instead
 * of importing the free functions, so the seam stays mockable.
 */
@Injectable()
export class OrgContextStore {
  /**
   * Runs `fn` with `ctx` bound for the whole async call tree.
   *
   * Callers: `OrgContextMiddleware` (HTTP), BullMQ processors (`organizationId`
   * from the job payload), and the invitation-accept flow, which reads the
   * invitation row with `SYSTEM_PRISMA` and then runs the rest under the org
   * THAT ROW proves — never the header (architecture §2.1/§2.4, I-3). One
   * pattern everywhere, not two.
   */
  run<T>(ctx: OrgRequestContext, fn: () => T): T {
    return runWithOrgContext(ctx, fn);
  }

  /**
   * The current org context, or `undefined` when this request/async tree has
   * none — the correct, intended state on `@Public()`/`@UserScoped()` routes
   * (I-3), and the reason `ORG_PRISMA` fails loudly there instead of quietly
   * serving a caller-chosen tenant.
   */
  get(): OrgRequestContext | undefined {
    return getOrgContext() as OrgRequestContext | undefined;
  }
}
