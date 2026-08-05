// F-002 · T-002-15/16 ★ — the org endpoints against a real Postgres and the
// real guard chain (api-spec §3.1–§3.4).
//
// WHAT THIS PROVES THAT THE UNIT LANE CANNOT
//   * ATOMICITY is a database property. The unit suite proves the five inserts
//     are issued in one `$transaction`; only Postgres proves that a refusal
//     leaves nothing behind.
//   * `withOrgScope` really does filter `PATCH`/`GET` by tenant — an assertion
//     about an extension that only exists at runtime.
//   * the CROSS-ORG SWEEP (CLAUDE.md rule 1 / architecture §2.3 item 3), which is
//     mandatory for every new endpoint and is the one test that can catch "the
//     query filtered by *a* membership, just not this org's".
//   * the live router matches `ROUTE_CAPABILITIES` byte for byte.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { PrismaClient } from "@omnistock/db";
import { AccessTokenService } from "../src/auth/access-token.service";
import { collectSecurityEvents } from "../src/auth";
import {
  ORG_PROFILE_RESPONSE_HEADERS,
  TAX_ID_REVEAL_RESPONSE_HEADERS,
  TAX_ID_RESPONSE_ALLOWLIST,
  isTaxIdAllowedOnRoute,
} from "../src/orgs";
import { assertErrorEnvelope, assertNoSecretFields, assertResponseHeaders } from "./assertions.kit";
import { INT_LANE_ENABLED, applyTestEnv, createTestApp, type TestApp } from "./app.kit";
import { createSeedKit, type SeedKit } from "./f002-seed.kit";
import { assertNoCrossOrgLeak, createOrgLeakKit, type OrgLeakKit } from "./org-leak.kit";
import { assertRouteRegistryClean, auditApp } from "./route-registry.kit";

const d = INT_LANE_ENABLED ? describe : describe.skip;

