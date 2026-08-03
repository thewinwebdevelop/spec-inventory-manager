// F-002 · T-002-16 — `GET /me/organizations` (api-spec §3.2, AC US-2/US-5).
//
// This is the org switcher's data source, and it is the ONE read in F-002 that
// crosses organizations by design: "which shops do I belong to?" cannot be
// answered inside a single tenant. That is why it is in the SYSTEM_PRISMA jail
// (architecture §2.4, row 2) with a single, non-negotiable rule:
//
//   ⛔ EVERY query in this file filters by `userId`. Always. There is no method,
//      branch or option that can produce a query without it — the `where` is
//      built in one place, from the caller's own id, and the id is never a
//      parameter the HTTP layer can influence beyond "who is logged in".
//
// The query STARTS at `Membership` (org-scoped), not at `User` (org-agnostic).
// Rule C-3: a query starting at `User` and including `memberships` gets NO org
// filtering anywhere in the tree, and rule NEW-8 forbids traversing through
// `User` back down into org-scoped rows. Starting here means the only rows this
// can ever see are rows that name this user.
//
// AC US-5 (D-027): a revoked membership disappears from the DEFAULT list the
// instant it is revoked — no cache, no job, no TTL. That is why `status=active`
// is a `where` clause and not a post-filter.
import { Inject, Injectable } from "@nestjs/common";
import { toMyOrganizationItem, type MyOrganizationItem } from "@omnistock/core-domain";
import { paginate, type KeysetCursor } from "../../common/cursor";
import { SYSTEM_PRISMA, type SystemPrismaClient } from "../../tenancy";

/** `?status=` — `active` is the default; `all` is the "shops I used to be in" view. */
export type MyOrganizationsStatusFilter = "active" | "all";

export interface MyOrganizationsPage {
  readonly items: readonly MyOrganizationItem[];
  readonly nextCursor: string | null;
}

@Injectable()
export class MyOrganizationsService {
  // Explicit @Inject — `tsx` emits no `design:paramtypes`.
  constructor(@Inject(SYSTEM_PRISMA) private readonly prisma: SystemPrismaClient) {}

  async list(input: {
    readonly userId: string;
    readonly status: MyOrganizationsStatusFilter;
    readonly limit: number;
    readonly cursor?: KeysetCursor;
  }): Promise<MyOrganizationsPage> {
    const { userId, status, limit, cursor } = input;

    const rows = await this.prisma.membership.findMany({
      where: {
        // The scope of this whole file, in one clause.
        userId,
        // `active` is the default and it is a QUERY filter: AC US-5 requires the
        // revoked shop to be gone from the next request, and anything cached or
        // filtered later would be "gone eventually".
        ...(status === "active" ? { status: "active" as const } : {}),
        // Keyset predicate for the fixed `createdAt desc, id desc` sort. Offset
        // pagination would skip and repeat rows as memberships change under the
        // user's feet.
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.createdAt) } },
                { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      // `limit + 1` — the extra row is what makes `nextCursor: null` honest
      // (see `paginate`).
      take: limit + 1,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        createdAt: true,
        status: true,
        revokedAt: true,
        roleId: true,
        // Explicit `select` on every relation, never `include` (C-4): `include`
        // returns whole rows, and whole rows are how a column nobody thought
        // about reaches the wire.
        role: { select: { name: true, key: true } },
        organization: {
          select: {
            id: true,
            name: true,
            logo: true,
            // The plan the shop is on. `OrgEntitlement` → `PlanDefinition` is a
            // read INTO an org-agnostic catalog and stops there — it never comes
            // back down into another org's rows (NEW-8).
            entitlement: {
              select: { planDefinition: { select: { key: true, tierLabel: true } } },
            },
          },
        },
      },
    });

    const page = paginate(rows, limit, (row) => ({
      createdAt: row.createdAt.toISOString(),
      id: row.id,
    }));

    return {
      // The full-vs-short shape rule (M-10) is a pure function, so "a removed
      // member must not see the role they held or the plan that shop is on" is
      // a table-tested decision rather than a `if` inside a mapper.
      items: page.items.map((row) =>
        toMyOrganizationItem({
          // ⛔ Projected FIELD BY FIELD, never `row.organization` wholesale. The
          // row carries the nested `entitlement` used two lines below, and
          // spreading it would put the shop's PLAN inside `organization` — which
          // the short shape (M-10) then hands to a member who was removed.
          // Caught by `my-organizations.service.test.ts`, not by review.
          organization: {
            id: row.organization.id,
            name: row.organization.name,
            logo: row.organization.logo,
          },
          membership: {
            status: row.status,
            roleId: row.roleId,
            roleName: row.role.name,
            roleKey: row.role.key,
            revokedAt: row.revokedAt,
          },
          entitlement: row.organization.entitlement
            ? {
                planKey: row.organization.entitlement.planDefinition.key,
                tierLabel: row.organization.entitlement.planDefinition.tierLabel,
              }
            : null,
        }),
      ),
      nextCursor: page.nextCursor,
    };
  }
}
