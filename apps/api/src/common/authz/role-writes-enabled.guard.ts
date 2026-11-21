// F-003 · T-003-B23 ★ — `RoleWritesEnabledGuard` (architecture §12 · api-spec §1).
//
// `ROLE_WRITES_ENABLED` (default false) keeps custom roles from existing while
// F-002 instances may still serve requests (SR-03). On a `@RoleWrite()` handler
// with the flag off this answers `503 ROLE_WRITES_DISABLED`.
//
// ⚠️ ORDER IS THE CONTRACT (api-spec §2: capability → flag → rate limit). This
// is a GLOBAL guard registered in `TenancyModule` right AFTER `CapabilityGuard`
// and BEFORE `OrgRateLimitGuard`:
//   - after CapabilityGuard ⇒ a caller without `manage_roles` keeps getting the
//     old `403 FORBIDDEN` and never learns a flag exists (MUT-11 / I3-44);
//   - before the rate limit ⇒ a refused-by-flag request does not burn the shop's
//     `roleWrite` quota (the same reasoning as rate limiting after authz).
// A handler-level `@UseGuards` would run after every global guard, i.e. after
// the limiter — which is why this is not one.
//
// Scope: Role writes only (§12 "ครอบอะไร"). The stricter rules on the shipped
// member/invitation routes are NOT behind the flag — a flag that can switch a
// stricter rule off is a switch that opens a hole (MUT-16).
import {
  Inject,
  Injectable,
  Optional,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { domainError } from "../domain-exception";
import { ROLE_WRITES_ENABLED } from "../boot-env";
import { ROLE_WRITE_KEY } from "./role-write";

@Injectable()
export class RoleWritesEnabledGuard implements CanActivate {
  // Explicit @Inject on every parameter — `tsx` emits no `design:paramtypes`
  // (guard-injection.test.ts). `@Optional()`: a module graph without
  // BootEnvModule (unit-test probes) gets `undefined`, which is CLOSED below.
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Optional() @Inject(ROLE_WRITES_ENABLED) private readonly enabled?: boolean,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const roleWrite = this.reflector.getAllAndOverride<boolean | undefined>(ROLE_WRITE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roleWrite !== true) return true;
    // Only the literal `true` opens it: an unbound / mis-typed value is "off".
    if (this.enabled !== true) throw domainError("ROLE_WRITES_DISABLED");
    return true;
  }
}
