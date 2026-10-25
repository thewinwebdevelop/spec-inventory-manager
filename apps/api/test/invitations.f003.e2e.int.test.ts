// F-003 · T-003-B18 ★ — invite create / reissue / cancel under D-034 + D-035,
// against a real Postgres (api-spec §4.3 rows invitations · link · cancel).
//
//   I3-20 (invite)  role ⊄ caller, sent past the UI → `403 ROLE_EXCEEDS_ACTOR`
//                   with NO details · `escalation_denied` carries the excess ·
//                   nothing is written (create / reissue / cancel).
//   I3-39           reissue by X ⇒ the row has `issuedByUserId = X`,
//                   `invitedByUserId` unchanged, and `issuedByUserId` is on no
//                   response (JSON scan of reissue + list).
//   I3-41           a role with `manage_roles` but not `manage_members` gets the
//                   24h TTL (create AND reissue) · Staff keeps 168h.
//   R3-04 (invite)  F-002 let an Admin cancel an Owner invitation (no role rule
//                   on cancel). F-003 inverts it: `403 FORBIDDEN`, row untouched.
//
// Every refusal reads the row back — a status code alone would be satisfied by
// a route that never works, so each block has an allowed control.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { PrismaClient } from "@omnistock/db";
import {
  INVITATION_TTL_HOURS_ELEVATED,
  INVITATION_TTL_HOURS_STANDARD,
} from "@omnistock/core-domain";
import { AccessTokenService } from "../src/auth/access-token.service";
import {
  collectSecurityEvents,
  type SecurityEventCollector,
} from "../src/auth/security-events.service";
import { assertErrorEnvelope } from "./assertions.kit";
import { INT_LANE_ENABLED, applyTestEnv, createTestApp, type TestApp } from "./app.kit";
import { createF003SeedKit, type F003SeedKit } from "./f003-seed.kit";
import type { SeededOrg, SeededRole, SeededUser } from "./f002-seed.kit";

const d = INT_LANE_ENABLED ? describe : describe.skip;
const HOUR = 3_600_000;

