// F-002 · T-002-17 ★ — `PUT /orgs/{orgId}/tax-profile` and
// `POST /orgs/{orgId}/tax-profile/reveal` (api-spec §3.5 / §3.16).
//
// THE MOST PRIVACY-SENSITIVE SERVICE IN F-002. With `entityType="personal"` the
// column this file reads and writes holds the shop owner's national ID number,
// so three rules apply to every line below and to every line added later:
//
//   1. THE VALUE IS NEVER LOGGED, NEVER PUT IN AN EVENT, NEVER ECHOED (M-7ค /
//      architecture §9). `org.tax_profile.set` carries `taxIdPresent: true` and
//      nothing more; `org.tax_profile.revealed` carries only actor + org. The
//      emitter enforces this too (`STRICT_PAYLOAD_EVENT_TYPES`) — belt and
//      braces, because the day somebody adds "just one debug field" it must not
//      matter which of the two layers they were thinking about.
//   2. THE FULL NUMBER LEAVES THROUGH `reveal` AND NOWHERE ELSE. `PUT` answers
//      with the ordinary §3.3 profile body — the same mapper, the same masking,
//      no reflection of what was just sent (api-spec §3.5).
//   3. THE EVENT IS EMITTED POST-COMMIT (H-3). A rolled-back write must not
//      leave an audit line claiming it happened, and a reveal that failed must
//      not leave one claiming somebody saw the number.
//
// `ORG_PRISMA` — never `SYSTEM_PRISMA`. Every query here is automatically
// filtered by the request's `organizationId`; the id comes from the ALS context
// the guard chain proved, never from the `:orgId` in the URL.
import { Inject, Injectable } from "@nestjs/common";
import {
  toTaxProfileReveal,
  type OrgProfileView,
  type RevealedTaxProfile,
  type TaxProfileWrite,
} from "@omnistock/core-domain";
import { domainError } from "../common";
import { SecurityEventsService } from "../auth";
import { ORG_PRISMA, OrgContextStore, type OrgScopedPrismaClient } from "../tenancy";
import { OrgProfileService } from "./org-profile.service";

@Injectable()
export class TaxProfileService {
  // Explicit @Inject on every parameter — `tsx` emits no `design:paramtypes`,
  // so a type-only parameter resolves to `undefined` in production only.
  constructor(
    @Inject(ORG_PRISMA) private readonly prisma: OrgScopedPrismaClient,
    @Inject(OrgContextStore) private readonly store: OrgContextStore,
    @Inject(OrgProfileService) private readonly profile: OrgProfileService,
    @Inject(SecurityEventsService) private readonly events: SecurityEventsService,
  ) {}

  /**
   * api-spec §3.5 — replace the whole tax identity (or clear it), then answer
   * with the §3.3 profile body.
   *
   * `write` is already all-or-nothing: `validateTaxProfilePut` produced either a
   * complete set or four `null`s, so this method has no combination rule of its
   * own to get wrong. All four columns are written every time — a `PUT` that
   * only touched the keys it was sent would leave a stale branch code attached
   * to a brand-new TIN.
   */
  async set(write: TaxProfileWrite): Promise<OrgProfileView> {
    const organizationId = this.requireOrganizationId();
    const actorUserId = this.requireUserId();

    await this.prisma.organization.update({
      // Scoped by `id` (the tenant root's own org column, packages/db
      // `scopeTenantRoot`): another tenant's id here is refused by the seam
      // before it reaches SQL.
      where: { id: organizationId },
      data: {
        taxEntityType: write.taxEntityType,
        taxId: write.taxId,
        vatRegistered: write.vatRegistered,
        taxBranchCode: write.taxBranchCode,
      },
      select: { id: true },
    });

    // POST-COMMIT (H-3). `taxIdPresent` is a BOOLEAN, and that is the entire
    // audit trail this event may carry about the number: architecture §9 rejected
    // "mask the last 6" as both meaningless and a slow leak — whoever may read
    // the value can read it from the database with the right capability, through
    // the endpoint that logs the fact.
    this.events.emit("org.tax_profile.set", {
      actorUserId,
      organizationId,
      taxEntityType: write.taxEntityType,
      vatRegistered: write.vatRegistered,
      taxIdPresent: write.taxId !== null,
    });

    // Same body `GET` returns — including the masking rule. The caller typed the
    // number, so echoing it back adds nothing and adds one more place it exists.
    return this.profile.get();
  }

  /**
   * api-spec §3.16 — the one place a full TIN leaves the system.
   *
   * `404 NOT_FOUND` when nothing is declared. It is NOT an authorization signal:
   * the caller already proved `manage_org_settings` on this org, so "there is no
   * number here" tells them nothing they could not learn from
   * `taxProfileComplete` on the profile they can already read.
   *
   * The event is emitted only on the path where a value actually left — a `404`
   * revealed nothing, and an audit trail that says "revealed" for a request that
   * returned no number makes the real ones harder to read.
   */
  async reveal(now: Date): Promise<RevealedTaxProfile> {
    const organizationId = this.requireOrganizationId();
    const actorUserId = this.requireUserId();

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      // ⛔ Two columns. NOT the whole row: a widened select here is how a TIN
      // reaches a log line or a future mapper that was written for a narrower
      // shape (the `toMyOrganizationItem` lesson).
      select: { taxEntityType: true, taxId: true },
    });
    if (!organization) throw domainError("INTERNAL");

    const revealed = toTaxProfileReveal(organization, now);
    if (!revealed) throw domainError("NOT_FOUND");

    // POST-READ, and deliberately BEFORE the value is returned to the caller:
    // the whole difference between "allowed to see it" and "seen with nobody
    // knowing" is this line. Actor + org only — never the number, not even part
    // of it (D-030 / architecture §9).
    this.events.emit("org.tax_profile.revealed", { actorUserId, organizationId });

    return revealed;
  }

  // ── internals ────────────────────────────────────────────────────────────

  private requireOrganizationId(): string {
    const ctx = this.store.get();
    // Unreachable through the guard chain: an org-scoped route only runs with
    // `orgOutcome === 'ok'`. Reaching here means the chain is mis-wired, which
    // is our bug — fail loud, never fall back to a path param.
    if (!ctx?.organizationId) throw domainError("INTERNAL");
    return ctx.organizationId;
  }

  private requireUserId(): string {
    const ctx = this.store.get();
    // An unattributable reveal is worse than a refused one: the event exists to
    // answer "who looked", and "someone" is not an answer.
    if (!ctx?.userId) throw domainError("INTERNAL");
    return ctx.userId;
  }
}
