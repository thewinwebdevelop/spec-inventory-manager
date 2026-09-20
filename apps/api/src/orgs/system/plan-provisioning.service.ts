// F-002 · T-002-15 ★ — "which plan does a brand-new shop get?" (architecture §6.2).
//
// THE SEAM: one method, `resolveForNewOrg`. Phase 0 answers it from the env
// variable `DEFAULT_ORG_PLAN_KEY`; F-080/F-082 will answer it from the
// licence/subscription the user actually bought. The CALL SITE never changes —
// that is the whole reason this is a service and not three lines inside the
// provisioning transaction.
//
// ── FAIL CLOSED (AC US-1) ──────────────────────────────────────────────────
// No `PlanDefinition` for the configured key ⇒ `503
// ORG_PROVISIONING_UNAVAILABLE`, and the shop is not created.
//
// ⛔ NEVER fall back to `free` (or any other key) when the lookup misses. A
// silent fallback grants a tier nobody authorised, does it invisibly, and would
// be discovered later as "why is this customer on a plan we never sold them?".
// A shop that cannot be created is a support ticket; a shop on the wrong tier is
// a billing and entitlement bug that outlives the misconfiguration.
//
// SYSTEM_PRISMA because `PlanDefinition` is a system catalog with no
// `organizationId` (packages/db `ORG_AGNOSTIC_MODELS`) and, more decisively,
// because this runs on `POST /organizations` where no org context exists at all
// (I-3) — `ORG_PRISMA` would throw `MissingOrgContextError`.
import { Inject, Injectable, Logger } from "@nestjs/common";
import { domainError } from "../../common";
import { SYSTEM_PRISMA, type SystemPrismaClient } from "../../tenancy";
import { DEFAULT_ORG_PLAN_KEY } from "../org-config";

/** The plan a new org will be bound to. */
export interface ResolvedPlan {
  readonly planDefinitionId: string;
  readonly planKey: string;
  readonly tierLabel: string | null;
}

@Injectable()
export class PlanProvisioningService {
  private readonly logger = new Logger(PlanProvisioningService.name);

  // Explicit @Inject on every parameter: `main.ts` runs under `tsx`, which emits
  // no `design:paramtypes`, so a type-only constructor parameter resolves to
  // `undefined` at runtime — the app boots fine under vitest and dies in
  // production (see `common/guard-injection.test.ts` for the guard-side rule).
  constructor(
    @Inject(SYSTEM_PRISMA) private readonly prisma: SystemPrismaClient,
    // Resolved from env ONCE, at boot (see `org-config.ts`) — never per request.
    @Inject(DEFAULT_ORG_PLAN_KEY) private readonly defaultPlanKey: string,
  ) {}

  /**
   * The plan for a shop this user is creating right now.
   *
   * `userId` is unused in Phase 0 and is still part of the signature on purpose:
   * F-080 resolves the plan FROM the buyer, and a seam whose shape has to change
   * is a seam every call site has to be revisited for.
   */
  async resolveForNewOrg(input: { readonly userId: string }): Promise<ResolvedPlan> {
    void input;
    const key = this.defaultPlanKey;
    const plan = await this.prisma.planDefinition.findUnique({
      where: { key },
      select: { id: true, key: true, tierLabel: true },
    });

    if (!plan) {
      // Loud on OUR side, opaque on the wire: the caller learns "not now", the
      // operator learns exactly which key is missing from which seed.
      this.logger.error(
        `DEFAULT_ORG_PLAN_KEY=${JSON.stringify(key)} has no PlanDefinition row — ` +
          `run \`prisma db seed\` (data-model §5.1). Refusing to create the shop: ` +
          `falling back to another plan would grant a tier nobody authorised (§6.2).`,
      );
      throw domainError("ORG_PROVISIONING_UNAVAILABLE");
    }

    return { planDefinitionId: plan.id, planKey: plan.key, tierLabel: plan.tierLabel };
  }
}
