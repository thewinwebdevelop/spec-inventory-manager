// F-003 · T-003-B21 ★ — the three role READ routes (api-spec §1 GET ×3, §3):
// `GET /capabilities` · `GET /role-details` · `GET /roles/{roleId}`.
//
// ORG_PRISMA ONLY (architecture §9): the tenant filter is injected on every
// read, including the `lastEdited.by` join (SR-09) — an editor who left this
// shop for another one is `former_member`, and no row of the other shop can
// reach this response. No lock, no write, no event: a route that computes
// `viewer.*` emits nothing (architecture §7 last line · I3-57).
import { Inject, Injectable } from "@nestjs/common";
import {
  capabilityCatalog,
  decideRoleWrite,
  isOwnerRole,
  lastEditedBy,
  roleDetailViewer,
  roleListViewer,
  wireNameCustomized,
  type CapabilityCatalogView,
  type LastEditedBy,
  type RoleDetailViewer,
  type RoleWriteVerdict,
} from "@omnistock/core-domain";
import { LIVE_ROLE_WHERE, domainError } from "../common";
import { ORG_PRISMA, OrgContextStore, type OrgScopedPrismaClient } from "../tenancy";
import { ROLE_CAPACITY_LIMITS, ROLE_WRITES_ENABLED, type RoleCapacityLimits } from "./org-config";

/** api-spec §3 `RoleDetail`. */
export interface RoleDetail {
  readonly id: string;
  readonly name: string;
  readonly key: string | null;
  readonly nameCustomized: boolean;
  readonly isSystem: boolean;
  readonly grantsOwnership: boolean;
  readonly capabilities: readonly string[];
  readonly version: number;
  readonly usage: { readonly activeMembers: number; readonly pendingInvitations: number };
  readonly lastEdited: { readonly at: string; readonly by: LastEditedBy } | null;
  readonly viewer: RoleDetailViewer;
  readonly createdAt: string;
}

export interface RoleDetailListPage {
  readonly items: readonly RoleDetail[];
  readonly nextCursor: null;
  readonly viewer: { readonly canCreate: RoleWriteVerdict; readonly limit: number };
}

const ROLE_SELECT = {
  id: true,
  name: true,
  key: true,
  nameCustomized: true,
  isSystem: true,
  capabilities: true,
  version: true,
  lastEditedAt: true,
  lastEditedByUserId: true,
  createdAt: true,
} as const;

interface RoleRowDb {
  id: string;
  name: string;
  key: string | null;
  nameCustomized: boolean;
  isSystem: boolean;
  capabilities: string[];
  version: number;
  lastEditedAt: Date | null;
  lastEditedByUserId: string | null;
  createdAt: Date;
}

interface Viewer {
  readonly userId: string;
  readonly roleId: string;
  readonly capabilities: readonly string[];
}

@Injectable()
export class RoleReadService {
  constructor(
    @Inject(ORG_PRISMA) private readonly prisma: OrgScopedPrismaClient,
    @Inject(OrgContextStore) private readonly store: OrgContextStore,
    @Inject(ROLE_WRITES_ENABLED) private readonly writesEnabled: boolean,
    @Inject(ROLE_CAPACITY_LIMITS) private readonly limits: RoleCapacityLimits,
  ) {}

  /** `GET /capabilities` — the registry this shop sees (AC-7.4: tier `full` hidden). */
  capabilities(): CapabilityCatalogView {
    return capabilityCatalog();
  }

  /** `GET /role-details` — every live role in full, `createdAt asc, id asc`. */
  async listDetails(): Promise<RoleDetailListPage> {
    const viewer = this.viewer();
    const roles = (await this.prisma.role.findMany({
      where: { ...LIVE_ROLE_WHERE },
      select: ROLE_SELECT,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    })) as RoleRowDb[];
    const items = await this.project(roles, roles.length, viewer);
    return {
      items,
      nextCursor: null,
      viewer: roleListViewer({
        writesEnabled: this.writesEnabled,
        liveRoleCount: roles.length,
        maxRoles: this.limits.maxRolesPerOrg,
      }),
    };
  }

