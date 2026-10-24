// F-003 · T-003-B15 ★ — "Owner ≥ 1" read through the locked tx (architecture §2
// "input contract" · §8). Moved out of `MembersService` so the member writes AND
// the role writes (RolesService update/delete — B24/B25) share ONE query: a
// second copy of "who are the owners" is a second place for it to be wrong.
//
// Not a Nest `CanActivate` guard — an injectable the services call inside
// `runInOrgLockTransaction`, BEFORE their write. The rule is the pure
// `assertOwnerRemains` (core-domain `orgs/owner-invariant.ts`); this file only
// decides what it is fed and how its refusal reaches the wire.
import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  LastOwnerError,
  assertOwnerRemains,
  type MembershipStatus,
  type OwnerChange,
  type OwnerMembership,
} from "@omnistock/core-domain";
import { domainError } from "../common";
import { OrgContextStore, type OrgLockTx } from "../tenancy";

/** A membership read for the invariant — any status (the pure fn filters). */
interface OwnerCandidateRow {
  readonly userId: string;
  readonly roleId: string;
  readonly status: string;
  readonly role: { readonly capabilities: string[] };
}

@Injectable()
export class OrgOwnershipGuard {
  private readonly logger = new Logger(OrgOwnershipGuard.name);

  // Explicit @Inject — `tsx` emits no `design:paramtypes` (guard-injection.test.ts).
  constructor(@Inject(OrgContextStore) private readonly store: OrgContextStore) {}

  /**
   * Throws `409 LAST_OWNER` when `change` would leave this org with no active
   * Owner. MUST be called with the `tx` that holds the org lock, before the
   * write it protects (M-2: a read outside the lock decides on a stale view).
   */
  async assertOwnerRemainsInTx(tx: OrgLockTx, change: OwnerChange): Promise<void> {
    const organizationId = this.store.get()?.organizationId;
    // Unreachable through the guard chain; never fall back to a caller value.
    if (!organizationId) throw domainError("INTERNAL");

    // ★ B-8 — the org filter on the ROLE is explicit: `withOrgScope` scopes
    // `Membership` at the top level only, and the nested `role` walk must mean
    // "roles of THIS org" on its own.
    //
    // `deletedAt: null` on the owner branch: a soft-deleted role cannot hold
    // `full_access` (DB CHECKs, data-model §3), and if it ever did, NOT counting
    // its holders refuses more — the fail-closed direction.
    const owners = {
      role: { organizationId, deletedAt: null, capabilities: { has: "full_access" } },
    };
    // Shapes 3/4 change a ROLE: every holder of it is affected, including ones
    // who are not Owners today but would be after (the "∪" of §2).
    const where =
      change.kind === "role_capabilities_change" || change.kind === "role_delete"
        ? { OR: [owners, { roleId: change.roleId, role: { organizationId } }] }
        : owners;

    const rows: readonly OwnerCandidateRow[] = await tx.membership.findMany({
      where,
      select: {
        userId: true,
        roleId: true,
        status: true,
        role: { select: { capabilities: true } },
      },
    });
    const input: readonly OwnerMembership[] = rows.map((row) => ({
      userId: row.userId,
      roleId: row.roleId,
      status: row.status as MembershipStatus,
      capabilities: row.role.capabilities,
    }));

    try {
      assertOwnerRemains({ owners: input, change });
    } catch (error) {
      if (!(error instanceof LastOwnerError)) throw error;
      if (change.kind === "role_capabilities_change" || change.kind === "role_delete") {
        // §8: on the role path the earlier layers (ROLE_LOCKED / FULL_ACCESS_RESERVED)
        // should have refused first — reaching this line means one of them did not.
        this.logger.error(
          `role_invariant_violation ${JSON.stringify({
            // the ORG_LOCK operationKey (metric/log label, §8 — review L-4)
            operation: change.kind === "role_delete" ? "deleteRole" : "updateRole",
            change: change.kind,
            organizationId,
            roleId: change.roleId,
          })}`,
        );
      }
      throw domainError("LAST_OWNER");
    }
  }
}
