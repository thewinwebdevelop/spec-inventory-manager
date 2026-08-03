// F-002 · T-002-15 ★ — `POST /organizations`: one transaction, or no shop at all.
// architecture §6.1 (atomicity) · §6.2 (plan) · §6.3 (cap) · api-spec §3.1.
//
// ── WHY ATOMIC IS NOT A PREFERENCE ─────────────────────────────────────────
// A shop that exists without an Owner is a shop nobody can administer and nobody
// can delete (there is no delete-org endpoint in Phase 0). A shop without an
// `OrgEntitlement` is invisible to every entitlement check F-007 will add. A
// shop without a warehouse cannot receive stock. Each of those is unrecoverable
// without a manual DB fix, so "insert five things and hope" is not an option:
// either all five rows exist or none do.
//
// ── ORDER OF OPERATIONS (§6.1) ─────────────────────────────────────────────
//   before the tx   cap check          fail-closed, cheap, and it must not burn
//                                      a pooled connection to be answered
//   before the tx   plan resolution    503 before anything is written
//   in ONE tx       Organization → Role×3 → Membership(Owner) → OrgEntitlement
//                   → Warehouse(default)
//   after commit    emit `org.created`
//
// Both pre-checks are OUTSIDE the transaction deliberately: they are reads that
// decide whether to start at all, and doing them inside would hold a transaction
// open across an env lookup and a catalog read for no isolation benefit (nothing
// they read is written by this transaction).
//
// ── NO ORG LOCK HERE ───────────────────────────────────────────────────────
// `ORG_LOCK_REQUIRED_OPERATIONS` (packages/db) does NOT list this operation, and
// that is correct: the anchor is `SELECT … FROM "Organization" … FOR UPDATE` on
// an existing tenant row, and this transaction CREATES that row. Nothing else in
// the system can be touching a shop that does not exist yet.
//
// SYSTEM_PRISMA (architecture §2.4, row 1) because there is no org context on a
// `@UserScoped()` route (I-3) and, even if there were, the org being written
// does not exist when the transaction opens.
import { Inject, Injectable } from "@nestjs/common";
import { ORG_TX_TIMEOUTS } from "@omnistock/config";
import {
  DEFAULT_WAREHOUSE_NAME,
  ORG_DEFAULT_CURRENCY,
  SYSTEM_ROLE_BLUEPRINT,
  isOrgCapReached,
  ownerRoleBlueprint,
  type NewOrganizationInput,
} from "@omnistock/core-domain";
import { domainError } from "../../common";
import { SYSTEM_PRISMA, type SystemPrismaClient } from "../../tenancy";
import { SecurityEventsService } from "../../auth";
import { MAX_ORGS_PER_USER } from "../org-config";
import { PlanProvisioningService } from "./plan-provisioning.service";

/** The `201` body of api-spec §3.1 (the client seeds its cache from this). */
export interface CreatedOrganization {
  readonly organization: {
    readonly id: string;
    readonly name: string;
    readonly logo: string | null;
    readonly timezone: string;
    readonly currency: string;
    readonly taxProfileComplete: boolean;
    readonly createdAt: string;
  };
  readonly membership: {
    readonly userId: string;
    readonly roleId: string;
    readonly roleName: string;
    readonly roleKey: string | null;
    readonly status: string;
  };
  readonly entitlement: { readonly planKey: string; readonly tierLabel: string | null };
  readonly defaultWarehouse: { readonly id: string; readonly name: string };
}

@Injectable()
export class OrgProvisioningService {
  // Explicit @Inject on every parameter — `tsx` emits no `design:paramtypes`
  // (see plan-provisioning.service.ts).
  constructor(
    @Inject(SYSTEM_PRISMA) private readonly prisma: SystemPrismaClient,
    @Inject(PlanProvisioningService) private readonly plans: PlanProvisioningService,
    @Inject(SecurityEventsService) private readonly events: SecurityEventsService,
    // The §6.3 cap, resolved from env once at boot (`org-config.ts`).
    @Inject(MAX_ORGS_PER_USER) private readonly maxOrgsPerUser: number,
  ) {}

