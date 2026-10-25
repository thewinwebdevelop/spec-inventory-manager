// F-003 · T-003-B15 ★ — on a REAL Postgres: the two B15 seams whose fakes could
// lie about Prisma.
//
//  1. `OrgOwnershipGuard` (architecture §2 input contract): the `OR` / nested
//     `role` relation filter is evaluated by Postgres through the org-scoped
//     client, inside the real org lock — owners of THIS org ∪ holders of the
//     role being changed, never another shop's Owner.
//  2. `LIVE_ROLE_WHERE` (data-model §2.2 · G3-04's int pair, the slice of I3-10
//     that exists before the role routes): a soft-deleted role is invisible to
//     `GET /roles`, and PATCH member / POST invitation answer it exactly like
//     an id that never existed (`422 ROLE_INVALID`).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { PrismaClient } from "@omnistock/db";
import type { OwnerChange } from "@omnistock/core-domain";
import { AccessTokenService } from "../src/auth/access-token.service";
import { DomainException } from "../src/common/domain-exception";
import { OrgOwnershipGuard } from "../src/orgs/org-ownership.guard";
import {
  ORG_PRISMA,
  OrgContextStore,
  runInOrgLockTransaction,
  type OrgScopedPrismaClient,
} from "../src/tenancy";
import { assertErrorEnvelope } from "./assertions.kit";
import { INT_LANE_ENABLED, createTestApp, type TestApp } from "./app.kit";
import { createF003SeedKit, type F003SeedKit } from "./f003-seed.kit";
import type { SeededOrg } from "./f002-seed.kit";

const d = INT_LANE_ENABLED ? describe : describe.skip;
if (!INT_LANE_ENABLED) {
  console.warn(
    "[T-003-B15] SKIPPING OrgOwnershipGuard + LIVE_ROLE_WHERE on Postgres: TEST_DATABASE_URL / " +
      "TEST_REDIS_URL are not set. The owner query and the live-role filter are NOT verified in this run.",
  );
}

