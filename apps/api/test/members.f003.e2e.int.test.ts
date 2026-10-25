// F-003 · T-003-B17 ★ — the shipped member routes under D-034 (target ⊊ actor,
// grant ⊆ actor), against a real Postgres + Redis.
//
//   I3-25  AC-5.4b: Admin PATCHes another Admin (equal caps) → 403 TARGET_NOT_BELOW_ACTOR
//          (F-002 answered 200) + one `escalation_denied`, nothing written.
//   I3-26  AC-5.4b: Admin DELETEs another Admin → 403 TARGET_NOT_BELOW_ACTOR, still active.
//   I3-27  AC-5.4b: the 3-request attack (lower → reset → raise) dies at step 1.
//   I3-28  controls: Admin→Staff change/remove 200 · self-remove 200 · self-demote
//          200 · self-raise ⊄ 403 ROLE_EXCEEDS_ACTOR · superset/incomparable
//          targets 403 · Owner→Owner 200.
//   I3-29  AC-4.4: every case F-002 refused still answers FORBIDDEN, byte for
//          byte (owner_only comes before the new rules) · LAST_OWNER unchanged.
//   I3-30  SR-19: a no-op PATCH is decided in full — 200 + role_changed (from = to)
//          on a ⊊ target, 403 + escalation_denied on an equal one (MUT-08).
//   memberWrite: PATCH + DELETE share one per-(user, org) bucket (arch §10).
//
// (The invitation-cancel rows of I3-28/I3-47 belong to T-003-B18.)
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { Redis } from "ioredis";
import { PrismaClient } from "@omnistock/db";
import { decideMemberAuthority } from "@omnistock/core-domain";
import { AccessTokenService } from "../src/auth/access-token.service";
import { RefreshTokenService } from "../src/auth/refresh-token.service";
import { ERROR_CODES } from "../src/common/error-codes";
import {
  collectSecurityEvents,
  type SecurityEventCollector,
} from "../src/auth/security-events.service";
import { INT_LANE_ENABLED, createTestApp, type TestApp } from "./app.kit";
import { createF003SeedKit, type F003SeedKit } from "./f003-seed.kit";
import type { SeededOrg, SeededRole, SeededUser } from "./f002-seed.kit";

const d = INT_LANE_ENABLED ? describe : describe.skip;

if (!INT_LANE_ENABLED) {
  console.warn(
    "[T-003-B17] SKIPPING the member-route D-034 suite: TEST_DATABASE_URL / TEST_REDIS_URL " +
      "are not set. AC-5.4b (lower → reset → raise) is NOT verified.",
  );
}

const ESCALATION = "org.role.escalation_denied" as const;