  async create(input: {
    readonly userId: string;
    readonly organization: NewOrganizationInput;
  }): Promise<CreatedOrganization> {
    const { userId } = input;
    const limit = this.maxOrgsPerUser;

    // ── 1. cap, FAIL-CLOSED (§6.3 / I-10) ────────────────────────────────
    // Deliberately not delegated to the rate limiter: that layer fails OPEN when
    // Redis is down, so it cannot hold a bound. If this count throws, the error
    // propagates and no shop is created — "we could not count" must never read
    // as "there is room".
    //
    // ⚠️ `status: "active"` only: leaving or being removed returns the quota
    // immediately. And yes, two simultaneous requests at 49 can both pass —
    // accepted in §6.3, because what this stops is thousands, not the 51st.
    const activeOrgCount = await this.prisma.membership.count({
      where: { userId, status: "active" },
    });
    if (isOrgCapReached(activeOrgCount, limit)) {
      throw domainError("ORG_LIMIT_REACHED", { details: { limit } });
    }

    // ── 2. plan, FAIL-CLOSED (§6.2) — 503 before anything is written ──────
    const plan = await this.plans.resolveForNewOrg({ userId });

    const ownerBlueprint = ownerRoleBlueprint();

    // ── 3. the one transaction (§6.1) ────────────────────────────────────
    // `timeout`/`maxWait` are always set: a `$transaction` without them can
    // queue on the connection pool indefinitely and turn one slow write into a
    // whole-instance outage (§5.2, same policy as the org-locked writes).
    const created = await this.prisma.$transaction(
      async (tx) => {
        // (1) the tenant row.
        const organization = await tx.organization.create({
          data: {
            name: input.organization.name,
            timezone: input.organization.timezone,
            // ⛔ Not from the client, at any point: currency is D-013-fixed and
            // the plan is resolved server-side. A `planKey` in the request body
            // would be a self-granted tier.
            currency: ORG_DEFAULT_CURRENCY,
            createdByUserId: userId,
          },
          select: { id: true, name: true, logo: true, timezone: true, currency: true, createdAt: true },
        });

        // (2) the three system roles — sequential creates, never a nested write.
        // `withOrgScope` cannot inject `organizationId` into a nested `create`
        // (architecture §2.2), so nested writes are banned repo-wide and this
        // transaction sets the example every later feature copies.
        const roles = new Map<string, { id: string; name: string; key: string | null }>();
        for (const blueprint of SYSTEM_ROLE_BLUEPRINT) {
          const role = await tx.role.create({
            data: {
              organizationId: organization.id,
              name: blueprint.name,
              key: blueprint.key,
              isSystem: blueprint.isSystem,
              capabilities: [...blueprint.capabilities],
            },
            select: { id: true, name: true, key: true },
          });
          roles.set(blueprint.name, role);
        }

        // Resolved by CAPABILITY (`full_access`), never by name or key — the
        // rule of data-model §5.2 that keeps working when F-003 lets users
        // rename roles.
        const ownerRole = roles.get(ownerBlueprint.name);
        if (!ownerRole) {
          // Unreachable unless the loop above changed; still explicit, because
          // the alternative is a membership pointing at `undefined`.
          throw new Error("owner role was not created — refusing to create a shop without an Owner");
        }

        // (3) the creator's membership: Owner, active from this instant.
        const membership = await tx.membership.create({
          data: {
            organizationId: organization.id,
            userId,
            roleId: ownerRole.id,
            status: "active",
            // `activatedAt` is evidence, not decoration: the invitation flow
            // (I-1) compares issue/revoke timestamps against it.
            activatedAt: new Date(),
          },
          select: { id: true, userId: true, roleId: true, status: true },
        });

        // (4) the entitlement — the invariant "an org is ALWAYS bound to a plan".
        await tx.orgEntitlement.create({
          data: { organizationId: organization.id, planDefinitionId: plan.planDefinitionId },
          select: { id: true },
        });

        // (5) the default warehouse. The partial unique index
        // `UNIQUE ("organizationId") WHERE "isDefault"` makes "one default per
        // org" a database rule, not a convention (data-model §2).
        const warehouse = await tx.warehouse.create({
          data: { organizationId: organization.id, name: DEFAULT_WAREHOUSE_NAME, isDefault: true },
          select: { id: true, name: true },
        });

        return { organization, ownerRole, membership, warehouse };
      },
      { timeout: ORG_TX_TIMEOUTS.txTimeoutMs, maxWait: ORG_TX_TIMEOUTS.maxWaitMs },
    );

    // ── 4. POST-COMMIT only (H-3) ────────────────────────────────────────
    // Emitting inside the transaction would announce a shop that a rollback then
    // erased — an audit trail that claims things which never happened is worse
    // than no audit trail.
    this.events.emit("org.created", {
      actorUserId: userId,
      organizationId: created.organization.id,
      planKey: plan.planKey,
    });

    return {
      organization: {
        id: created.organization.id,
        name: created.organization.name,
        logo: created.organization.logo,
        timezone: created.organization.timezone,
        currency: created.organization.currency,
        // A brand-new shop has declared nothing (US-7 comes later).
        taxProfileComplete: false,
        createdAt: created.organization.createdAt.toISOString(),
      },
      membership: {
        userId: created.membership.userId,
        roleId: created.membership.roleId,
        roleName: created.ownerRole.name,
        roleKey: created.ownerRole.key,
        status: created.membership.status,
      },
      entitlement: { planKey: plan.planKey, tierLabel: plan.tierLabel },
      defaultWarehouse: { id: created.warehouse.id, name: created.warehouse.name },
    };
  }
}
