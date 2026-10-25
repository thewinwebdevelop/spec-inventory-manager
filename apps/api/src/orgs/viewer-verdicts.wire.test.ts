// F-003 · T-003-B22 ★ — U-API3-16: the verdict on the wire is the SAME function
// the write uses (test-plan U-API3-16 · api-spec §3.1 · architecture §1.2).
//
// The pure rule is proven in core-domain (`viewer-verdicts.test.ts`). What only
// this layer can get wrong: feeding the mapper the wrong inputs — the viewer's
// caps from somewhere other than the request context, the row's caps swapped
// with the viewer's, or the audience rule skipped. So every pair below is run
// through the real service list() and compared against `decideMemberAuthority`
// / `decideAdminResetVisible` called independently, the way the write calls them.
import { describe, it, expect } from "vitest";
import {
  decideAdminResetVisible,
  decideMemberAuthority,
  hasCapability,
} from "@omnistock/core-domain";
import { SecurityEventsService } from "../auth/security-events.service";
import { OrgContextStore } from "../tenancy";
import { InvitationsService } from "./invitations.service";
import { MembersService } from "./members.service";
import { OrgOwnershipGuard } from "./org-ownership.guard";
import { RolesService } from "./roles.service";

/** Fixture roles: equal / superset / subset / incomparable pairs all occur. */
const ROLE_CAPS: Readonly<Record<string, readonly string[]>> = {
  owner: ["full_access"],
  admin: ["manage_members", "manage_org_settings", "manage_products", "manage_roles"],
  mm: ["manage_members", "manage_products"],
  mr: ["manage_roles", "manage_orders", "manage_products"],
  staff: ["manage_orders", "manage_products", "manage_stock"],
  bill: ["manage_billing", "manage_orders"],
  mmr: ["manage_members", "manage_roles"],
};
const ROLE_IDS = Object.keys(ROLE_CAPS);
const T0 = new Date("2026-10-01T00:00:00.000Z");

const has = (caps: readonly string[], key: string) => hasCapability(caps, key);
const ctx = (userId: string, capabilities: readonly string[]) => ({
  organizationId: "org_1",
  userId,
  capabilities,
});

function role(id: string) {
  return { id, name: id, key: null, capabilities: [...ROLE_CAPS[id]!], nameCustomized: false };
}

function membersService() {
  const rows = ROLE_IDS.map((roleId, i) => ({
    id: `mem_${i}`,
    userId: `usr_${roleId}`,
    roleId,
    status: "active",
    activatedAt: T0,
    revokedAt: null,
    createdAt: new Date(T0.getTime() + i),
    role: role(roleId),
    user: { id: `usr_${roleId}`, email: `${roleId}@example.test` },
  }));
  const prisma = {
    membership: { findMany: async () => rows, count: async () => rows.length },
  };
  const store = new OrgContextStore();
  const service = new MembersService(
    prisma as never,
    store,
    new SecurityEventsService(),
    new OrgOwnershipGuard(store),
  );
  return { service, store };
}