d("F-002 org endpoints (E2E, DB)", () => {
  let app: TestApp;
  let prisma: PrismaClient;
  let kit: SeedKit;
  /** Orgs created THROUGH the endpoint — the seed kit does not know about them. */
  const createdOrgIds: string[] = [];

  const token = (userId: string): string =>
    app.app.get(AccessTokenService, { strict: false }).sign(userId);

  /** A logged-in user with no shops. */
  async function newUser() {
    const user = await kit.createUser();
    return { ...user, accessToken: token(user.id) };
  }

  async function createOrg(accessToken: string, body: unknown = { name: "ร้านทดสอบ" }) {
    const res = await request(app.server())
      .post("/organizations")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send(body as object);
    const id = (res.body as { organization?: { id?: string } })?.organization?.id;
    if (typeof id === "string") createdOrgIds.push(id);
    return res;
  }

  /** Delete, in FK order, only the orgs this suite created (shared database). */
  async function cleanupCreatedOrgs(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;
    const where = { organizationId: { in: [...ids] } };
    await prisma.warehouse.deleteMany({ where });
    await prisma.orgEntitlement.deleteMany({ where });
    await prisma.invitation.deleteMany({ where });
    await prisma.membership.deleteMany({ where });
    await prisma.role.deleteMany({ where });
    await prisma.organization.deleteMany({ where: { id: { in: [...ids] } } });
  }

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
    await prisma.$connect();
    app = await createTestApp();
    kit = createSeedKit(prisma, { label: "t15" });
  });

  afterAll(async () => {
    await cleanupCreatedOrgs(createdOrgIds);
    if (kit) await kit.cleanup();
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
  });

  // ── POST /organizations (T-002-15 ★) ────────────────────────────────────

  describe("POST /organizations — api-spec §3.1", () => {
    it("★ 201 creates Organization + 3 roles + Owner membership + entitlement + warehouse", async () => {
      const user = await newUser();
      const sink = collectSecurityEvents(app.events);
      const res = await createOrg(user.accessToken, { name: "ร้านตัวอย่าง" });

      expect(res.status).toBe(201);
      const orgId = res.body.organization.id as string;
      expect(res.body).toMatchObject({
        organization: {
          name: "ร้านตัวอย่าง",
          logo: null,
          timezone: "Asia/Bangkok",
          currency: "THB",
          taxProfileComplete: false,
        },
        membership: { userId: user.id, roleName: "Owner", roleKey: "owner", status: "active" },
        entitlement: { planKey: "comp_full" },
        defaultWarehouse: { name: "คลังหลัก" },
      });
      assertNoSecretFields(res.body);

      // …and all five things are really in the database.
      const [roles, memberships, entitlement, warehouses] = await Promise.all([
        prisma.role.findMany({ where: { organizationId: orgId }, orderBy: { name: "asc" } }),
        prisma.membership.findMany({ where: { organizationId: orgId } }),
        prisma.orgEntitlement.findUnique({ where: { organizationId: orgId } }),
        prisma.warehouse.findMany({ where: { organizationId: orgId } }),
      ]);
      expect(roles.map((r) => r.name)).toEqual(["Admin", "Owner", "Staff"]);
      expect(roles.map((r) => r.key).sort()).toEqual(["admin", "owner", "staff"]);
      expect(roles.find((r) => r.name === "Owner")?.capabilities).toEqual(["full_access"]);
      expect(roles.find((r) => r.name === "Owner")?.isSystem).toBe(true);
      expect(memberships).toHaveLength(1);
      expect(memberships[0]).toMatchObject({ userId: user.id, status: "active" });
      expect(memberships[0].activatedAt).toBeInstanceOf(Date);
      expect(entitlement).not.toBeNull();
      expect(warehouses).toHaveLength(1);
      expect(warehouses[0]).toMatchObject({ name: "คลังหลัก", isDefault: true });

      // The audit event, exactly once, with the documented payload.
      const created = sink.ofType("org.created");
      expect(created).toHaveLength(1);
      expect(created[0].payload).toEqual({
        actorUserId: user.id,
        organizationId: orgId,
        planKey: "comp_full",
      });
      sink.stop();
    });

    it("★ the DB-level 'one default warehouse per org' index is real", async () => {
      const user = await newUser();
      const res = await createOrg(user.accessToken);
      await expect(
        prisma.warehouse.create({
          data: { organizationId: res.body.organization.id, name: "คลังสอง", isDefault: true },
        }),
      ).rejects.toThrow();
    });

    it("422 VALIDATION_FAILED + fieldErrors for a bad body", async () => {
      const user = await newUser();
      const res = await createOrg(user.accessToken, { name: "  ", timezone: "Mars/Olympus" });
      assertErrorEnvelope(res, { status: 422, code: "VALIDATION_FAILED" });
      expect(Object.keys(res.body.error.fieldErrors).sort()).toEqual(["name", "timezone"]);
    });

    it("415 when the body is not JSON (api-spec §1)", async () => {
      const user = await newUser();
      const res = await request(app.server())
        .post("/organizations")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .set("Content-Type", "text/plain")
        .send("name=x");
      assertErrorEnvelope(res, { status: 415, code: "UNSUPPORTED_MEDIA_TYPE" });
    });

    it("401 without a token — @UserScoped still demands authentication (I-4)", async () => {
      const res = await request(app.server())
        .post("/organizations")
        .set("Content-Type", "application/json")
        .send({ name: "ร้าน" });
      assertErrorEnvelope(res, { status: 401, code: "UNAUTHENTICATED" });
    });

    it("★ I-3: `X-Organization-Id` is ignored — the caller cannot pick a tenant", async () => {
      const other = await newUser();
      const otherOrg = await createOrg(other.accessToken, { name: "ร้านของคนอื่น" });

      const user = await newUser();
      const res = await request(app.server())
        .post("/organizations")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .set("X-Organization-Id", otherOrg.body.organization.id as string)
        .set("Content-Type", "application/json")
        .send({ name: "ร้านของฉัน" });
      const id = res.body?.organization?.id as string;
      if (typeof id === "string") createdOrgIds.push(id);

      expect(res.status).toBe(201);
      expect(id).not.toBe(otherOrg.body.organization.id);
      // The membership was written for the CALLER, in the NEW org.
      const memberships = await prisma.membership.findMany({ where: { organizationId: id } });
      expect(memberships.map((m) => m.userId)).toEqual([user.id]);
    });

    it("★ §6.3 · 409 ORG_LIMIT_REACHED — fail-closed, with `details.limit`", async () => {
      // The cap is env-tunable and resolved at boot, so the boundary is tested
      // with a small limit instead of seeding 50 shops (same code path, and the
      // number itself is pinned in the unit suite).
      const previous = process.env.MAX_ORGS_PER_USER;
      process.env.MAX_ORGS_PER_USER = "1";
      applyTestEnv();
      const capped = await createTestApp();
      const cappedOrgIds: string[] = [];
      try {
        const user = await kit.createUser();
        const accessToken = capped.app.get(AccessTokenService, { strict: false }).sign(user.id);
        const post = (name: string) =>
          request(capped.server())
            .post("/organizations")
            .set("Authorization", `Bearer ${accessToken}`)
            .set("Content-Type", "application/json")
            .send({ name });

        const first = await post("ร้านที่ 1");
        expect(first.status).toBe(201);
        cappedOrgIds.push(first.body.organization.id as string);

        const second = await post("ร้านที่ 2");
        assertErrorEnvelope(second, { status: 409, code: "ORG_LIMIT_REACHED" });
        expect(second.body.error.details).toEqual({ limit: 1 });
        // Nothing was written for the refused attempt.
        expect(await prisma.organization.count({ where: { name: "ร้านที่ 2" } })).toBe(0);

        // …and the quota comes back when the membership stops being active.
        await prisma.membership.updateMany({
          where: { userId: user.id },
          data: { status: "revoked", revokedAt: new Date() },
        });
        const third = await post("ร้านที่ 3");
        expect(third.status).toBe(201);
        cappedOrgIds.push(third.body.organization.id as string);
      } finally {
        await cleanupCreatedOrgs(cappedOrgIds);
        await capped.close();
        if (previous === undefined) delete process.env.MAX_ORGS_PER_USER;
        else process.env.MAX_ORGS_PER_USER = previous;
      }
    });

    it("★ §6.2 · 503 ORG_PROVISIONING_UNAVAILABLE — and NO shop is created", async () => {
      const previous = process.env.DEFAULT_ORG_PLAN_KEY;
      process.env.DEFAULT_ORG_PLAN_KEY = "plan_that_does_not_exist";
      applyTestEnv();
      const misconfigured = await createTestApp();
      try {
        const user = await kit.createUser();
        const accessToken = misconfigured.app
          .get(AccessTokenService, { strict: false })
          .sign(user.id);
        const sink = collectSecurityEvents(misconfigured.events);
        const res = await request(misconfigured.server())
          .post("/organizations")
          .set("Authorization", `Bearer ${accessToken}`)
          .set("Content-Type", "application/json")
          .send({ name: "ร้านที่ไม่ควรเกิด" });

        assertErrorEnvelope(res, { status: 503, code: "ORG_PROVISIONING_UNAVAILABLE" });
        // ⛔ The failure mode this test exists for: a silent fallback to `free`.
        expect(await prisma.organization.count({ where: { name: "ร้านที่ไม่ควรเกิด" } })).toBe(0);
        expect(await prisma.membership.count({ where: { userId: user.id } })).toBe(0);
        expect(sink.ofType("org.created")).toEqual([]);
        // …and the wire says nothing about our configuration.
        expect(JSON.stringify(res.body)).not.toContain("plan_that_does_not_exist");
        sink.stop();
      } finally {
        await misconfigured.close();
        if (previous === undefined) delete process.env.DEFAULT_ORG_PLAN_KEY;
        else process.env.DEFAULT_ORG_PLAN_KEY = previous;
      }
    });
  });

  // ── GET /me/organizations (T-002-16) ────────────────────────────────────

  describe("GET /me/organizations — api-spec §3.2", () => {
    it("lists the caller's shops in the full shape", async () => {
      const user = await newUser();
      await createOrg(user.accessToken, { name: "ร้าน A" });
      const res = await request(app.server())
        .get("/me/organizations")
        .set("Authorization", `Bearer ${user.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0]).toMatchObject({
        organization: { name: "ร้าน A", logo: null },
        membership: { roleName: "Owner", roleKey: "owner", status: "active" },
        entitlement: { planKey: "comp_full" },
      });
      expect(res.body.nextCursor).toBeNull();
      assertNoSecretFields(res.body);
    });

    it("★ AC US-5: a revoked shop disappears from the DEFAULT list immediately", async () => {
      const user = await newUser();
      const kept = await createOrg(user.accessToken, { name: "ร้านที่ยังอยู่" });
      const lost = await createOrg(user.accessToken, { name: "ร้านที่ถูกถอด" });
      await prisma.membership.updateMany({
        where: { userId: user.id, organizationId: lost.body.organization.id as string },
        data: { status: "revoked", revokedAt: new Date() },
      });

      const active = await request(app.server())
        .get("/me/organizations")
        .set("Authorization", `Bearer ${user.accessToken}`);
      expect(active.body.items.map((i: { organization: { id: string } }) => i.organization.id)).toEqual([
        kept.body.organization.id,
      ]);

      // …and `?status=all` shows it in the SHORT shape (M-10).
      const all = await request(app.server())
        .get("/me/organizations?status=all")
        .set("Authorization", `Bearer ${user.accessToken}`);
      const removed = all.body.items.find(
        (i: { organization: { id: string } }) => i.organization.id === lost.body.organization.id,
      );
      expect(removed.membership).toMatchObject({ status: "revoked" });
      expect(removed.membership.revokedAt).toEqual(expect.any(String));
      expect(removed.membership).not.toHaveProperty("roleId");
      expect(removed).not.toHaveProperty("entitlement");
      // The plan must not appear anywhere in that row, under any key.
      expect(JSON.stringify(removed)).not.toContain("comp_full");
    });

    it("★ shows ONLY the caller's shops (never another user's)", async () => {
      const mine = await newUser();
      const theirs = await newUser();
      const myOrg = await createOrg(mine.accessToken, { name: "ของฉัน" });
      await createOrg(theirs.accessToken, { name: "ของเขา" });

      const res = await request(app.server())
        .get("/me/organizations")
        .set("Authorization", `Bearer ${mine.accessToken}`);
      expect(res.body.items.map((i: { organization: { id: string } }) => i.organization.id)).toEqual([
        myOrg.body.organization.id,
      ]);
      expect(JSON.stringify(res.body)).not.toContain("ของเขา");
    });

    it("paginates with an opaque cursor and terminates", async () => {
      const user = await newUser();
      await createOrg(user.accessToken, { name: "หน้า 1" });
      await createOrg(user.accessToken, { name: "หน้า 2" });

      const first = await request(app.server())
        .get("/me/organizations?limit=1")
        .set("Authorization", `Bearer ${user.accessToken}`);
      expect(first.body.items).toHaveLength(1);
      expect(typeof first.body.nextCursor).toBe("string");

      const second = await request(app.server())
        .get(`/me/organizations?limit=1&cursor=${encodeURIComponent(first.body.nextCursor)}`)
        .set("Authorization", `Bearer ${user.accessToken}`);
      expect(second.body.items).toHaveLength(1);
      expect(second.body.items[0].organization.id).not.toBe(first.body.items[0].organization.id);
      // Two shops, page size one ⇒ the second page is the last one.
      expect(second.body.nextCursor).toBeNull();
    });

    it("422 for a garbage cursor / an unknown status", async () => {
      const user = await newUser();
      const badCursor = await request(app.server())
        .get("/me/organizations?cursor=!!!")
        .set("Authorization", `Bearer ${user.accessToken}`);
      assertErrorEnvelope(badCursor, { status: 422, code: "VALIDATION_FAILED" });

      const badStatus = await request(app.server())
        .get("/me/organizations?status=revoked")
        .set("Authorization", `Bearer ${user.accessToken}`);
      assertErrorEnvelope(badStatus, { status: 422, code: "VALIDATION_FAILED" });
    });

    it("401 without a token", async () => {
      const res = await request(app.server()).get("/me/organizations");
      assertErrorEnvelope(res, { status: 401, code: "UNAUTHENTICATED" });
    });
  });

  // ── GET / PATCH /orgs/{orgId} (T-002-16) ────────────────────────────────

  describe("GET/PATCH /orgs/{orgId} — api-spec §3.3/§3.4", () => {
    it("★ the Owner sees the profile, with no-store headers and no member list", async () => {
      const user = await newUser();
      const created = await createOrg(user.accessToken, { name: "ร้านโปรไฟล์" });
      const orgId = created.body.organization.id as string;

      const res = await request(app.server())
        .get(`/orgs/${orgId}`)
        .set("Authorization", `Bearer ${user.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: orgId,
        name: "ร้านโปรไฟล์",
        currency: "THB",
        taxProfile: null,
        taxProfileComplete: false,
        entitlement: { planKey: "comp_full" },
        myMembership: { roleName: "Owner", roleKey: "owner", status: "active" },
        counts: { activeMembers: 1, pendingInvitations: 0 },
      });
      // PDPA: totals, never a list — and never anybody's email.
      expect(res.body).not.toHaveProperty("members");
      expect(JSON.stringify(res.body)).not.toContain(user.email);
      assertResponseHeaders(res, ORG_PROFILE_RESPONSE_HEADERS);
      assertNoSecretFields(res.body);
    });

    it("★ D-028/ux Q13: a Staff member gets vatRegistered only — no TIN, masked or not", async () => {
      const owner = await newUser();
      const created = await createOrg(owner.accessToken, { name: "ร้านภาษี" });
      const orgId = created.body.organization.id as string;
      // The tax profile write is T-002-17's endpoint; seeded directly here so
      // the READ path can be proven now.
      await prisma.organization.update({
        where: { id: orgId },
        data: {
          taxEntityType: "personal",
          taxId: "1234567890123",
          vatRegistered: true,
          taxBranchCode: "00000",
        },
      });
      const staffRole = await prisma.role.findFirstOrThrow({
        where: { organizationId: orgId, name: "Staff" },
      });
      const staff = await newUser();
      await kit.addMember({ organizationId: orgId, userId: staff.id, roleId: staffRole.id });

      const asOwner = await request(app.server())
        .get(`/orgs/${orgId}`)
        .set("Authorization", `Bearer ${owner.accessToken}`);
      expect(asOwner.body.taxProfile).toEqual({
        entityType: "personal",
        taxIdMasked: "•••••••••0123",
        vatRegistered: true,
        branchCode: "00000",
      });

      const asStaff = await request(app.server())
        .get(`/orgs/${orgId}`)
        .set("Authorization", `Bearer ${staff.accessToken}`);
      expect(asStaff.status).toBe(200);
      expect(asStaff.body.taxProfile).toEqual({ vatRegistered: true });
      expect(asStaff.body.taxProfileComplete).toBe(true);

      // ⛔ The full number never appears for ANY viewer on this endpoint.
      for (const res of [asOwner, asStaff]) {
        expect(JSON.stringify(res.body)).not.toContain("1234567890123");
      }
    });

    it("PATCH renames the shop and answers with the §3.3 body", async () => {
      const user = await newUser();
      const created = await createOrg(user.accessToken, { name: "ชื่อเดิม" });
      const orgId = created.body.organization.id as string;

      const res = await request(app.server())
        .patch(`/orgs/${orgId}`)
        .set("Authorization", `Bearer ${user.accessToken}`)
        .set("Content-Type", "application/json")
        .send({ name: "  ชื่อใหม่  ", timezone: "Asia/Tokyo" });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: orgId, name: "ชื่อใหม่", timezone: "Asia/Tokyo" });
      assertResponseHeaders(res, ORG_PROFILE_RESPONSE_HEADERS);
      const row = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
      expect(row).toMatchObject({ name: "ชื่อใหม่", timezone: "Asia/Tokyo" });
    });

    it("★ M-4: PATCH logo accepts null and refuses everything else — with no write", async () => {
      const user = await newUser();
      const created = await createOrg(user.accessToken, { name: "ร้านโลโก้" });
      const orgId = created.body.organization.id as string;
      const patch = (body: unknown) =>
        request(app.server())
          .patch(`/orgs/${orgId}`)
          .set("Authorization", `Bearer ${user.accessToken}`)
          .set("Content-Type", "application/json")
          .send(body as object);

      const nulled = await patch({ logo: null });
      expect(nulled.status).toBe(200);

      const rejected = await patch({ name: "ชื่อที่ไม่ควรถูกเขียน", logo: "https://evil/x.png" });
      assertErrorEnvelope(rejected, { status: 422, code: "VALIDATION_FAILED" });
      expect(rejected.body.error.fieldErrors).toHaveProperty("logo");
      // The valid half of a rejected patch must not be written.
      const row = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
      expect(row.name).toBe("ร้านโลโก้");
      expect(row.logo).toBeNull();
    });

    it("★ I-5: a Staff member gets FORBIDDEN on PATCH (not ORG_ACCESS_DENIED)", async () => {
      const owner = await newUser();
      const created = await createOrg(owner.accessToken, { name: "ร้านสิทธิ์" });
      const orgId = created.body.organization.id as string;
      const staffRole = await prisma.role.findFirstOrThrow({
        where: { organizationId: orgId, name: "Staff" },
      });
      const staff = await newUser();
      await kit.addMember({ organizationId: orgId, userId: staff.id, roleId: staffRole.id });

      const res = await request(app.server())
        .patch(`/orgs/${orgId}`)
        .set("Authorization", `Bearer ${staff.accessToken}`)
        .set("Content-Type", "application/json")
        .send({ name: "ชื่อที่พนักงานตั้งไม่ได้" });
      assertErrorEnvelope(res, { status: 403, code: "FORBIDDEN" });

      // …while the same person may READ the profile (@AnyActiveMember).
      const read = await request(app.server())
        .get(`/orgs/${orgId}`)
        .set("Authorization", `Bearer ${staff.accessToken}`);
      expect(read.status).toBe(200);
    });

    it("★ an Admin (manage_org_settings, no full_access) may PATCH", async () => {
      const owner = await newUser();
      const created = await createOrg(owner.accessToken, { name: "ร้านแอดมิน" });
      const orgId = created.body.organization.id as string;
      const adminRole = await prisma.role.findFirstOrThrow({
        where: { organizationId: orgId, name: "Admin" },
      });
      expect(adminRole.capabilities).not.toContain("full_access");
      const admin = await newUser();
      await kit.addMember({ organizationId: orgId, userId: admin.id, roleId: adminRole.id });

      const res = await request(app.server())
        .patch(`/orgs/${orgId}`)
        .set("Authorization", `Bearer ${admin.accessToken}`)
        .set("Content-Type", "application/json")
        .send({ name: "แอดมินแก้ได้" });
      expect(res.status).toBe(200);
    });

    it("422 ORG_CONTEXT_REQUIRED shape is not reachable here (the path carries the org)", async () => {
      // Sanity on the §1.2 source order: a header that DISAGREES with the path
      // is a client bug and must be 422 ORG_MISMATCH, never a silent pick.
      const user = await newUser();
      const a = await createOrg(user.accessToken, { name: "ร้าน หนึ่ง" });
      const b = await createOrg(user.accessToken, { name: "ร้าน สอง" });
      const res = await request(app.server())
        .get(`/orgs/${a.body.organization.id}`)
        .set("X-Organization-Id", b.body.organization.id as string)
        .set("Authorization", `Bearer ${user.accessToken}`);
      assertErrorEnvelope(res, { status: 422, code: "ORG_MISMATCH" });
    });
  });

  // ── tax profile + reveal (T-002-17 ★) ───────────────────────────────────
  //
  // The most privacy-sensitive surface in F-002. With `entityType="personal"`
  // the stored number IS the shop owner's national ID, so the questions these
  // cases answer are: who can write it, who can see it in full, does anything
  // else ever emit it, and can we say afterwards who looked.

  describe("PUT + POST /orgs/{orgId}/tax-profile — api-spec §3.5/§3.16", () => {
    /** A valid Thai TIN (13 digits, checksum-correct). */
    const TIN = "1101700207366";
    const COMPLETE = {
      entityType: "company",
      taxId: TIN,
      vatRegistered: true,
      branchCode: "00000",
    };

    async function orgWithTaxProfile() {
      const owner = await newUser();
      const created = await createOrg(owner.accessToken, { name: "ร้านภาษี" });
      const orgId = created.body.organization.id as string;
      const put = await request(app.server())
        .put(`/orgs/${orgId}/tax-profile`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .set("Content-Type", "application/json")
        .send(COMPLETE);
      expect(put.status).toBe(200);
      return { owner, orgId, put };
    }

    it("★ PUT stores the profile and the RESPONSE never echoes the full number", async () => {
      const { put } = await orgWithTaxProfile();
      expect(put.body).toMatchObject({ taxProfileComplete: true });
      // Masked is the most any non-reveal response may carry.
      expect(JSON.stringify(put.body)).not.toContain(TIN);
      expect(put.body.taxProfile.taxIdMasked).toContain("7366");
      assertNoSecretFields(put.body);
    });

    it("★ GET /orgs/{orgId} shows the MASKED id to the Owner — never the digits", async () => {
      const { owner, orgId } = await orgWithTaxProfile();
      const res = await request(app.server())
        .get(`/orgs/${orgId}`)
        .set("Authorization", `Bearer ${owner.accessToken}`);
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toContain(TIN);
      expect(res.body.taxProfile.taxIdMasked).toContain("7366");
    });

    it("★ Staff see vatRegistered ONLY — not even the last four digits (ux Q13)", async () => {
      // Stricter than D-028 on purpose: with entityType="personal" those four
      // digits belong to a person's national ID, and no staff task needs them.
      const { owner, orgId } = await orgWithTaxProfile();
      const staffRole = await prisma.role.findFirstOrThrow({
        where: { organizationId: orgId, name: "Staff" },
      });
      const staff = await newUser();
      await kit.addMember({ organizationId: orgId, userId: staff.id, roleId: staffRole.id });

      const res = await request(app.server())
        .get(`/orgs/${orgId}`)
        .set("Authorization", `Bearer ${staff.accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.taxProfile).toEqual({ vatRegistered: true });
      expect(JSON.stringify(res.body)).not.toContain("7366");
      expect(JSON.stringify(res.body)).not.toContain(TIN);
      void owner;
    });

    it("★ reveal returns the FULL number, with no-store + no-referrer headers", async () => {
      const { owner, orgId } = await orgWithTaxProfile();
      const res = await request(app.server())
        .post(`/orgs/${orgId}/tax-profile/reveal`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .set("Content-Type", "application/json")
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.taxId).toBe(TIN);
      // The headers are the difference between "shown once" and "cached by a
      // proxy and leaked through a Referer" — asserted from the exported
      // policy, not from a copy typed here.
      assertResponseHeaders(res, TAX_ID_REVEAL_RESPONSE_HEADERS);
    });

    it("★ reveal is the ONLY route allowed to emit a full TIN, and the list says so", async () => {
      expect(TAX_ID_RESPONSE_ALLOWLIST).toHaveLength(1);
      expect(isTaxIdAllowedOnRoute("POST", "/orgs/:orgId/tax-profile/reveal")).toBe(true);
      // Everything else in the feature, by construction rather than by spot check.
      for (const route of auditApp(app.app).routes) {
        if (route.path.includes("tax-profile/reveal")) continue;
        expect(
          isTaxIdAllowedOnRoute(route.method, route.path),
          `${route.method} ${route.path} must not be allowed to return a full TIN`,
        ).toBe(false);
      }
    });

    it("★ a Staff member cannot reveal — 403, and nothing is emitted", async () => {
      const { orgId } = await orgWithTaxProfile();
      const staffRole = await prisma.role.findFirstOrThrow({
        where: { organizationId: orgId, name: "Staff" },
      });
      const staff = await newUser();
      await kit.addMember({ organizationId: orgId, userId: staff.id, roleId: staffRole.id });

      const events = collectSecurityEvents(app.events);
      const res = await request(app.server())
        .post(`/orgs/${orgId}/tax-profile/reveal`)
        .set("Authorization", `Bearer ${staff.accessToken}`)
        .set("Content-Type", "application/json")
        .send({});
      assertErrorEnvelope(res, { status: 403, code: "FORBIDDEN" });
      expect(JSON.stringify(res.body)).not.toContain(TIN);
      expect(events.ofType("org.tax_profile.revealed")).toEqual([]);
      events.stop();
    });

    it("★ a successful reveal is ALWAYS recorded, and the record carries no digits", async () => {
      // This event is the entire difference between "allowed to see it" and
      // "seen with nobody knowing". It must exist, and it must not itself
      // become a place the number is stored.
      const { owner, orgId } = await orgWithTaxProfile();
      const events = collectSecurityEvents(app.events);
      await request(app.server())
        .post(`/orgs/${orgId}/tax-profile/reveal`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .set("Content-Type", "application/json")
        .send({});

      const revealed = events.ofType("org.tax_profile.revealed");
      expect(revealed).toHaveLength(1);
      expect(revealed[0]?.payload).toMatchObject({ actorUserId: owner.id, organizationId: orgId });
      // PAYLOAD only, deliberately: the event envelope carries an epoch-millis
      // `at`, and a 4-digit window of a 13-digit TIN collides with a 13-digit
      // timestamp often enough to fail at random. The guarantee is about what
      // we put in the payload.
      const serialized = JSON.stringify(revealed.map((e) => e.payload));
      expect(serialized).not.toContain(TIN);
      // …and not even a fragment: a "last four for context" would defeat it.
      for (let i = 0; i + 4 <= TIN.length; i++) {
        expect(serialized).not.toContain(TIN.slice(i, i + 4));
      }
      events.stop();
    });

    it("★ setting the profile records taxIdPresent, never the number itself", async () => {
      const owner = await newUser();
      const created = await createOrg(owner.accessToken, { name: "ร้านบันทึกภาษี" });
      const orgId = created.body.organization.id as string;
      const events = collectSecurityEvents(app.events);
      await request(app.server())
        .put(`/orgs/${orgId}/tax-profile`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .set("Content-Type", "application/json")
        .send(COMPLETE);

      const set = events.ofType("org.tax_profile.set");
      expect(set).toHaveLength(1);
      expect(set[0]?.payload).toMatchObject({ taxIdPresent: true });
      expect(JSON.stringify(set.map((e) => e.payload))).not.toContain(TIN);
      events.stop();
    });
  });

  // ── the mandatory cross-org sweep (CLAUDE.md rule 1) ────────────────────

  describe("★ cross-org isolation — the 4+1 persona sweep", () => {
    let leak: OrgLeakKit;

    beforeAll(async () => {
      leak = await createOrgLeakKit(app.app, prisma, { withUnderprivileged: true });
    });

    afterAll(async () => {
      if (leak) await leak.cleanup();
    });

    it("GET /orgs/{orgId} leaks nothing in any direction", async () => {
      const outcomes = await leak.sweep({ method: "get", path: "/orgs/{orgId}" });
      expect(outcomes).toHaveLength(15); // 5 personas × 3 targets
      assertNoCrossOrgLeak(outcomes, { foreignValues: leak.foreignEmails("activeInAOnly") });

      // The control: the member WAS served, and got THEIR org — not the one the
      // URL asked about, if those two could ever differ.
      const served = outcomes.find((o) => o.persona === "activeInAOnly" && o.target === "A");
      expect(served?.status).toBe(200);
      expect((served?.body as { id: string }).id).toBe(leak.orgA.id);
    });

    it("PATCH /orgs/{orgId} leaks nothing in any direction", async () => {
      const before = await prisma.organization.findUniqueOrThrow({ where: { id: leak.orgA.id } });
      const outcomes = await leak.sweep({
        method: "patch",
        path: "/orgs/{orgId}",
        body: { name: "ชื่อที่ถูกตั้งระหว่างการกวาด" },
      });
      assertNoCrossOrgLeak(outcomes, { foreignValues: leak.foreignEmails("activeInAOnly") });
      // The control: A's own Owner DID rename it, so "everyone was refused"
      // cannot be why the sweep is clean.
      const orgA = await prisma.organization.findUniqueOrThrow({ where: { id: leak.orgA.id } });
      expect(orgA.name).not.toBe(before.name);
    });

    it("★ golden rule 3: a member of A cannot write to B — and B's row is untouched", async () => {
      // Deliberately NOT part of the sweep above: `activeInBoth` is a genuine
      // member of B and renames it correctly there, so a "B never changed"
      // assertion over the whole sweep would be false for the right reason.
      // Here the caller is a member of A ONLY, so any change to B is a leak.
      const outsider = leak.persona("activeInAOnly");
      const before = await prisma.organization.findUniqueOrThrow({ where: { id: leak.orgB.id } });

      const res = await request(app.server())
        .patch(`/orgs/${leak.orgB.id}`)
        .set("Authorization", `Bearer ${outsider.accessToken}`)
        .set("Content-Type", "application/json")
        .send({ name: "ชื่อที่คนนอกพยายามตั้ง" });

      assertErrorEnvelope(res, { status: 403, code: "ORG_ACCESS_DENIED" });
      const after = await prisma.organization.findUniqueOrThrow({ where: { id: leak.orgB.id } });
      expect(after.name).toBe(before.name);
      expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
    });

    it("★ the Staff persona gets FORBIDDEN while the stranger gets ORG_ACCESS_DENIED (I-5)", async () => {
      const outcomes = await leak.sweep({
        method: "patch",
        path: "/orgs/{orgId}",
        body: { name: "ชื่อใหม่อีกครั้ง" },
        targets: ["A"],
      });
      const staff = outcomes.find((o) => o.persona === "underprivilegedInA")!;
      const stranger = outcomes.find((o) => o.persona === "noMembership")!;
      assertErrorEnvelope({ status: staff.status, body: staff.body }, { code: "FORBIDDEN" });
      assertErrorEnvelope(
        { status: stranger.status, body: stranger.body },
        { code: "ORG_ACCESS_DENIED" },
      );
    });
  });

  // ── the live router vs the contract tables ──────────────────────────────

  describe("route registry (I-02 / G-13)", () => {
    it("★ every org-scoped route the app serves declares its authorization", () => {
      assertRouteRegistryClean(auditApp(app.app));
    });

    it("★ the four new routes are live, with the tiers api-spec §2 states", () => {
      const routes = auditApp(app.app).routes;
      const find = (method: string, path: string) =>
        routes.find((r) => r.method === method && r.path === path);

      expect(find("POST", "/organizations")).toMatchObject({ scope: "user" });
      expect(find("GET", "/me/organizations")).toMatchObject({ scope: "user" });
      expect(find("GET", "/orgs/{orgId}")).toMatchObject({
        scope: "org",
        declaration: "any-active-member",
      });
      expect(find("PATCH", "/orgs/{orgId}")).toMatchObject({
        scope: "org",
        declaration: "capability",
        capability: "manage_org_settings",
      });
    });

    it("the two rows T-002-16 ships are no longer `pending`", () => {
      const pending = auditApp(app.app).pending.map((p) => p.route);
      expect(pending).not.toContain("PATCH /orgs/{orgId}");
      expect(pending).not.toContain("GET /orgs/{orgId}");
      // …the rest of F-002 still is, which is what keeps this assertion honest.
      expect(pending.length).toBeGreaterThan(0);
    });
  });
});