  /** `GET /roles/{roleId}` — one live role of THIS shop, or `404` (other shop / deleted / unknown alike). */
  async getDetail(roleId: string): Promise<RoleDetail> {
    const viewer = this.viewer();
    const role = (await this.prisma.role.findFirst({
      where: { id: roleId, ...LIVE_ROLE_WHERE },
      select: ROLE_SELECT,
    })) as RoleRowDb | null;
    if (!role) throw domainError("NOT_FOUND");
    const liveRoleCount = await this.prisma.role.count({ where: { ...LIVE_ROLE_WHERE } });
    const [item] = await this.project([role], liveRoleCount, viewer);
    return item!;
  }

  private async project(
    roles: readonly RoleRowDb[],
    liveRoleCount: number,
    viewer: Viewer,
  ): Promise<RoleDetail[]> {
    const roleIds = roles.map((r) => r.id);
    const editorIds = [
      ...new Set(roles.map((r) => r.lastEditedByUserId).filter((id): id is string => id !== null)),
    ];
    // role-read: history — deleted-row cap (data-model §2.2), for `history_limit_reached`
    const deletedRoleCount = await this.prisma.role.count({ where: { deletedAt: { not: null } } });
    const [active, pending, editors] = await Promise.all([
      this.prisma.membership.groupBy({
        by: ["roleId"],
        where: { roleId: { in: roleIds }, status: "active" },
        _count: { _all: true },
      }),
      // AC-3.9: pending INCLUDING expired links — both block deletion.
      this.prisma.invitation.groupBy({
        by: ["roleId"],
        where: { roleId: { in: roleIds }, status: "pending" },
        _count: { _all: true },
      }),
      // SR-09: the editor's ACTIVE membership in THIS shop, through ORG_PRISMA.
      editorIds.length === 0
        ? Promise.resolve([])
        : this.prisma.membership.findMany({
            where: { userId: { in: editorIds }, status: "active" },
            select: {
              userId: true,
              role: { select: { name: true, key: true, nameCustomized: true } },
            },
          }),
    ]);
    const countOf = (rows: readonly { roleId: string; _count: { _all: number } }[], id: string) =>
      rows.find((r) => r.roleId === id)?._count._all ?? 0;
    const editorOf = new Map(
      (
        editors as {
          userId: string;
          role: { name: string; key: string | null; nameCustomized: boolean };
        }[]
      ).map((m) => [m.userId, m] as const),
    );

    return roles.map((role) => {
      const usage = {
        activeMembers: countOf(active as never, role.id),
        pendingInvitations: countOf(pending as never, role.id),
      };
      const by = lastEditedBy({
        editorUserId: role.lastEditedByUserId,
        viewerUserId: viewer.userId,
        editorMembership:
          role.lastEditedByUserId === null ? null : (editorOf.get(role.lastEditedByUserId) ?? null),
      });
      return {
        id: role.id,
        name: role.name,
        key: role.key,
        nameCustomized: wireNameCustomized(role),
        isSystem: role.isSystem,
        grantsOwnership: isOwnerRole(role.capabilities),
        capabilities: [...role.capabilities],
        version: role.version,
        usage,
        lastEdited:
          by === null || role.lastEditedAt === null
            ? null
            : { at: role.lastEditedAt.toISOString(), by },
        // The SAME decider the write path uses (passed explicitly — the seam I3-57 spies on).
        viewer: roleDetailViewer(
          {
            writesEnabled: this.writesEnabled,
            actorCapabilities: viewer.capabilities,
            role: { isSystem: role.isSystem, capabilities: role.capabilities },
            // Clamped: viewer and usage are separate reads, so a role change between them
            // could make this -1 (→ 500 from the decider's count check). Display-only verdict;
            // the write route re-decides on locked rows (B21 security review, Low).
            otherActiveHolders: Math.max(
              0,
              usage.activeMembers - (viewer.roleId === role.id ? 1 : 0),
            ),
            usage,
            liveRoleCount,
            maxRoles: this.limits.maxRolesPerOrg,
            deletedRoleCount,
            maxDeletedRoles: this.limits.maxDeletedRolesPerOrg,
          },
          decideRoleWrite,
        ),
        createdAt: role.createdAt.toISOString(),
      };
    });
  }

  /** The caller as the org context proved them (read-only route — AC-5.7 re-reads on write). */
  private viewer(): Viewer {
    const ctx = this.store.get();
    if (!ctx?.userId || !ctx.roleId || !ctx.capabilities) throw domainError("INTERNAL");
    return { userId: ctx.userId, roleId: ctx.roleId, capabilities: ctx.capabilities };
  }
}
