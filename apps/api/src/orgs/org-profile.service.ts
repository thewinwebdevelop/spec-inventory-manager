// F-002 · T-002-16 — `GET /orgs/{orgId}` and `PATCH /orgs/{orgId}`
// (api-spec §3.3/§3.4).
//
// THE SHAPE EVERY LATER F-002 SERVICE COPIES: read through `ORG_PRISMA`, decide
// nothing here, hand the rows to a pure function. Not one line below asks "may
// this caller see the tax id?" — `toOrgProfileView` answers that, in
// `packages/core-domain`, where it is a table of viewers and outputs instead of
// an `if` buried in a mapper.
//
// `ORG_PRISMA` — never `SYSTEM_PRISMA`. Every query in this file is silently and
// automatically filtered by the request's `organizationId`; there is no code
// path in which forgetting a filter is possible, because there is no filter to
// forget. The org id itself comes from the ALS context the middleware
// established, NOT from the `:orgId` in the URL: the guard chain already proved
// the caller is an active member of the context org, and re-reading the path
// param here would reintroduce the confused-deputy gap that check closed.
import { Inject, Injectable } from "@nestjs/common";
import {
  toOrgProfileView,
  type OrgProfilePatch,
  type OrgProfileView,
} from "@omnistock/core-domain";
import { domainError } from "../common";
import { ORG_PRISMA, OrgContextStore, type OrgScopedPrismaClient } from "../tenancy";

/** The organization columns the profile view needs — one place, both methods. */
const ORG_PROFILE_SELECT = {
  id: true,
  name: true,
  logo: true,
  timezone: true,
  currency: true,
  taxEntityType: true,
  taxId: true,
  vatRegistered: true,
  taxBranchCode: true,
} as const;

@Injectable()
export class OrgProfileService {
  // Explicit @Inject on every parameter — `tsx` emits no `design:paramtypes`,
  // so a type-only parameter would resolve to `undefined` in production only.
  constructor(
    @Inject(ORG_PRISMA) private readonly prisma: OrgScopedPrismaClient,
    @Inject(OrgContextStore) private readonly store: OrgContextStore,
  ) {}

  /** api-spec §3.3 — the profile as THIS caller is allowed to see it. */
  async get(): Promise<OrgProfileView> {
    return this.buildView();
  }

  /**
   * api-spec §3.4 — write the validated patch, then answer with the same body
   * `GET` would return (so a client never needs a second round trip, and never
   * sees a shape that only `PATCH` produces).
   *
   * An empty patch writes nothing and is not an error (see
   * `validateOrgProfilePatch`); `update` with an empty `data` is a no-op row
   * touch, so it is skipped entirely rather than bumping `updatedAt` for a
   * request that changed nothing.
   */
  async update(patch: OrgProfilePatch): Promise<OrgProfileView> {
    const organizationId = this.requireOrganizationId();
    if (Object.keys(patch).length > 0) {
      await this.prisma.organization.update({
        // Scoped by `id` (the tenant root's own org column, packages/db
        // `scopeTenantRoot`): another tenant's id here is not "unauthorized",
        // it is refused by the seam before it reaches SQL.
        where: { id: organizationId },
        data: patch,
        select: { id: true },
      });
    }
    return this.buildView();
  }

  // ── internals ────────────────────────────────────────────────────────────

  private requireOrganizationId(): string {
    const ctx = this.store.get();
    if (!ctx?.organizationId) {
      // Unreachable through the guard chain: an org-scoped route only runs with
      // `orgOutcome === 'ok'`. Reaching here means the chain is mis-wired, which
      // is our bug — fail loud, never fall back to a path param.
      throw domainError("INTERNAL");
    }
    return ctx.organizationId;
  }

  private requireUserId(): string {
    const ctx = this.store.get();
    if (!ctx?.userId) throw domainError("INTERNAL");
    return ctx.userId;
  }

  private async buildView(): Promise<OrgProfileView> {
    const organizationId = this.requireOrganizationId();
    const userId = this.requireUserId();
    const now = new Date();

    // All five reads are independent and org-scoped; running them in parallel
    // keeps the endpoint at one round trip's latency instead of five.
    const [organization, membership, entitlement, activeMembers, pendingInvitations] =
      await Promise.all([
        this.prisma.organization.findUnique({
          where: { id: organizationId },
          select: ORG_PROFILE_SELECT,
        }),
        // The caller's OWN membership. `capabilities` are re-read from the role
        // row rather than taken from the ALS context so the body describes the
        // database, not a token-time snapshot of it.
        this.prisma.membership.findFirst({
          where: { userId },
          select: {
            status: true,
            roleId: true,
            role: { select: { name: true, key: true, capabilities: true } },
          },
        }),
        this.prisma.orgEntitlement.findFirst({
          // `PlanDefinition` is a system catalog (org-agnostic). Reading INTO it
          // is fine; what rule NEW-8 forbids is traversing THROUGH an
          // org-agnostic model back down into org-scoped rows, which this does
          // not do — the select stops at two scalar columns.
          select: { planDefinition: { select: { key: true, tierLabel: true } } },
        }),
        this.prisma.membership.count({ where: { status: "active" } }),
        // "Pending" is a DERIVED state (data-model §3.2): a row that is still
        // `pending` but past `expiresAt` is expired, and counting it would show
        // the owner an invitation nobody can accept. T-002-19 owns the
        // invitation endpoints; this count must agree with them.
        this.prisma.invitation.count({ where: { status: "pending", expiresAt: { gt: now } } }),
      ]);

    if (!organization || !membership) {
      // The guard proved membership microseconds ago, so this means the row was
      // deleted underneath us (or the context is wrong). Either way it is not
      // something to paper over with a partial body.
      throw domainError("INTERNAL");
    }

    return toOrgProfileView({
      organization,
      viewer: {
        userId,
        roleId: membership.roleId,
        roleName: membership.role.name,
        roleKey: membership.role.key,
        capabilities: membership.role.capabilities,
        status: membership.status,
      },
      entitlement: entitlement
        ? {
            planKey: entitlement.planDefinition.key,
            tierLabel: entitlement.planDefinition.tierLabel,
          }
        : null,
      counts: { activeMembers, pendingInvitations },
    });
  }
}
