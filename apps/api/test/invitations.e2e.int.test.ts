// F-002 · T-002-19 ★ — invitations, org side (api-spec §3.10–§3.13).
//
// The raw token these routes hand out is a bearer credential for MEMBERSHIP of
// a shop, delivered through channels we neither see nor control (D-012: no
// email in Phase 0, the inviter copies the link). So the cases below are less
// about response shapes than about four properties:
//
//   * the raw token is never stored — a database dump hands out nothing;
//   * rotating a link kills the previous one at once;
//   * who may hand out an Owner link is the same question as who may create one
//     (NEW-2) — and a refusal must leave the database untouched;
//   * the lifetime is decided by the ROLE, never by the caller.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { PrismaClient, hashInvitationToken } from "@omnistock/db";
import {
  CAPABILITY_FULL_ACCESS,
  INVITATION_TTL_HOURS_ELEVATED,
  INVITATION_TTL_HOURS_STANDARD,
} from "@omnistock/core-domain";
import { AccessTokenService } from "../src/auth/access-token.service";
import { collectSecurityEvents } from "../src/auth";
import { INVITATION_RESPONSE_HEADERS } from "../src/orgs";
import { assertErrorEnvelope, assertNoSecretFields, assertResponseHeaders } from "./assertions.kit";
import { INT_LANE_ENABLED, applyTestEnv, createTestApp, type TestApp } from "./app.kit";
import { createSeedKit, type SeedKit } from "./f002-seed.kit";

const d = INT_LANE_ENABLED ? describe : describe.skip;