d("T-003-B18 invitations — D-034 grant ⊆ · D-035 issuedByUserId · TTL (E2E, DB)", () => {
  let app: TestApp;
  let prisma: PrismaClient;
  let kit: F003SeedKit;
  let sink: SecurityEventCollector;

  // shop: Owner, Admin, MM {manage_members, manage_products}
  let org: SeededOrg;
  let owner: SeededUser;
  let admin: SeededUser;
  let mm: SeededUser;
  let rOrders: SeededRole; // ⊄ MM
  let rProducts: SeededRole; // ⊆ MM
  let rMr: SeededRole; // manage_roles, no manage_members (I3-41)

  const token = (userId: string): string =>
    app.app.get(AccessTokenService, { strict: false }).sign(userId);
  const auth = (u: SeededUser) => `Bearer ${token(u.id)}`;

  const invite = (u: SeededUser, roleId: string, email: string) =>
    request(app.server())
      .post(`/orgs/${org.id}/invitations`)
      .set("Authorization", auth(u))
      .set("Content-Type", "application/json")
      .send({ email, roleId });
  const reissue = (u: SeededUser, invitationId: string) =>
    request(app.server())
      .post(`/orgs/${org.id}/invitations/${invitationId}/link`)
      .set("Authorization", auth(u));
  const cancel = (u: SeededUser, invitationId: string) =>
    request(app.server())
      .delete(`/orgs/${org.id}/invitations/${invitationId}`)
      .set("Authorization", auth(u));

  let seq = 0;
  const email = (tag: string) => `b18-${tag}-${Date.now().toString(36)}-${seq++}@example.com`;

  /** A pending invitation seeded directly, issued by the Owner. */
  async function pendingInvitation(role: SeededRole, over: { invitedBy?: SeededUser } = {}) {
    return kit.createInvitation({
      organizationId: org.id,
      email: email("seed"),
      roleId: role.id,
      issuedByUserId: (over.invitedBy ?? owner).id,
      status: "pending",
      tokenIssuedAt: new Date(Date.now() - HOUR),
      expiresAt: new Date(Date.now() + 2 * 24 * HOUR),
    });
  }

  const rowOf = (id: string) => prisma.invitation.findUniqueOrThrow({ where: { id } });

  beforeAll(async () => {
    applyTestEnv();
    prisma = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
    await prisma.$connect();
    app = await createTestApp();
    kit = createF003SeedKit(prisma, { label: "b18" });
    sink = collectSecurityEvents(app.events);

    org = await kit.createOrg();
    rOrders = await kit.createCustomRole({
      organizationId: org.id,
      name: "B18 Orders",
      capabilities: ["manage_orders"],
    });
    rProducts = await kit.createCustomRole({
      organizationId: org.id,
      name: "B18 Products",
      capabilities: ["manage_products"],
    });
    rMr = await kit.createCustomRole({
      organizationId: org.id,
      name: "B18 MR",
      capabilities: ["manage_roles", "manage_orders", "manage_products"],
    });
    const rMm = await kit.createCustomRole({
      organizationId: org.id,
      name: "B18 MM",
      capabilities: ["manage_members", "manage_products"],
    });
    owner = await kit.createUser();
    admin = await kit.createUser();
    mm = await kit.createUser();
    await kit.addMember({ organizationId: org.id, userId: owner.id, roleId: org.roles.Owner.id });
    await kit.addMember({ organizationId: org.id, userId: admin.id, roleId: org.roles.Admin.id });
    await kit.addMember({ organizationId: org.id, userId: mm.id, roleId: rMm.id });
  });

  beforeEach(() => sink.clear());

  afterAll(async () => {
    sink?.stop();
    if (kit) await kit.cleanup();
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
  });

  function expectExceedsEvent(operation: string, roleId: string, actor: SeededUser): void {
    const denied = sink.ofType("org.role.escalation_denied");
    expect(denied).toHaveLength(1);
    expect(denied[0]!.payload).toMatchObject({
      actorUserId: actor.id,
      organizationId: org.id,
      roleId,
      targetUserId: null,
      operation,
      reason: "exceeds_actor",
      excessCapabilities: ["manage_orders"],
    });
  }

  // ── I3-20 (invite) ────────────────────────────────────────────────────────

  describe("I3-20 ★ AC-2.3 · role ⊄ caller → 403 ROLE_EXCEEDS_ACTOR, no details, nothing written", () => {
    it("create", async () => {
      const addr = email("exceeds");
      const res = await invite(mm, rOrders.id, addr);
      assertErrorEnvelope(res, { status: 403, code: "ROLE_EXCEEDS_ACTOR" });
      expect(res.body.error.details).toBeUndefined();
      expect(
        await prisma.invitation.count({ where: { organizationId: org.id, email: addr } }),
      ).toBe(0);
      expectExceedsEvent("invite_create", rOrders.id, mm);
      expect(sink.ofType("org.invitation.created")).toEqual([]);

      // control: the same caller, a role inside its set
      const ok = await invite(mm, rProducts.id, email("inside"));
      expect(ok.status, JSON.stringify(ok.body)).toBe(201);
    });

    it("reissue — token, clock and issuer untouched", async () => {
      const inv = await pendingInvitation(rOrders);
      const before = await rowOf(inv.id);
      const res = await reissue(mm, inv.id);
      assertErrorEnvelope(res, { status: 403, code: "ROLE_EXCEEDS_ACTOR" });
      expect(res.body.error.details).toBeUndefined();
      const after = await rowOf(inv.id);
      expect(after.tokenHash).toBe(before.tokenHash);
      expect(after.tokenIssuedAt.getTime()).toBe(before.tokenIssuedAt.getTime());
      expect(after.expiresAt.getTime()).toBe(before.expiresAt.getTime());
      expect(after.issuedByUserId).toBe(owner.id);
      expectExceedsEvent("invite_reissue", rOrders.id, mm);
      expect(sink.ofType("org.invitation.link_reissued")).toEqual([]);

      const control = await pendingInvitation(rProducts);
      expect((await reissue(mm, control.id)).status).toBe(200);
    });

    it("cancel — row stays pending", async () => {
      const inv = await pendingInvitation(rOrders);
      const res = await cancel(mm, inv.id);
      assertErrorEnvelope(res, { status: 403, code: "ROLE_EXCEEDS_ACTOR" });
      expect(res.body.error.details).toBeUndefined();
      const after = await rowOf(inv.id);
      expect(after.status).toBe("pending");
      expect(after.cancelledAt).toBeNull();
      expectExceedsEvent("invite_cancel", rOrders.id, mm);
      expect(sink.ofType("org.invitation.cancelled")).toEqual([]);

      const control = await pendingInvitation(rProducts);
      expect((await cancel(mm, control.id)).status).toBe(200);
    });
  });

  // ── R3-04 (invite) ────────────────────────────────────────────────────────

  it("R3-04 · AC-5.4 / api §4.3: an Admin can NO LONGER cancel an Owner invitation (F-002 allowed it) → 403 FORBIDDEN", async () => {
    const inv = await pendingInvitation(org.roles.Owner);
    const res = await cancel(admin, inv.id);
    assertErrorEnvelope(res, { status: 403, code: "FORBIDDEN" });
    const after = await rowOf(inv.id);
    expect(after.status).toBe("pending");
    expect(after.cancelledAt).toBeNull();
    // Owner-only is the F-002 code, not an escalation signal → no escalation event.
    expect(sink.ofType("org.role.escalation_denied")).toEqual([]);

    // control: the Owner still can, and an Admin can cancel an Admin invitation (⊆, not ⊊)
    expect((await cancel(owner, inv.id)).status).toBe(200);
    const adminInv = await pendingInvitation(org.roles.Admin);
    expect((await cancel(admin, adminInv.id)).status).toBe(200);
  });

  // ── I3-39 ────────────────────────────────────────────────────────────────

  it("I3-39 · reissue by X ⇒ issuedByUserId = X · invitedByUserId unchanged · not on the wire", async () => {
    const created = await invite(owner, rProducts.id, email("i339"));
    expect(created.status).toBe(201);
    const id = created.body.invitation.id as string;
    const atCreate = await rowOf(id);
    expect(atCreate.issuedByUserId).toBe(owner.id);
    expect(atCreate.invitedByUserId).toBe(owner.id);

    const res = await reissue(admin, id);
    expect(res.status).toBe(200);
    const after = await rowOf(id);
    expect(after.issuedByUserId).toBe(admin.id);
    expect(after.invitedByUserId).toBe(owner.id);
    expect(after.tokenHash).not.toBe(atCreate.tokenHash);

    const list = await request(app.server())
      .get(`/orgs/${org.id}/invitations?status=all`)
      .set("Authorization", auth(owner));
    expect(list.status).toBe(200);
    expect(list.body.items.some((i: { id: string }) => i.id === id)).toBe(true);
    for (const body of [created.body, res.body, list.body]) {
      expect(JSON.stringify(body)).not.toContain("issuedByUserId");
    }
  });

  // ── I3-41 ────────────────────────────────────────────────────────────────

  it("I3-41 · AC-10.3: manage_roles without manage_members → 24h TTL (create + reissue) · Staff → 168h", async () => {
    const ttlHours = (body: { tokenIssuedAt: string; expiresAt: string }) =>
      (new Date(body.expiresAt).getTime() - new Date(body.tokenIssuedAt).getTime()) / HOUR;

    const mr = await invite(owner, rMr.id, email("mr"));
    expect(mr.status, JSON.stringify(mr.body)).toBe(201);
    expect(ttlHours(mr.body.invitation)).toBe(INVITATION_TTL_HOURS_ELEVATED);
    const mrReissued = await reissue(owner, mr.body.invitation.id as string);
    expect(mrReissued.status).toBe(200);
    expect(ttlHours(mrReissued.body)).toBe(INVITATION_TTL_HOURS_ELEVATED);

    const staff = await invite(owner, org.roles.Staff.id, email("staff"));
    expect(staff.status).toBe(201);
    expect(ttlHours(staff.body.invitation)).toBe(INVITATION_TTL_HOURS_STANDARD);
  });
});
