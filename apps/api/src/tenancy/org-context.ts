// F-000 · T-000-08 — request-context seam for organizationId scoping.
// Authoritative spec: docs/features/F-000/architecture.md §5.1:
//   "apps/api gets an OrgContext (AsyncLocalStorage-backed) provider + a
//    placeholder guard/interceptor that today just establishes the context
//    slot. F-002/F-003 fill it (resolve org from membership/JWT) and feed it
//    into withOrgScope."
//
// F-000 SCOPE: this file only establishes the storage slot + typed accessors.
// Nothing resolves a real organizationId yet — there is no auth/tenant
// runtime in F-000. `OrgScopeGuard` (see ./org-scope.guard.ts) is registered
// but does not enforce anything today.
import { AsyncLocalStorage } from "node:async_hooks";
import { Injectable } from "@nestjs/common";
import type { OrgScopeContext } from "@omnistock/db";

/**
 * Per-request org context store. F-002/F-003 populate this from a resolved
 * membership/JWT; F-000 leaves it available-but-empty so the seam exists.
 */
@Injectable()
export class OrgContextStore {
  private readonly storage = new AsyncLocalStorage<OrgScopeContext>();

  /** Runs `fn` with `ctx` bound for the duration of the async call tree. */
  run<T>(ctx: OrgScopeContext, fn: () => T): T {
    return this.storage.run(ctx, fn);
  }

  /**
   * Returns the current request's org context, or `undefined` if none has
   * been established (always `undefined` in F-000 — no caller populates it
   * yet). Domain code that later calls `withOrgScope` reads this to build the
   * `ctx` argument.
   */
  get(): OrgScopeContext | undefined {
    return this.storage.getStore();
  }
}