d("F-002 invitations, org side (E2E, DB)", () => {
  let app: TestApp;
  let prisma: PrismaClient;
  let kit: SeedKit;
  const createdOrgIds: string[] = [];

  const token = (userId: string): string =>
    app.app.get(AccessTokenService, { strict: false }).sign(userId);

  async function newUser() {
    const user = await kit.createUser();
    return { ...user, accessToken: token(user.id) };
  }

  /** An org created through the REAL endpoint, with its Owner. */
  async function newOrg(name = "ร้านคำเชิญ") {
    const owner = await newUser();
    const res = await request(app.server())
      .post("/organizations")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .set("Content-Type", "application/json")
      .send({ name });
    expect(res.status).toBe(201);
    const orgId = res.body.organization.id as string;
    createdOrgIds.push(orgId);
    return { owner, orgId };
  }

  async function roleNamed(orgId: string, name: string) {
    return prisma.role.findFirstOrThrow({ where: { organizationId: orgId, name } });
  }

  function invite(orgId: string, accessToken: string, body: unknown) {
    return request(app.server())
      .post(`/orgs/${orgId}/invitations`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send(body as object);
  }

  beforeAll(async () => {
    applyTestEnv();
    prisma = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
    await prisma.$connect();
    app = await createTestApp();
    kit = createSeedKit(prisma, { label: "t19" });
  });

  afterAll(async () => {
    // Delete exactly what this suite created, in FK order, by id — never a
    // sweep: vitest runs these files in parallel against one Postgres.
    if (prisma && createdOrgIds.length > 0) {
      const where = { organizationId: { in: createdOrgIds } };
      await prisma.warehouse.deleteMany({ where });
      await prisma.orgEntitlement.deleteMany({ where });
      await prisma.invitation.deleteMany({ where });
      await prisma.membership.deleteMany({ where });
      await prisma.role.deleteMany({ where });
      await prisma.organization.deleteMany({ where: { id: { in: createdOrgIds } } });
    }
    if (kit) await kit.cleanup();
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
  });

  // ── §3.11 create ─────────────────────────────────────────────────────────

  it("★ the raw token is returned ONCE and never stored (D-018)", async () => {
    const { owner, orgId } = await newOrg();
    const staff = await roleNamed(orgId, "Staff");

    const res = await invite(orgId, owner.accessToken, {
      email: " New@Example.COM ",
      roleId: staff.id,
    });
    expect(res.status).toBe(201);
    const raw = res.body.token as string;
    expect(raw).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(res.body.inviteUrl).toContain(encodeURIComponent(raw));
    // Server-side normalization — the partial unique index compares raw strings.
    expect(res.body.invitation.email).toBe("new@example.com");

    const row = await prisma.invitation.findUniqueOrThrow({
      where: { id: res.body.invitation.id as string },
    });
    // The whole point of hash-at-rest: a dump of this table hands out nothing.
    expect(row.tokenHash).not.toBe(raw);
    expect(row.tokenHash).toBe(hashInvitationToken(raw));
    expect(JSON.stringify(row)).not.toContain(raw);
    assertResponseHeaders(res, INVITATION_RESPONSE_HEADERS);
  });

  it("★ the list can never hand the token back — there is nothing to hand back", async () => {
    const { owner, orgId } = await newOrg();
    const staff = await roleNamed(orgId, "Staff");
    const created = await invite(orgId, owner.accessToken, { email: "a@example.com", roleId: staff.id });
    const raw = created.body.token as string;

    const list = await request(app.server())
      .get(`/orgs/${orgId}/invitations`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);
    const serialized = JSON.stringify(list.body);
    expect(serialized).not.toContain(raw);
    expect(serialized).not.toContain("tokenHash");
    assertNoSecretFields(list.body);
  });

  it("★ TTL comes from the ROLE, not the caller (D-028/I-7)", async () => {
    const { owner, orgId } = await newOrg();
    const staff = await roleNamed(orgId, "Staff");
    const ownerRole = await roleNamed(orgId, "Owner");
    expect(ownerRole.capabilities).toContain(CAPABILITY_FULL_ACCESS);

    const before = Date.now();
    const standard = await invite(orgId, owner.accessToken, { email: "s@example.com", roleId: staff.id });
    const elevated = await invite(orgId, owner.accessToken, { email: "o@example.com", roleId: ownerRole.id });
    const after = Date.now();

    const hours = (iso: string) => (new Date(iso).getTime() - before) / 3_600_000;
    // Bounded either side by the wall clock rather than compared to an exact
    // instant: no fake timers anywhere (Postgres' now() ignores them).
    expect(hours(standard.body.invitation.expiresAt)).toBeGreaterThan(INVITATION_TTL_HOURS_STANDARD - 1);
    expect(hours(standard.body.invitation.expiresAt)).toBeLessThanOrEqual(
      INVITATION_TTL_HOURS_STANDARD + (after - before) / 3_600_000 + 0.01,
    );
    expect(hours(elevated.body.invitation.expiresAt)).toBeGreaterThan(INVITATION_TTL_HOURS_ELEVATED - 1);
    expect(hours(elevated.body.invitation.expiresAt)).toBeLessThan(INVITATION_TTL_HOURS_STANDARD - 1);
  });

  it("★ C-1/D-028: an Admin cannot invite somebody AS an Owner", async () => {
    const { owner, orgId } = await newOrg();
    const adminRole = await roleNamed(orgId, "Admin");
    const ownerRole = await roleNamed(orgId, "Owner");
    const admin = await newUser();
    await kit.addMember({ organizationId: orgId, userId: admin.id, roleId: adminRole.id });

    // The control: the same Admin CAN invite a Staff member, so the refusal
    // below is about the role being granted and not about the caller.
    const staff = await roleNamed(orgId, "Staff");
    expect((await invite(orgId, admin.accessToken, { email: "ok@example.com", roleId: staff.id })).status).toBe(201);

    const refused = await invite(orgId, admin.accessToken, { email: "esc@example.com", roleId: ownerRole.id });
    assertErrorEnvelope(refused, { status: 403, code: "FORBIDDEN" });
    // …and nothing was written.
    expect(await prisma.invitation.count({ where: { organizationId: orgId, email: "esc@example.com" } })).toBe(0);
    void owner;
  });

  it("409 INVITATION_PENDING carries the id, so the UI has a next step (D-027)", async () => {
    const { owner, orgId } = await newOrg();
    const staff = await roleNamed(orgId, "Staff");
    const first = await invite(orgId, owner.accessToken, { email: "dup@example.com", roleId: staff.id });
    expect(first.status).toBe(201);

    const second = await invite(orgId, owner.accessToken, { email: "dup@example.com", roleId: staff.id });
    assertErrorEnvelope(second, { status: 409, code: "INVITATION_PENDING" });
    // Without the id the only thing a user can do with this error is retype the
    // address and get it again.
    expect(second.body.error.details.invitationId).toBe(first.body.invitation.id);
    expect(second.body.error.details.roleName).toBe("Staff");
  });

  it("409 ALREADY_MEMBER when the invitee is already in the shop", async () => {
    const { owner, orgId } = await newOrg();
    const staff = await roleNamed(orgId, "Staff");
    const existing = await newUser();
    await kit.addMember({ organizationId: orgId, userId: existing.id, roleId: staff.id });

    const res = await invite(orgId, owner.accessToken, { email: existing.email, roleId: staff.id });
    assertErrorEnvelope(res, { status: 409, code: "ALREADY_MEMBER" });
  });

  it("422 ROLE_INVALID for a role from ANOTHER shop — never 'it exists elsewhere'", async () => {
    const a = await newOrg("ร้าน เอ");
    const b = await newOrg("ร้าน บี");
    const foreignRole = await roleNamed(b.orgId, "Staff");

    const res = await invite(a.orgId, a.owner.accessToken, {
      email: "x@example.com",
      roleId: foreignRole.id,
    });
    // The tenant filter makes a foreign role indistinguishable from a made-up
    // one — which is the answer that leaks nothing about the other shop.
    assertErrorEnvelope(res, { status: 422, code: "ROLE_INVALID" });
  });

  // ── §3.12 reissue ────────────────────────────────────────────────────────

  it("★ reissue rotates the token — the OLD hash stops existing immediately", async () => {
    const { owner, orgId } = await newOrg();
    const staff = await roleNamed(orgId, "Staff");
    const created = await invite(orgId, owner.accessToken, { email: "r@example.com", roleId: staff.id });
    const oldToken = created.body.token as string;
    const invitationId = created.body.invitation.id as string;

    const res = await request(app.server())
      .post(`/orgs/${orgId}/invitations/${invitationId}/link`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send();
    // api-spec §3.12 — 200: nothing is created, an existing invitation's token
    // is rotated.
    expect(res.status).toBe(200);
    expect(res.body.rotated).toBe(true);
    const newToken = res.body.token as string;
    expect(newToken).not.toBe(oldToken);

    const row = await prisma.invitation.findUniqueOrThrow({ where: { id: invitationId } });
    expect(row.tokenHash).toBe(hashInvitationToken(newToken));
    // The old link is dead: its hash is no longer anywhere in the table, so
    // nothing can resolve it (this is the D-018 consequence that makes "resend
    // the same link" unimplementable rather than merely unimplemented).
    expect(
      await prisma.invitation.count({ where: { tokenHash: hashInvitationToken(oldToken) } }),
    ).toBe(0);
    assertResponseHeaders(res, INVITATION_RESPONSE_HEADERS);
  });

  it("★ reissue restarts the clock (D-027)", async () => {
    const { owner, orgId } = await newOrg();
    const staff = await roleNamed(orgId, "Staff");
    const created = await invite(orgId, owner.accessToken, { email: "clock@example.com", roleId: staff.id });
    const firstExpiry = new Date(created.body.invitation.expiresAt as string).getTime();

    await new Promise((r) => setTimeout(r, 25));
    const res = await request(app.server())
      .post(`/orgs/${orgId}/invitations/${created.body.invitation.id}/link`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send();

    // Strictly later — the alternative D-027 rejected was keeping the original
    // expiry, which produces "your new link expires in 4 hours".
    expect(new Date(res.body.expiresAt as string).getTime()).toBeGreaterThan(firstExpiry);
  });

  it("★ NEW-2: an Admin cannot reissue an OWNER invitation, and the DB does not move", async () => {
    // Without this, `manage_members` could copy the key to the Owner door as
    // often as it liked — D-027 restarts the clock every time — while
    // `POST /invitations` correctly refused to create one.
    const { owner, orgId } = await newOrg();
    const ownerRole = await roleNamed(orgId, "Owner");
    const adminRole = await roleNamed(orgId, "Admin");
    const admin = await newUser();
    await kit.addMember({ organizationId: orgId, userId: admin.id, roleId: adminRole.id });

    const created = await invite(orgId, owner.accessToken, { email: "owner@example.com", roleId: ownerRole.id });
    expect(created.status).toBe(201);
    const invitationId = created.body.invitation.id as string;
    const before = await prisma.invitation.findUniqueOrThrow({ where: { id: invitationId } });

    const refused = await request(app.server())
      .post(`/orgs/${orgId}/invitations/${invitationId}/link`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send();
    assertErrorEnvelope(refused, { status: 403, code: "FORBIDDEN" });

    const after = await prisma.invitation.findUniqueOrThrow({ where: { id: invitationId } });
    // A 403 that had already rotated would invalidate the inviter's live link
    // as a side effect of refusing the caller: told "no", damage done.
    expect(after.tokenHash).toBe(before.tokenHash);
    expect(after.expiresAt.toISOString()).toBe(before.expiresAt.toISOString());
    expect(after.tokenIssuedAt.toISOString()).toBe(before.tokenIssuedAt.toISOString());
  });

  // ── §3.13 cancel ─────────────────────────────────────────────────────────

  it("cancel kills the link, and cancelling twice is 409 rather than a silent no-op", async () => {
    const { owner, orgId } = await newOrg();
    const staff = await roleNamed(orgId, "Staff");
    const created = await invite(orgId, owner.accessToken, { email: "c@example.com", roleId: staff.id });
    const invitationId = created.body.invitation.id as string;

    const first = await request(app.server())
      .delete(`/orgs/${orgId}/invitations/${invitationId}`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ id: invitationId, status: "cancelled" });

    const second = await request(app.server())
      .delete(`/orgs/${orgId}/invitations/${invitationId}`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    assertErrorEnvelope(second, { status: 409, code: "CONFLICT" });
  });

  // ── authorization + audit ────────────────────────────────────────────────

  it("★ a Staff member cannot even LIST — the rows are other people's emails", async () => {
    const { owner, orgId } = await newOrg();
    const staffRole = await roleNamed(orgId, "Staff");
    const staff = await newUser();
    await kit.addMember({ organizationId: orgId, userId: staff.id, roleId: staffRole.id });

    const res = await request(app.server())
      .get(`/orgs/${orgId}/invitations`)
      .set("Authorization", `Bearer ${staff.accessToken}`);
    assertErrorEnvelope(res, { status: 403, code: "FORBIDDEN" });
    void owner;
  });

  it("★ the audit trail records the invitation with a MASKED email", async () => {
    const { owner, orgId } = await newOrg();
    const staff = await roleNamed(orgId, "Staff");
    const events = collectSecurityEvents(app.events);
    try {
      await invite(orgId, owner.accessToken, { email: "audit@example.com", roleId: staff.id });
      const created = events.ofType("org.invitation.created");
      expect(created).toHaveLength(1);
      // An audit trail of who was invited must not itself become a directory of
      // the addresses a shop holds.
      const payload = JSON.stringify(created.map((e) => e.payload));
      expect(payload).not.toContain("audit@example.com");
      expect(payload).toContain("***");
    } finally {
      events.stop();
    }
  });

  it("★ a member of ANOTHER shop cannot invite into this one", async () => {
    const a = await newOrg("ร้าน หนึ่ง");
    const b = await newOrg("ร้าน สอง");
    const staffInA = await roleNamed(a.orgId, "Staff");

    const res = await invite(a.orgId, b.owner.accessToken, {
      email: "cross@example.com",
      roleId: staffInA.id,
    });
    // Not a member of A at all → the tenancy layer answers first, and it must
    // stay distinguishable from "member but lacking the capability" (I-5).
    assertErrorEnvelope(res, { status: 403, code: "ORG_ACCESS_DENIED" });
    expect(await prisma.invitation.count({ where: { organizationId: a.orgId } })).toBe(0);
  });
});