d("T-003-B15 — OrgOwnershipGuard + LIVE_ROLE_WHERE on Postgres", () => {
  let app: TestApp;
  let prisma: PrismaClient;
  let kit: F003SeedKit;

  const token = (userId: string): string =>
    app.app.get(AccessTokenService, { strict: false }).sign(userId);

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
    await prisma.$connect();
    app = await createTestApp();
    kit = createF003SeedKit(prisma, { label: "b15" });
  });

  afterAll(async () => {
    if (kit) await kit.cleanup();
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
  });

  /** Run the guard exactly as a service does: org context → org lock → guard. */
  async function guardCode(organizationId: string, change: OwnerChange): Promise<string> {
    const guard = app.app.get(OrgOwnershipGuard, { strict: false });
    const store = app.app.get(OrgContextStore, { strict: false });
    const client = app.app.get<OrgScopedPrismaClient>(ORG_PRISMA, { strict: false });
    try {
      await store.run({ organizationId, userId: "usr_b15_actor" }, () =>
        runInOrgLockTransaction(client, (tx) => guard.assertOwnerRemainsInTx(tx, change)),
      );
      return "OK";
    } catch (error) {
      if (error instanceof DomainException) return error.code;
      throw error;
    }
  }

  async function shopWith(
    members: ReadonlyArray<{ role: string; status?: "active" | "revoked" }>,
  ): Promise<{ org: SeededOrg; userIds: string[] }> {
    const org = await kit.createOrg();
    const userIds: string[] = [];
    for (const m of members) {
      const user = await kit.createUser();
      await kit.addMember({
        organizationId: org.id,
        userId: user.id,
        roleId: org.roles[m.role]!.id,
        status: m.status ?? "active",
        ...(m.status === "revoked" ? { revokedAt: new Date() } : {}),
      });
      userIds.push(user.id);
    }
    return { org, userIds };
  }

  // ── 1. OrgOwnershipGuard ──────────────────────────────────────────────────

  it("★ shape 3: taking full_access off the Owner role (two Owners on it) → LAST_OWNER", async () => {
    const { org } = await shopWith([{ role: "Owner" }, { role: "Owner" }, { role: "Staff" }]);
    expect(
      await guardCode(org.id, {
        kind: "role_capabilities_change",
        roleId: org.roles.Owner!.id,
        newCapabilities: ["manage_members"],
      }),
    ).toBe("LAST_OWNER");
  });

  it("★ shape 4: deleting a role no Owner holds → passes (control)", async () => {
    const { org } = await shopWith([{ role: "Owner" }, { role: "Staff" }]);
    expect(await guardCode(org.id, { kind: "role_delete", roleId: org.roles.Staff!.id })).toBe(
      "OK",
    );
  });

  it("★ union: a role GAINING full_access counts its holders — read through the OR branch", async () => {
    // No active Owner today (the Owner is revoked); Staff's holder becomes one.
    const { org } = await shopWith([{ role: "Owner", status: "revoked" }, { role: "Staff" }]);
    expect(
      await guardCode(org.id, {
        kind: "role_capabilities_change",
        roleId: org.roles.Staff!.id,
        newCapabilities: ["full_access"],
      }),
    ).toBe("OK");
    // control: same shop, a change that grants nothing → no Owner remains.
    expect(await guardCode(org.id, { kind: "role_delete", roleId: org.roles.Staff!.id })).toBe(
      "LAST_OWNER",
    );
  });

  it("★ another shop's active Owner never counts for this one", async () => {
    await shopWith([{ role: "Owner" }]); // shop B — has an active Owner
    const a = await shopWith([{ role: "Owner", status: "revoked" }, { role: "Staff" }]);
    expect(await guardCode(a.org.id, { kind: "role_delete", roleId: a.org.roles.Staff!.id })).toBe(
      "LAST_OWNER",
    );
  });

  // ── 2. LIVE_ROLE_WHERE ────────────────────────────────────────────────────

  async function shopWithDeletedRole() {
    const { org, userIds } = await shopWith([{ role: "Owner" }, { role: "Staff" }]);
    const gone = await kit.createCustomRole({
      organizationId: org.id,
      name: `Packer ${Date.now()}`,
      capabilities: ["manage_stock"],
    });
    await kit.softDeleteRole(org.id, gone.id);
    return { org, owner: userIds[0]!, staff: userIds[1]!, gone };
  }

  it("★ GET /roles does not offer a soft-deleted role (MUT-10)", async () => {
    const { org, owner, gone } = await shopWithDeletedRole();
    const res = await request(app.server())
      .get(`/orgs/${org.id}/roles`)
      .set("Authorization", `Bearer ${token(owner)}`);
    expect(res.status).toBe(200);
    const ids = (res.body.items as { id: string }[]).map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining([org.roles.Owner!.id, org.roles.Staff!.id]));
    expect(ids).not.toContain(gone.id);
  });

  it("★ PATCH member to a soft-deleted role → 422 ROLE_INVALID, and the membership is unchanged", async () => {
    const { org, owner, staff, gone } = await shopWithDeletedRole();
    const res = await request(app.server())
      .patch(`/orgs/${org.id}/members/${staff}`)
      .set("Authorization", `Bearer ${token(owner)}`)
      .set("Content-Type", "application/json")
      .send({ roleId: gone.id });
    assertErrorEnvelope(res, { status: 422, code: "ROLE_INVALID" });
    const row = await prisma.membership.findFirstOrThrow({
      where: { organizationId: org.id, userId: staff },
    });
    expect(row.roleId).toBe(org.roles.Staff!.id);
  });

  it("★ POST invitation with a soft-deleted role → 422 ROLE_INVALID, nothing created", async () => {
    const { org, owner, gone } = await shopWithDeletedRole();
    const res = await request(app.server())
      .post(`/orgs/${org.id}/invitations`)
      .set("Authorization", `Bearer ${token(owner)}`)
      .set("Content-Type", "application/json")
      .send({ email: `b15-${Date.now()}@example.com`, roleId: gone.id });
    assertErrorEnvelope(res, { status: 422, code: "ROLE_INVALID" });
    expect(await prisma.invitation.count({ where: { organizationId: org.id } })).toBe(0);
  });
});