d("T-003-B17 member routes — D-034 target ⊊ / grant ⊆ (E2E, DB+Redis)", () => {
  let app: TestApp;
  let prisma: PrismaClient;
  let redis: Redis;
  let kit: F003SeedKit;
  let sink: SecurityEventCollector;

  const token = (userId: string): string =>
    app.app.get(AccessTokenService, { strict: false }).sign(userId);

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
    await prisma.$connect();
    // Our own connection, so `memberWrite` really counts (the kit leaves it unbound).
    redis = new Redis(process.env.TEST_REDIS_URL!);
    app = await createTestApp({ rateLimitRedis: redis });
    kit = createF003SeedKit(prisma, { label: "b17" });
    sink = collectSecurityEvents(app.events);
  });

  afterAll(async () => {
    sink?.stop();
    if (kit) await kit.cleanup();
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
    if (redis) redis.disconnect();
  });

  /** A fresh shop per test: Owner/Admin/Staff system roles, one member per entry. */
  async function shop(
    roles: Readonly<Record<string, "Owner" | "Admin" | "Staff">>,
  ): Promise<{ org: SeededOrg; people: Record<string, SeededUser> }> {
    const org = await kit.createOrg();
    const people: Record<string, SeededUser> = {};
    for (const [name, roleName] of Object.entries(roles)) {
      const user = await kit.createUser();
      await kit.addMember({
        organizationId: org.id,
        userId: user.id,
        roleId: org.roles[roleName].id,
      });
      people[name] = user;
    }
    return { org, people };
  }

  async function holder(org: SeededOrg, role: SeededRole): Promise<SeededUser> {
    const user = await kit.createUser();
    await kit.addMember({ organizationId: org.id, userId: user.id, roleId: role.id });
    return user;
  }

  const patchRole = (orgId: string, actorId: string, targetId: string, roleId: string) =>
    request(app.server())
      .patch(`/orgs/${orgId}/members/${targetId}`)
      .set("Authorization", `Bearer ${token(actorId)}`)
      .set("Content-Type", "application/json")
      .send({ roleId });

  const remove = (orgId: string, actorId: string, targetId: string) =>
    request(app.server())
      .delete(`/orgs/${orgId}/members/${targetId}`)
      .set("Authorization", `Bearer ${token(actorId)}`);

  const reset = (orgId: string, actorId: string, targetId: string) =>
    request(app.server())
      .post(`/orgs/${orgId}/members/${targetId}/reset-password`)
      .set("Content-Type", "application/json")
      .set("Authorization", `Bearer ${token(actorId)}`)
      .send({ newPassword: "b17-reset-passphrase-4Kx!" });

  /** The DATABASE's answer — never a status code's. */
  const membershipOf = (organizationId: string, userId: string) =>
    prisma.membership.findUniqueOrThrow({
      where: { organizationId_userId: { organizationId, userId } },
      select: { roleId: true, status: true },
    });
  const versionOf = async (roleId: string) =>
    (await prisma.role.findUniqueOrThrow({ where: { id: roleId }, select: { version: true } }))
      .version;
  const hashOf = async (userId: string) =>
    (await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } }))
      .passwordHash;

  /** The relation the production rule computes — a fixture cannot silently be the wrong case. */
  const relation = (actor: readonly string[], target: readonly string[]) => {
    const r = decideMemberAuthority({
      op: "remove",
      actorCapabilities: actor,
      actorIsTarget: false,
      targetCurrentCapabilities: target,
    });
    return r.ok ? "below" : r.reason === "target_not_below_actor" ? r.relation : r.reason;
  };

  /** `{ error: { code, message, traceId } }` with the traceId replaced. */
  const normalized = (body: unknown) => {
    const clone = JSON.parse(JSON.stringify(body)) as { error: { traceId?: string } };
    clone.error.traceId = "<trace>";
    return clone;
  };
  const expectRefusal = (res: request.Response, code: keyof typeof ERROR_CODES) => {
    expect(res.status, res.text).toBe(ERROR_CODES[code].status);
    // AC-6.4: no details on member routes — the excess keys live in the event only.
    expect(normalized(res.body)).toEqual({
      error: { code, message: ERROR_CODES[code].message, traceId: "<trace>" },
    });
  };

  // ── I3-25 / I3-26 ──────────────────────────────────────────────────────

  it("I3-25 ★ AC-5.4b: Admin PATCHes another Admin (equal caps) → 403 TARGET_NOT_BELOW_ACTOR (F-002 = 200), nothing written, one escalation_denied", async () => {
    const { org, people } = await shop({ owner: "Owner", a: "Admin", b: "Admin" });
    expect(relation(org.roles.Admin.capabilities, org.roles.Admin.capabilities)).toBe("equal");
    sink.clear();

    const res = await patchRole(org.id, people.a.id, people.b.id, org.roles.Staff.id);

    expectRefusal(res, "TARGET_NOT_BELOW_ACTOR");
    expect(await membershipOf(org.id, people.b.id)).toEqual({
      roleId: org.roles.Admin.id,
      status: "active",
    });
    expect(sink.ofType("org.member.role_changed")).toHaveLength(0);
    expect(sink.ofType(ESCALATION).map((e) => e.payload)).toEqual([
      {
        actorUserId: people.a.id,
        organizationId: org.id,
        roleId: org.roles.Staff.id,
        targetUserId: people.b.id,
        operation: "change_member_role",
        reason: "target_not_below_actor",
        excessCapabilities: [],
        suppressedCount: 0,
      },
    ]);
  });

  it("I3-26 ★ AC-5.4b: Admin DELETEs another Admin → 403 TARGET_NOT_BELOW_ACTOR, B stays active, one escalation_denied", async () => {
    const { org, people } = await shop({ owner: "Owner", a: "Admin", b: "Admin" });
    sink.clear();

    const res = await remove(org.id, people.a.id, people.b.id);

    expectRefusal(res, "TARGET_NOT_BELOW_ACTOR");
    expect((await membershipOf(org.id, people.b.id)).status).toBe("active");
    expect(sink.ofType("org.member.revoked")).toHaveLength(0);
    expect(sink.ofType(ESCALATION).map((e) => e.payload)).toEqual([
      expect.objectContaining({
        actorUserId: people.a.id,
        roleId: org.roles.Admin.id,
        targetUserId: people.b.id,
        operation: "remove_member",
        reason: "target_not_below_actor",
        excessCapabilities: [],
      }),
    ]);
  });

  // ── I3-27 ──────────────────────────────────────────────────────────────

  it("I3-27 ★ AC-5.4b: lower → reset → raise dies at step 1 (B in no other shop, so C-2 does not help)", async () => {
    const { org, people } = await shop({ owner: "Owner", a: "Admin", b: "Admin" });
    expect(await prisma.membership.count({ where: { userId: people.b.id } })).toBe(1);
    const refresh = await app.app
      .get(RefreshTokenService, { strict: false })
      .issueOnLogin(people.b.id, null);
    const adminVersion = await versionOf(org.roles.Admin.id);
    const hashBefore = await hashOf(people.b.id);

    // (1) lower B to Staff — refused.
    const lower = await patchRole(org.id, people.a.id, people.b.id, org.roles.Staff.id);
    expect(lower.status).toBe(403);
    expect(lower.body.error.code).toBe("TARGET_NOT_BELOW_ACTOR");
    expect(await membershipOf(org.id, people.b.id)).toEqual({
      roleId: org.roles.Admin.id,
      status: "active",
    });
    expect(await versionOf(org.roles.Admin.id)).toBe(adminVersion);

    // (2) reset B — still equal to A, so the uniform 404; the password is untouched.
    const res = await reset(org.id, people.a.id, people.b.id);
    expect(res.status).toBe(404);
    expect(await hashOf(people.b.id)).toBe(hashBefore);

    // (3) nothing to raise back: B never moved, and B's session was never touched.
    expect((await membershipOf(org.id, people.b.id)).roleId).toBe(org.roles.Admin.id);
    const rotated = await app.app
      .get(RefreshTokenService, { strict: false })
      .rotate(refresh.value, null);
    expect(rotated.ok).toBe(true);
    // RefreshToken → User is RESTRICT, and the seed kit's cleanup deletes users.
    await prisma.refreshToken.deleteMany({ where: { userId: people.b.id } });
  });

  // ── I3-28 controls ─────────────────────────────────────────────────────

  describe("I3-28 · controls on the member routes", () => {
    it("Admin → Staff: change role 200, remove 200", async () => {
      const { org, people } = await shop({ owner: "Owner", a: "Admin", s1: "Staff", s2: "Staff" });
      const toAdminRes = await patchRole(org.id, people.a.id, people.s1.id, org.roles.Staff.id);
      expect(toAdminRes.status, toAdminRes.text).toBe(200);
      const del = await remove(org.id, people.a.id, people.s2.id);
      expect(del.status, del.text).toBe(200);
      expect((await membershipOf(org.id, people.s2.id)).status).toBe("revoked");
    });

    it("Admin removes THEMSELVES via DELETE /members/{self} = 200 (actorIsTarget skips the target axis)", async () => {
      const { org, people } = await shop({ owner: "Owner", a: "Admin" });
      const res = await remove(org.id, people.a.id, people.a.id);
      expect(res.status, res.text).toBe(200);
      expect((await membershipOf(org.id, people.a.id)).status).toBe("revoked");
    });

    it("Admin demotes THEMSELVES to Staff = 200; raising themselves to a role ⊄ = 403 ROLE_EXCEEDS_ACTOR", async () => {
      const { org, people } = await shop({ owner: "Owner", a: "Admin", a2: "Admin" });
      const bigger = await kit.createCustomRole({
        organizationId: org.id,
        name: "b17-admin-plus",
        capabilities: [...org.roles.Admin.capabilities, "manage_billing"],
      });
      sink.clear();
      const up = await patchRole(org.id, people.a2.id, people.a2.id, bigger.id);
      expectRefusal(up, "ROLE_EXCEEDS_ACTOR");
      expect((await membershipOf(org.id, people.a2.id)).roleId).toBe(org.roles.Admin.id);
      expect(sink.ofType(ESCALATION).map((e) => e.payload)).toEqual([
        expect.objectContaining({
          operation: "change_member_role",
          reason: "exceeds_actor",
          roleId: bigger.id,
          targetUserId: people.a2.id,
          excessCapabilities: ["manage_billing"],
        }),
      ]);

      const down = await patchRole(org.id, people.a.id, people.a.id, org.roles.Staff.id);
      expect(down.status, down.text).toBe(200);
      expect((await membershipOf(org.id, people.a.id)).roleId).toBe(org.roles.Staff.id);
    });

    it("superset and incomparable targets = 403 TARGET_NOT_BELOW_ACTOR (PATCH and DELETE)", async () => {
      const { org, people } = await shop({ owner: "Owner", a: "Admin" });
      const superRole = await kit.createCustomRole({
        organizationId: org.id,
        name: "b17-super",
        capabilities: [...org.roles.Admin.capabilities, "manage_billing"],
      });
      const sideRole = await kit.createCustomRole({
        organizationId: org.id,
        name: "b17-side",
        capabilities: ["manage_billing", "manage_orders"],
      });
      const admin = org.roles.Admin.capabilities;
      expect(relation(admin, superRole.capabilities)).toBe("superset");
      expect(relation(admin, sideRole.capabilities)).toBe("incomparable");
      for (const role of [superRole, sideRole]) {
        const target = await holder(org, role);
        expectRefusal(
          await patchRole(org.id, people.a.id, target.id, org.roles.Staff.id),
          "TARGET_NOT_BELOW_ACTOR",
        );
        expectRefusal(await remove(org.id, people.a.id, target.id), "TARGET_NOT_BELOW_ACTOR");
        expect(await membershipOf(org.id, target.id)).toEqual({
          roleId: role.id,
          status: "active",
        });
      }
    });

    it("Owner changes another Owner's role = 200 (full_access bypass; LAST_OWNER still guards)", async () => {
      const { org, people } = await shop({ own: "Owner", own2: "Owner" });
      const res = await patchRole(org.id, people.own.id, people.own2.id, org.roles.Admin.id);
      expect(res.status, res.text).toBe(200);
      expect((await membershipOf(org.id, people.own2.id)).roleId).toBe(org.roles.Admin.id);
    });
  });

  // ── I3-29 ──────────────────────────────────────────────────────────────

  describe("I3-29 · AC-4.4: F-002 refusals answer exactly what they did", () => {
    it("Admin PATCH/DELETE an Owner, and Admin → Owner, are 403 FORBIDDEN with the F-002 body — no new code, no event", async () => {
      const { org, people } = await shop({ own: "Owner", a: "Admin", s: "Staff" });
      sink.clear();
      expectRefusal(
        await patchRole(org.id, people.a.id, people.own.id, org.roles.Staff.id),
        "FORBIDDEN",
      );
      expectRefusal(await remove(org.id, people.a.id, people.own.id), "FORBIDDEN");
      // Promoting to Owner: the grant exceeds the actor too, but owner_only comes first.
      expectRefusal(
        await patchRole(org.id, people.a.id, people.s.id, org.roles.Owner.id),
        "FORBIDDEN",
      );
      expect(sink.ofType(ESCALATION)).toHaveLength(0);
      expect((await membershipOf(org.id, people.own.id)).roleId).toBe(org.roles.Owner.id);
      expect((await membershipOf(org.id, people.s.id)).roleId).toBe(org.roles.Staff.id);
    });

    it("the last Owner being demoted or removed is still 409 LAST_OWNER", async () => {
      const { org, people } = await shop({ own: "Owner" });
      const demote = await patchRole(org.id, people.own.id, people.own.id, org.roles.Admin.id);
      expect(demote.status).toBe(409);
      expect(demote.body.error.code).toBe("LAST_OWNER");
      const del = await remove(org.id, people.own.id, people.own.id);
      expect(del.status).toBe(409);
      expect(del.body.error.code).toBe("LAST_OWNER");
    });
  });

  // ── I3-30 ──────────────────────────────────────────────────────────────

  describe("I3-30 ★ SR-19: a no-op PATCH is decided in full (no short-circuit)", () => {
    it("(a) Admin PATCHes Staff to the role they already hold → 200 + exactly one role_changed (from = to)", async () => {
      const { org, people } = await shop({ owner: "Owner", a: "Admin", s: "Staff" });
      sink.clear();
      const res = await patchRole(org.id, people.a.id, people.s.id, org.roles.Staff.id);
      expect(res.status, res.text).toBe(200);
      expect(sink.ofType("org.member.role_changed").map((e) => e.payload)).toEqual([
        expect.objectContaining({
          actorUserId: people.a.id,
          targetUserId: people.s.id,
          fromRoleId: org.roles.Staff.id,
          toRoleId: org.roles.Staff.id,
        }),
      ]);
      expect(sink.ofType(ESCALATION)).toHaveLength(0);
    });

    it("(b) Admin PATCHes another Admin to the role they already hold → 403 + exactly one escalation_denied", async () => {
      const { org, people } = await shop({ owner: "Owner", a: "Admin", b: "Admin" });
      sink.clear();
      const res = await patchRole(org.id, people.a.id, people.b.id, org.roles.Admin.id);
      expectRefusal(res, "TARGET_NOT_BELOW_ACTOR");
      expect(sink.ofType(ESCALATION)).toHaveLength(1);
      expect(sink.ofType("org.member.role_changed")).toHaveLength(0);
    });
  });

  // ── memberWrite (architecture §10) ─────────────────────────────────────

  it("memberWrite: PATCH and DELETE share one per-(user, org) bucket → 429; another member of the shop is unaffected", async () => {
    const before = process.env.ORG_RATE_LIMIT_MEMBER_WRITE_PER_HOUR;
    process.env.ORG_RATE_LIMIT_MEMBER_WRITE_PER_HOUR = "2";
    try {
      const { org, people } = await shop({
        owner: "Owner",
        owner2: "Owner",
        s1: "Staff",
        s2: "Staff",
      });
      expect(
        (await patchRole(org.id, people.owner.id, people.s1.id, org.roles.Staff.id)).status,
      ).toBe(200);
      expect((await remove(org.id, people.owner.id, people.s1.id)).status).toBe(200);
      const third = await remove(org.id, people.owner.id, people.s2.id);
      expect(third.status).toBe(429);
      expect(third.body.error.code).toBe("RATE_LIMITED");
      expect(Number(third.headers["retry-after"])).toBeGreaterThan(0);
      expect((await membershipOf(org.id, people.s2.id)).status).toBe("active");
      // Keyed by user + org: the co-Owner still has a full bucket.
      expect((await remove(org.id, people.owner2.id, people.s2.id)).status).toBe(200);
    } finally {
      if (before === undefined) delete process.env.ORG_RATE_LIMIT_MEMBER_WRITE_PER_HOUR;
      else process.env.ORG_RATE_LIMIT_MEMBER_WRITE_PER_HOUR = before;
    }
  });
});
