// F-002 · T-002-16 — `GET`/`PATCH /orgs/{orgId}` orchestration.
//
// The service's job is: read through `ORG_PRISMA`, hand the rows to the pure
// mapper, write only what was validated. So the assertions are about WHICH
// client is used, WHICH org id is used, and what is passed on — never about the
// field-level authorization rules themselves, which are proven exhaustively in
// `packages/core-domain/src/orgs/org-profile.test.ts` and must not be re-proven
// (a second copy of a rule is a second place for it to drift).
import { describe, it, expect, vi } from "vitest";
import { DomainException } from "../common/domain-exception";
import { OrgProfileService } from "./org-profile.service";

const ORG_ID = "org_ctx";
const USER_ID = "usr_me";

const ORG_ROW = {
  id: ORG_ID,
  name: "ร้าน ก",
  logo: null,
  timezone: "Asia/Bangkok",
  currency: "THB",
  taxEntityType: "company",
  taxId: "0105551234567",
  vatRegistered: true,
  taxBranchCode: "00000",
};

function createService(over: { readonly membership?: unknown; readonly organization?: unknown } = {}) {
  const calls: { model: string; args: unknown }[] = [];
  const track = (model: string, result: unknown) =>
    vi.fn(async (args: unknown) => {
      calls.push({ model, args });
      return result;
    });

  const prisma = {
    organization: {
      findUnique: track("organization.findUnique", over.organization ?? ORG_ROW),
      update: track("organization.update", { id: ORG_ID }),
    },
    membership: {
      findFirst: track(
        "membership.findFirst",
        over.membership ?? {
          status: "active",
          roleId: "rol_1",
          role: { name: "Owner", key: "owner", capabilities: ["full_access"] },
        },
      ),
      count: track("membership.count", 4),
    },
    orgEntitlement: {
      findFirst: track("orgEntitlement.findFirst", {
        planDefinition: { key: "comp_full", tierLabel: "Full (comp)" },
      }),
    },
    invitation: { count: track("invitation.count", 1) },
  };

  const store = { get: () => ({ organizationId: ORG_ID, userId: USER_ID }) };
  return {
    service: new OrgProfileService(prisma as never, store as never),
    prisma,
    calls,
  };
}

describe("OrgProfileService.get", () => {
  it("returns the §3.3 body assembled from the org-scoped reads", async () => {
    const { service } = createService();
    const view = await service.get();
    expect(view).toMatchObject({
      id: ORG_ID,
      name: "ร้าน ก",
      currency: "THB",
      taxProfileComplete: true,
      entitlement: { planKey: "comp_full", tierLabel: "Full (comp)" },
      counts: { activeMembers: 4, pendingInvitations: 1 },
      myMembership: { roleId: "rol_1", roleName: "Owner", roleKey: "owner", status: "active" },
    });
  });

  it("★ addresses the org by the CONTEXT id, never a path parameter", async () => {
    // The guard chain proved membership of the CONTEXT org. A handler that
    // re-read `:orgId` would be authorizing one org and reading another.
    const { service, prisma } = createService();
    await service.get();
    expect(prisma.organization.findUnique.mock.calls[0][0]).toMatchObject({
      where: { id: ORG_ID },
    });
  });

  it("★ scopes 'my membership' by userId (the org filter is the seam's job)", async () => {
    const { service, prisma } = createService();
    await service.get();
    expect(prisma.membership.findFirst.mock.calls[0][0]).toMatchObject({
      where: { userId: USER_ID },
    });
  });

  it("★ counts only ACTIVE members and UNEXPIRED pending invitations", async () => {
    const { service, prisma } = createService();
    await service.get();
    expect(prisma.membership.count.mock.calls[0][0]).toEqual({ where: { status: "active" } });
    const invitationWhere = (prisma.invitation.count.mock.calls[0][0] as {
      where: { status: string; expiresAt: { gt: Date } };
    }).where;
    expect(invitationWhere.status).toBe("pending");
    // A row that is still `pending` but past `expiresAt` is expired
    // (data-model §3.2) — counting it would show an invitation nobody can accept.
    expect(invitationWhere.expiresAt.gt).toBeInstanceOf(Date);
  });

  it("★ never uses `include` — every relation read is an explicit `select` (C-4)", async () => {
    const { service, calls } = createService();
    await service.get();
    for (const call of calls) {
      expect(JSON.stringify(call.args ?? {})).not.toContain('"include"');
    }
  });

  it("an org with no entitlement maps to `entitlement: null`", async () => {
    const { service, prisma } = createService();
    prisma.orgEntitlement.findFirst.mockResolvedValueOnce(null as never);
    await expect(service.get()).resolves.toMatchObject({ entitlement: null });
  });

  it("500s rather than answering a partial body when the row vanished", async () => {
    const { service, prisma } = createService();
    prisma.organization.findUnique.mockResolvedValueOnce(null as never);
    const error = (await service.get().catch((e: unknown) => e)) as DomainException;
    expect(error).toBeInstanceOf(DomainException);
    expect(error.getStatus()).toBe(500);
  });

  it("500s when the org context is missing (mis-wired chain, never a fallback)", async () => {
    const { service } = createService();
    const noContext = new OrgProfileService(
      {} as never,
      { get: () => undefined } as never,
    );
    await expect(noContext.get()).rejects.toBeInstanceOf(DomainException);
    // …while the wired one works, so the assertion above is about the context.
    await expect(service.get()).resolves.toBeTruthy();
  });
});

describe("OrgProfileService.update", () => {
  it("writes the patch, scoped by the context org id", async () => {
    const { service, prisma } = createService();
    await service.update({ name: "ร้านใหม่" });
    expect(prisma.organization.update.mock.calls[0][0]).toMatchObject({
      where: { id: ORG_ID },
      data: { name: "ร้านใหม่" },
    });
  });

  it("★ an EMPTY patch writes nothing at all (no `updatedAt` churn)", async () => {
    const { service, prisma } = createService();
    await service.update({});
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it("returns the same body `GET` returns", async () => {
    const { service } = createService();
    const patched = await service.update({ logo: null });
    const fetched = await service.get();
    expect(Object.keys(patched).sort()).toEqual(Object.keys(fetched).sort());
  });

  it("writes `logo: null` through (the one accepted logo value in Phase 0)", async () => {
    const { service, prisma } = createService();
    await service.update({ logo: null });
    expect(prisma.organization.update.mock.calls[0][0]).toMatchObject({ data: { logo: null } });
  });
});
