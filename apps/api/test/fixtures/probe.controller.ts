// F-002 · T-002-22 — the org-scoped probe routes the leak kit sweeps.
//
// WHY THIS EXISTS AT ALL: F-002's own controllers land in later waves, so today
// there is not a single org-scoped endpoint in the application. A cross-org leak
// kit with nothing to sweep is a kit nobody has ever seen work — the exact
// "green because it did nothing" failure qa called the most important one in the
// set (test-plan Q10 ซ). These two routes give the kit a real target running the
// REAL guard chain (OrgContextMiddleware → OrgScopeGuard → CapabilityGuard) and
// the REAL org-scoped Prisma client, so the sweep exercises production
// machinery, not a mock of it.
//
// They are NOT a substitute for sweeping the real endpoints. Each F-002 endpoint
// gets swept as it lands; this is what proves the sweep itself can go red.
import { Controller, Get, Inject } from "@nestjs/common";
import { AnyActiveMember, RequireCapability } from "../../src/common/authz";
import { CAPABILITY_MANAGE_MEMBERS } from "@omnistock/core-domain";
import { ORG_PRISMA, OrgContextStore, type OrgScopedPrismaClient } from "../../src/tenancy";

@Controller("__test__/probe")
export class ProbeController {
  constructor(
    @Inject(OrgContextStore) private readonly store: OrgContextStore,
    @Inject(ORG_PRISMA) private readonly prisma: OrgScopedPrismaClient,
  ) {}

  /** Any active member. Answers with the org the CONTEXT resolved — never the
   *  one the caller asked for, so a mismatch between the two is visible. */
  @AnyActiveMember()
  @Get(":orgId")
  read(): { organizationId: string | undefined; capabilities: readonly string[] } {
    const ctx = this.store.get();
    return { organizationId: ctx?.organizationId, capabilities: ctx?.capabilities ?? [] };
  }

  /**
   * Requires `manage_members` — the route that tells `FORBIDDEN` apart from
   * `ORG_ACCESS_DENIED` (I-5). It also runs a REAL org-scoped query, so a
   * regression in `withOrgScope` shows up as another org's rows appearing here.
   */
  @RequireCapability(CAPABILITY_MANAGE_MEMBERS)
  @Get(":orgId/members")
  async members(): Promise<{ organizationId: string | undefined; memberCount: number }> {
    const ctx = this.store.get();
    const memberCount = await this.prisma.membership.count();
    return { organizationId: ctx?.organizationId, memberCount };
  }
}