describe("U-API3-16 · MemberRow verdicts = the write's decision, every viewer × row", () => {
  it("★ viewerCanManage ≡ PATCH(no-op) ≡ DELETE · viewerCanResetPassword ≡ decideAdminResetVisible · audience", async () => {
    const { service, store } = membersService();
    let checked = 0;
    let refused = 0;
    for (const viewerRole of ROLE_IDS) {
      const viewerCaps = ROLE_CAPS[viewerRole]!;
      const viewerId = `usr_${viewerRole}`; // the viewer is one of the rows (own row covered)
      const page = await store.run(ctx(viewerId, viewerCaps), () =>
        service.list({ status: "all", limit: 50, withTotal: false }),
      );
      const inAudience = has(viewerCaps, "manage_members") && has(viewerCaps, "manage_roles");
      for (const row of page.items) {
        if (!inAudience) {
          expect(row, `${viewerRole}→${row.roleId}`).not.toHaveProperty("viewerCanManage");
          expect(row).not.toHaveProperty("viewerCanResetPassword");
          continue;
        }
        const targetCaps = ROLE_CAPS[row.roleId]!;
        const self = row.userId === viewerId;
        const patch = decideMemberAuthority({
          op: "change_role",
          actorCapabilities: viewerCaps,
          actorIsTarget: self,
          targetCurrentCapabilities: targetCaps,
          grantCapabilities: targetCaps,
        });
        const remove = decideMemberAuthority({
          op: "remove",
          actorCapabilities: viewerCaps,
          actorIsTarget: self,
          targetCurrentCapabilities: targetCaps,
        });
        const reset = decideAdminResetVisible(
          { userId: viewerId, capabilities: viewerCaps },
          { userId: row.userId, capabilities: targetCaps },
        );
        expect(row.viewerCanManage, `${viewerRole}→${row.roleId}`).toBe(patch.ok);
        expect(row.viewerCanManage).toBe(remove.ok);
        expect(row.viewerCanResetPassword).toBe(reset.ok);
        expect(row.resetBlockedReason).toBe(reset.ok ? null : reset.reason);
        if (!patch.ok) {
          refused++;
          const expected =
            patch.reason === "owner_only"
              ? "owner_only"
              : patch.reason === "target_not_below_actor" && patch.relation === "equal"
                ? "equal_permissions"
                : "exceeds_your_permissions";
          expect(row.manageBlockedReason).toBe(expected);
        } else {
          expect(row.manageBlockedReason).toBeNull();
        }
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(15);
    expect(refused).toBeGreaterThan(3);
  });
});

describe("U-API3-16 · RoleRow.viewerCanAssign = invite create grant axis", () => {
  it("★ every viewer × role, absent without manage_members", async () => {
    const prisma = {
      role: {
        findMany: async () =>
          ROLE_IDS.map((id) => ({ ...role(id), isSystem: id === "owner", deletedAt: null })),
      },
    };
    const store = new OrgContextStore();
    const service = new RolesService(prisma as never, store);
    let checked = 0;
    for (const viewerRole of ROLE_IDS) {
      const viewerCaps = ROLE_CAPS[viewerRole]!;
      const { items } = await store.run(ctx("usr_v", viewerCaps), () => service.list());
      for (const row of items) {
        if (!has(viewerCaps, "manage_members")) {
          expect(row).not.toHaveProperty("viewerCanAssign");
          continue;
        }
        const write = decideMemberAuthority({
          op: "invite_create",
          actorCapabilities: viewerCaps,
          actorIsTarget: false,
          grantCapabilities: ROLE_CAPS[row.id]!,
        });
        expect(row.viewerCanAssign, `${viewerRole}→${row.id}`).toBe(write.ok);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(15);
  });
});

describe("U-API3-16 · Invitation.viewerCanManage = invite_cancel (⊆)", () => {
  it("★ every viewer × invitation role, stored pending only", async () => {
    const statuses = ["pending", "accepted", "cancelled"] as const;
    const rows = ROLE_IDS.flatMap((roleId, i) =>
      statuses.map((status, j) => ({
        id: `inv_${i}_${j}`,
        email: `${roleId}${j}@example.test`,
        roleId,
        status,
        // expired-by-clock rows are still stored `pending` → still get a verdict
        expiresAt:
          j === 0 && i % 2 === 1
            ? new Date("2000-01-01T00:00:00Z")
            : new Date("2999-01-01T00:00:00Z"),
        tokenIssuedAt: T0,
        invitedByUserId: "usr_x",
        createdAt: new Date(T0.getTime() + i * 10 + j),
        acceptedAt: null,
        acceptedByUserId: null,
        acceptedUserCreatedAt: null,
        role: role(roleId),
      })),
    );
    const prisma = { invitation: { findMany: async () => rows } };
    const store = new OrgContextStore();
    const service = new InvitationsService(
      prisma as never,
      store,
      new SecurityEventsService(),
      100,
      "https://app.example.test",
      {} as never,
    );
    let checked = 0;
    for (const viewerRole of ROLE_IDS) {
      const viewerCaps = ROLE_CAPS[viewerRole]!;
      const { items } = await store.run(ctx("usr_v", viewerCaps), () =>
        service.list({ limit: 100 }),
      );
      expect(items.some((r) => r.status === "expired")).toBe(true);
      for (const row of items) {
        const storedPending = row.status === "pending" || row.status === "expired";
        if (!has(viewerCaps, "manage_members") || !storedPending) {
          expect(row, `${viewerRole}/${row.id}`).not.toHaveProperty("viewerCanManage");
          continue;
        }
        const write = decideMemberAuthority({
          op: "invite_cancel",
          actorCapabilities: viewerCaps,
          actorIsTarget: false,
          grantCapabilities: ROLE_CAPS[row.roleId]!,
        });
        expect(row.viewerCanManage, `${viewerRole}/${row.id}`).toBe(write.ok);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(15);
  });
});
