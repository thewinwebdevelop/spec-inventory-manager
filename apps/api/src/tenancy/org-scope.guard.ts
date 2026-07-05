// F-000 · T-000-08 — placeholder guard for the organizationId scoping seam.
// Authoritative spec: docs/features/F-000/architecture.md §5.1.
//
// F-000 SCOPE: registered globally but a NO-OP — it does not resolve org
// membership from a JWT (there is no auth runtime yet, that's F-001/F-002)
// and does not reject any request. Its only job today is to exist as the
// named place F-002/F-003 fill in: "resolve org from membership/JWT".
//
// Fix-pass correction: a `CanActivate` guard cannot be the thing that wraps
// downstream request handling in `OrgContextStore.run(ctx, () => ...)` — a
// guard only returns a boolean from `canActivate`; any AsyncLocalStorage scope
// entered *inside* it ends the moment `canActivate` returns, before the route
// handler ever runs (`.run()`'s callback would need to synchronously contain
// the rest of the request, which a guard has no hook for). F-002/F-003 must
// instead do this in NestJS **middleware** (whose `next()` continuation does
// wrap the rest of the pipeline), or, if a middleware seam turns out
// impractical for some route, fall back to
// `AsyncLocalStorage#enterWith(ctx)` — which mutates the *current* async
// context in place instead of scoping a callback and has weaker cleanup
// semantics, so that should be a deliberate, documented choice, not the
// default path.
import { Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";

@Injectable()
export class OrgScopeGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    // F-000 stub: always allow. F-002/F-003 replace this body with real
    // membership/JWT resolution + `OrgContextStore.run(...)`.
    return true;
  }
}
