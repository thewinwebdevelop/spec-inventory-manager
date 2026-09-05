// F-002 · T-002-16b — the role list behind the invite dropdown (api-spec §3.6).
import { Inject, Injectable } from "@nestjs/common";
import { isOwnerRole } from "@omnistock/core-domain";
import { ORG_PRISMA, type OrgScopedPrismaClient } from "../tenancy";

/**
 * One role as §3.6 publishes it.
 *
 * ⛔ `capabilities` is deliberately ABSENT. It is the field that decides
 * authorization (`full_access` ⇒ Owner), and putting it on a list any active
 * member can read would invite a client to compute permissions from it —
 * exactly the "decide on the client" mistake `isOwner` exists to prevent
 * elsewhere. Nothing on the invite screen needs it: the server refuses an
 * over-privileged invitation itself (C-1/D-028), so the dropdown does not have
 * to filter.
 */
export interface RoleRow {
  readonly id: string;
  readonly name: string;
  /**
   * Stable slug for TRANSLATION ONLY (ux Q4). Guaranteed `owner`/`admin`/`staff`
   * for the three system roles; `null` for anything F-003 lets a user create,
   * because `key` is the system's namespace and a user-editable identifier is
   * something a client would wrongly come to trust.
   *
   * ⛔ Never a permission input — on either side. "Is this the Owner?" is
   * answered by capabilities, never by this string. @qa's I-45 flips a Staff
   * role's key to `"owner"` in the database precisely to prove that.
   */
  readonly key: string | null;
  /**
   * ★ B-9 — the ONE derived bit this list publishes about capabilities.
   *
   * `isOwnerRole(capabilities)`, the same function `toMemberRow` uses for
   * `isOwner`, so there is one answer to "is this ownership?" in the system.
   * Not `key === "owner"`: `key` is a display slug, F-003 lets people mint
   * roles, and I-45 flips a Staff role's key to `"owner"` in the database to
   * prove the two can disagree.
   *
   * Why publishing it does not undo the paragraph above: it says "granting
   * this role grants ownership", which a member can already read off the role's
   * NAME. What it removes is the client's need to guess — §10.1 asks for the
   * Owner option to be shown disabled to an Admin, and before this a non-Owner
   * client could not identify that option at all.
   */
  readonly grantsOwnership: boolean;
  readonly isSystem: boolean;
}

export interface RoleListPage {
  readonly items: readonly RoleRow[];
  /** Always `null` in F-002 — see the controller. */
  readonly nextCursor: string | null;
}

@Injectable()
export class RolesService {
  constructor(@Inject(ORG_PRISMA) private readonly prisma: OrgScopedPrismaClient) {}

  async list(): Promise<RoleListPage> {
    // No `where` on organizationId: `ORG_PRISMA` applies the tenant filter, and
    // adding a second one here would suggest the client is trustworthy without
    // it. No lock — this decides nothing.
    const rows = (await this.prisma.role.findMany({
      // `capabilities` is selected and NEVER published — it is read here only
      // to derive `grantsOwnership` below. The projection at the end is what
      // keeps it off the wire.
      select: { id: true, name: true, key: true, isSystem: true, capabilities: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    })) as {
      id: string;
      name: string;
      key: string | null;
      isSystem: boolean;
      capabilities: string[];
    }[];

    return {
      // Projected field by field. The row also carries `capabilities`, and a
      // spread would publish it — structural typing strips nothing at runtime
      // (the `toMyOrganizationItem` lesson, M-10).
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        key: row.key,
        // Derived, then the array is dropped. `capabilities` must not appear in
        // this object literal — the field-by-field projection is the control.
        grantsOwnership: isOwnerRole(row.capabilities),
        isSystem: row.isSystem,
      })),
      nextCursor: null,
    };
  }
}
