// F-002 · T-002-16b — the role list behind the invite dropdown (api-spec §3.6).
import { Inject, Injectable } from "@nestjs/common";
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
      select: { id: true, name: true, key: true, isSystem: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    })) as { id: string; name: string; key: string | null; isSystem: boolean }[];

    return {
      // Projected field by field. The row also carries `capabilities`, and a
      // spread would publish it — structural typing strips nothing at runtime
      // (the `toMyOrganizationItem` lesson, M-10).
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        key: row.key,
        isSystem: row.isSystem,
      })),
      nextCursor: null,
    };
  }
}
