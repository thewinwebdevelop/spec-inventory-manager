import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { OrgContextStore } from "./org-context";
import { OrgScopeGuard } from "./org-scope.guard";

/**
 * F-000 · T-000-08 — wires the org-scope SEAM (not the runtime). Registers
 * `OrgScopeGuard` globally (no-op today) and provides `OrgContextStore` for
 * injection. `@Global` because every feature module will eventually need
 * org-context access. See docs/features/F-000/architecture.md §5.
 */
@Global()
@Module({
  providers: [
    OrgContextStore,
    {
      provide: APP_GUARD,
      useClass: OrgScopeGuard,
    },
  ],
  exports: [OrgContextStore],
})
export class TenancyModule {}
