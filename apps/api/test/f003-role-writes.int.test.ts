// F-003 · T-003-B26a ★ — D-034 Addendum + Addendum 2 on the REAL stack (DB + Redis):
// editing / deleting a role that OTHER active members hold.
//
//   I3-31  D034-R01 … D034-R21 — architecture §13.6 table, one case per row, plus the
//          §4.4 edge (ADM_A adds manage_billing to Admin → ROLE_EXCEEDS_ACTOR). Every
//          refusal asserts the code, that the Role row (caps · name · version) is
//          UNCHANGED, that no success event left, and the event the table names
//          (R13–R16: no security event at all, a `role_write_refused` warn instead).
//   I3-32  "AC-5.4b (the role-edit path)": lower → reset → raise dies at step 1, for a
//          custom R_B = Admin's caps AND for the Admin role with two Admins · controls:
//          the Owner's step 1 passes (and then the reset really does go through —
//          the threat is real), an Admin editing a role only they hold passes.
//   I3-33  the two-person collusion (SR-17 · AC-5.8): MR lowers R_T → 403
//          ROLE_HELD_REQUIRES_MANAGE_MEMBERS, MM's reset of T → 404, nothing to undo ·
//          control: MR′ (MR + manage_members) passes step 1 and MM's reset then succeeds.
//   I3-34  MR's verdict on a role others hold: canEdit/canDelete
//          in_use_requires_manage_members, canClone allowed — and the reason can be
//          recomputed from what MR already reads (usage.activeMembers + myMembership).
//   I3-56  part 2 (AC-10.1 · I-45 on the F-003 routes): `Role.key` decides nothing on
//          role writes — ROLE_LOCKED follows isSystem/full_access, not key="owner";
//          TTL (isElevatedRole) and RoleDetail verdicts follow capabilities.
//          Part 1 (the F-002 Owner-only set) is role-key-authority.int.test.ts.
//
// Rows already proved elsewhere are NOT re-proved here and are named instead:
//   I3-08 control (no-op rename on a held equal role → 403) — f003-role-update.e2e.int.test.ts
//   the delete ORDER on one held role (designer → HELD, Admin → TNBA, Owner → IN_USE) —
//     f003-role-delete.e2e.int.test.ts "order on a held role"
//   I3-25…I3-30 (the member-route half of D-034) — members.f003.e2e.int.test.ts
//
// Every case builds its own shop: a role edit is state.
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { Redis } from "ioredis";
import { PrismaClient } from "@omnistock/db";
import { AccessTokenService } from "../src/auth/access-token.service";
import { THROTTLE_ACCT_PREFIX } from "../src/auth/auth.constants";
import {
  collectSecurityEvents,
  type SecurityEventCollector,
} from "../src/auth/security-events.service";
import { RolesService } from "../src/orgs/roles.service";
import { INT_LANE_ENABLED, createTestApp, type TestApp } from "./app.kit";
import { createF003SeedKit, personaRoleSpecs, type F003SeedKit } from "./f003-seed.kit";
import type { SeededOrg, SeededRole, SeededUser } from "./f002-seed.kit";

const d = INT_LANE_ENABLED ? describe : describe.skip;

if (!INT_LANE_ENABLED) {
  console.warn(
    "[T-003-B26a] SKIPPING the D-034 Addendum suite: TEST_DATABASE_URL / TEST_REDIS_URL are not " +
      "set. D034-R01..R21, the AC-5.4b role-edit attack and the SR-17 collusion are NOT verified.",
  );
}

const HOUR = 3_600_000;
const NEW_PW = "b26a-reset-passphrase-7Qz!";
const SPECS = personaRoleSpecs();
type Res = request.Response;

d("T-003-B26a D-034 Addendum — role writes on roles others hold (E2E, DB+Redis)", () => {
  let on: TestApp;
  let prisma: PrismaClient;
  let redis: Redis;
  let kit: F003SeedKit;
  let sink: SecurityEventCollector;
  const unique = () => Math.random().toString(36).slice(2, 8);

  const tokenOf = (userId: string) =>
    on.app.get(AccessTokenService, { strict: false }).sign(userId);
  const send = (method: "post" | "patch", path: string, userId: string, body: unknown) => {
    const agent = request(on.server());
    return agent[method]
      .call(agent, path)
      .set("Authorization", `Bearer ${tokenOf(userId)}`)
      .set("Content-Type", "application/json")
      .send(body as object);
  };
  const patchRole = (org: SeededOrg, roleId: string, userId: string, body: unknown) =>
    send("patch", `/orgs/${org.id}/roles/${roleId}`, userId, body);
  const delRole = (org: SeededOrg, roleId: string, userId: string) =>
    request(on.server())
      .delete(`/orgs/${org.id}/roles/${roleId}`)
      .set("Authorization", `Bearer ${tokenOf(userId)}`);
  const get = (path: string, userId: string) =>
    request(on.server())
      .get(path)
      .set("Authorization", `Bearer ${tokenOf(userId)}`);
  const reset = async (org: SeededOrg, callerId: string, targetId: string) => {
    await redis.del(`${THROTTLE_ACCT_PREFIX}${callerId}:reset-password`);
    return send("post", `/orgs/${org.id}/members/${targetId}/reset-password`, callerId, {
      newPassword: NEW_PW,
    });
  };
  const roleRow = (id: string) => prisma.role.findUniqueOrThrow({ where: { id } });
  const hashOf = async (userId: string) =>
    (await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } }))
      .passwordHash;
  const roleSuccessEvents = () =>
    sink.events.filter((e) =>
      ["org.role.created", "org.role.updated", "org.role.deleted"].includes(e.type),
    );

  /** A fresh shop: 3 system roles + one member per entry (system role name or a custom role). */
  async function shop(people: Readonly<Record<string, "Owner" | "Admin" | "Staff">>) {
    const org = await kit.createOrg({ name: `b26a-${unique()}` });
    const u: Record<string, SeededUser> = {};
    for (const [name, roleName] of Object.entries(people)) {
      u[name] = await kit.createUser();
      await kit.addMember({
        organizationId: org.id,
        userId: u[name]!.id,
        roleId: org.roles[roleName]!.id,
      });
    }
    return { org, u };
  }
  const custom = (org: SeededOrg, capabilities: readonly string[], key?: string | null) =>
    kit.createCustomRole({
      organizationId: org.id,
      name: `R ${unique()}`,
      capabilities,
      ...(key !== undefined ? { key } : {}),
    });
  async function holder(org: SeededOrg, role: SeededRole, status?: "revoked") {
    const user = await kit.createUser();
    await kit.addMember({
      organizationId: org.id,
      userId: user.id,
      roleId: role.id,
      ...(status ? { status, revokedAt: new Date() } : {}),
    });
    return user;
  }
  const pendingFor = (org: SeededOrg, role: SeededRole, issuer: SeededUser) =>
    kit.createInvitation({
      organizationId: org.id,
      email: `b26a-${unique()}@seed.test`,
      roleId: role.id,
      issuedByUserId: issuer.id,
    });
  const without = (caps: readonly string[], drop: string) => caps.filter((k) => k !== drop);

  /** The refusal is real: status + code, the row untouched, no success event. */
  async function expectRefused(
    res: Res,
    status: number,
    code: string,
    roleId: string,
    before: unknown,
  ) {
    expect([res.status, res.body.error?.code], JSON.stringify(res.body)).toEqual([status, code]);
    expect(await roleRow(roleId)).toEqual(before);
    expect(roleSuccessEvents()).toEqual([]);
  }
  /** Exactly one escalation_denied, for this role and operation, with this reason. */
  function expectEscalation(roleId: string, operation: string, reason: string, excess?: string[]) {
    const denied = sink.ofType("org.role.escalation_denied").map((e) => e.payload);
    expect(denied).toHaveLength(1);
    expect(denied[0]).toMatchObject({ roleId, operation, reason, targetUserId: null });
    if (excess) expect(denied[0]!.excessCapabilities).toEqual(excess);
  }
  /** Addendum 2: refused with NO security event — a warn log line instead (arch §1.3 · §8). */
  function expectHeldLogOnly(warn: ReturnType<typeof vi.spyOn>, roleId: string, operation: string) {
    expect(sink.events.filter((e) => e.type.startsWith("org."))).toEqual([]);
    const lines = warn.mock.calls.map((c) => String(c[0]));
    const line = lines.find((l) => l.includes("role_write_refused") && l.includes(roleId));
    expect(line, lines.join("\n")).toBeDefined();
    expect(line).toContain('"reason":"requires_manage_members"');
    expect(line).toContain(`"operation":"${operation}"`);
  }
  function rolesLogger() {
    const svc = on.app.get(RolesService, { strict: false });
    return vi.spyOn((svc as unknown as { logger: { warn: (m: string) => void } }).logger, "warn");
  }

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
    await prisma.$connect();
    redis = new Redis(process.env.TEST_REDIS_URL!);
    const saved = process.env.ROLE_WRITES_ENABLED;
    process.env.ROLE_WRITES_ENABLED = "true";
    try {
      on = await createTestApp();
    } finally {
      if (saved === undefined) delete process.env.ROLE_WRITES_ENABLED;
      else process.env.ROLE_WRITES_ENABLED = saved;
    }
    kit = createF003SeedKit(prisma, { label: "b26a" });
    sink = collectSecurityEvents(on.events);
  });

  afterAll(async () => {
    sink?.stop();
    if (kit) await kit.cleanup();
    if (on) await on.close();
    if (prisma) await prisma.$disconnect();
    if (redis) redis.disconnect();
  });

  // ── I3-31 · rows 1–12: an Admin actor (manage_members ∧ manage_roles) ──────

  describe("I3-31 ★ D-034 Addendum table (architecture §13.6)", () => {
    it("D034-R01 · Admin A lowers the Admin role that Admin B also holds → 403 TARGET_NOT_BELOW_ACTOR · row/version unchanged · event target_not_below_actor", async () => {
      const { org, u } = await shop({ own: "Owner", a: "Admin", b: "Admin" });
      const admin = org.roles.Admin!;
      const before = await roleRow(admin.id);
      sink.clear();
      const res = await patchRole(org, admin.id, u.a!.id, {
        version: 1,
        capabilities: without(admin.capabilities, "view_financials"),
      });
      await expectRefused(res, 403, "TARGET_NOT_BELOW_ACTOR", admin.id, before);
      expectEscalation(admin.id, "update_role", "target_not_below_actor", []);
    });

    it("D034-R02 · Admin A lowers the Admin role A holds alone → 200 (⊆ as before)", async () => {
      const { org, u } = await shop({ own: "Owner", a: "Admin" });
      const admin = org.roles.Admin!;
      sink.clear();
      const res = await patchRole(org, admin.id, u.a!.id, {
        version: 1,
        capabilities: without(admin.capabilities, "view_financials"),
      });
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect((await roleRow(admin.id)).capabilities).not.toContain("view_financials");
      expect(sink.ofType("org.role.updated")[0]!.payload).toMatchObject({
        affectedActiveMembers: 1,
      });
      expect(sink.ofType("org.role.escalation_denied")).toEqual([]);
    });

    it("D034-R03 · custom R_B = A, held by B → A lowers it → 403 TARGET_NOT_BELOW_ACTOR", async () => {
      const { org, u } = await shop({ own: "Owner", a: "Admin" });
      const rB = await custom(org, SPECS.R_B);
      await holder(org, rB);
      const before = await roleRow(rB.id);
      sink.clear();
      const res = await patchRole(org, rB.id, u.a!.id, {
        version: 1,
        capabilities: without(SPECS.R_B, "view_financials"),
      });
      await expectRefused(res, 403, "TARGET_NOT_BELOW_ACTOR", rB.id, before);
      expectEscalation(rB.id, "update_role", "target_not_below_actor", []);
    });

    it("D034-R04 · R_B = A held by B → rename ONLY → 403 TARGET_NOT_BELOW_ACTOR (every field, N-1)", async () => {
      const { org, u } = await shop({ own: "Owner", a: "Admin" });
      const rB = await custom(org, SPECS.R_B);
      await holder(org, rB);
      const before = await roleRow(rB.id);
      sink.clear();
      const res = await patchRole(org, rB.id, u.a!.id, { version: 1, name: `Renamed ${unique()}` });
      await expectRefused(res, 403, "TARGET_NOT_BELOW_ACTOR", rB.id, before);
      expectEscalation(rB.id, "update_role", "target_not_below_actor");
    });

    it("D034-R05 · R_B = A held by B → the SAME name and caps (no-op) → 403, not a short-circuited 200", async () => {
      const { org, u } = await shop({ own: "Owner", a: "Admin" });
      const rB = await custom(org, SPECS.R_B);
      await holder(org, rB);
      const before = await roleRow(rB.id);
      sink.clear();
      const res = await patchRole(org, rB.id, u.a!.id, {
        version: 1,
        name: before.name,
        capabilities: before.capabilities,
      });
      await expectRefused(res, 403, "TARGET_NOT_BELOW_ACTOR", rB.id, before);
      expectEscalation(rB.id, "update_role", "target_not_below_actor");
    });

    it("D034-R06 · R ⊊ A held by B → raised to EXACTLY A → 200 (= change_role Staff→Admin, §1.3)", async () => {
      const { org, u } = await shop({ own: "Owner", a: "Admin" });
      const r = await custom(org, org.roles.Staff!.capabilities);
      await holder(org, r);
      sink.clear();
      const res = await patchRole(org, r.id, u.a!.id, {
        version: 1,
        capabilities: org.roles.Admin!.capabilities,
      });
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect([...(await roleRow(r.id)).capabilities].sort()).toEqual(
        [...org.roles.Admin!.capabilities].sort(),
      );
      expect(sink.ofType("org.role.updated")[0]!.payload).toMatchObject({
        affectedActiveMembers: 1,
      });
    });

    it("D034-R07 · R ⊊ A held by B → lowered → 200", async () => {
      const { org, u } = await shop({ own: "Owner", a: "Admin" });
      const r = await custom(org, org.roles.Staff!.capabilities);
      await holder(org, r);
      const res = await patchRole(org, r.id, u.a!.id, {
        version: 1,
        capabilities: ["manage_orders"],
      });
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect((await roleRow(r.id)).capabilities).toEqual(["manage_orders"]);
    });

    it("D034-R08 · R ⊄ A (R_BILL), held by B and held by nobody → 403 ROLE_EXCEEDS_ACTOR (before the target axis)", async () => {
      for (const held of [true, false]) {
        const { org, u } = await shop({ own: "Owner", a: "Admin" });
        const bill = await custom(org, SPECS.R_BILL);
        if (held) await holder(org, bill);
        const before = await roleRow(bill.id);
        sink.clear();
        const res = await patchRole(org, bill.id, u.a!.id, {
          version: 1,
          capabilities: ["manage_orders"],
        });
        await expectRefused(res, 403, "ROLE_EXCEEDS_ACTOR", bill.id, before);
        expectEscalation(bill.id, "update_role", "exceeds_actor", ["manage_billing"]);
        expect(res.body.error.details).toBeUndefined(); // AC-6.4: the excess lives in the event only
      }
    });

    it("D034-R08 edge (§4.4 · AC-7.5) · ADM_A adds manage_billing to the Admin role → 403 ROLE_EXCEEDS_ACTOR", async () => {
      const { org, u } = await shop({ own: "Owner", a: "Admin" });
      const admin = org.roles.Admin!;
      const before = await roleRow(admin.id);
      sink.clear();
      const res = await patchRole(org, admin.id, u.a!.id, {
        version: 1,
        capabilities: [...admin.capabilities, "manage_billing"],
      });
      await expectRefused(res, 403, "ROLE_EXCEEDS_ACTOR", admin.id, before);
      expectEscalation(admin.id, "update_role", "exceeds_actor", ["manage_billing"]);
    });

    it("D034-R09 · DELETE R_B = A held by B → 403 TARGET_NOT_BELOW_ACTOR (before ROLE_IN_USE) · role stays live", async () => {
      const { org, u } = await shop({ own: "Owner", a: "Admin" });
      const rB = await custom(org, SPECS.R_B);
      await holder(org, rB);
      const before = await roleRow(rB.id);
      sink.clear();
      const res = await delRole(org, rB.id, u.a!.id);
      await expectRefused(res, 403, "TARGET_NOT_BELOW_ACTOR", rB.id, before);
      expect(res.body.error.details).toBeUndefined(); // no in-use counts leak past the rule
      expectEscalation(rB.id, "delete_role", "target_not_below_actor", []);
    });

    it("D034-R10 · DELETE R ⊊ A held by B → 409 ROLE_IN_USE (the rules pass; in-use answers)", async () => {
      const { org, u } = await shop({ own: "Owner", a: "Admin" });
      const r = await custom(org, org.roles.Staff!.capabilities);
      await holder(org, r);
      const before = await roleRow(r.id);
      sink.clear();
      const res = await delRole(org, r.id, u.a!.id);
      await expectRefused(res, 409, "ROLE_IN_USE", r.id, before);
      expect(res.body.error.details).toEqual({ activeMembers: 1, pendingInvitations: 0 });
      expect(sink.ofType("org.role.escalation_denied")).toEqual([]);
    });

    it("D034-R11 · the Owner lowers the Admin role that several Admins hold → 200 (full_access bypass)", async () => {
      const { org, u } = await shop({ own: "Owner", a: "Admin", b: "Admin", c: "Admin" });
      const admin = org.roles.Admin!;
      sink.clear();
      const res = await patchRole(org, admin.id, u.own!.id, {
        version: 1,
        capabilities: without(admin.capabilities, "view_financials"),
      });
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect(sink.ofType("org.role.updated")[0]!.payload).toMatchObject({
        affectedActiveMembers: 3,
      });
    });

    it("D034-R12 · R_B = A whose only other 'holder' is REVOKED, or only a PENDING invitation → 200 (neither counts)", async () => {
      for (const variant of ["revoked", "pending invitation"] as const) {
        const { org, u } = await shop({ own: "Owner", a: "Admin" });
        const rB = await custom(org, SPECS.R_B);
        if (variant === "revoked") await holder(org, rB, "revoked");
        else await pendingFor(org, rB, u.own!);
        const res = await patchRole(org, rB.id, u.a!.id, {
          version: 1,
          capabilities: without(SPECS.R_B, "view_financials"),
        });
        expect(res.status, `${variant}: ${JSON.stringify(res.body)}`).toBe(200);
      }
    });

    // ── rows 13–21: MR (manage_roles, NO manage_members) — Addendum 2 ────────

    /** Owner + M holding R_MR; T holds `held` (default R_T2 = {orders, products} ⊊ M). */
    async function designerShop(
      heldCaps: readonly string[] = ["manage_orders", "manage_products"],
    ) {
      const { org, u } = await shop({ own: "Owner" });
      const rMR = await custom(org, SPECS.R_MR);
      const m = await holder(org, rMR);
      const held = await custom(org, heldCaps);
      const t = await holder(org, held);
      return { org, u, m, t, rMR, held };
    }

    it("D034-R13 · M lowers R_T ⊊ M that T holds → 403 ROLE_HELD_REQUIRES_MANAGE_MEMBERS · unchanged · NO security event · warn log", async () => {
      const { org, m, held } = await designerShop();
      const before = await roleRow(held.id);
      const warn = rolesLogger();
      try {
        sink.clear();
        const res = await patchRole(org, held.id, m.id, {
          version: 1,
          capabilities: ["manage_orders"],
        });
        await expectRefused(res, 403, "ROLE_HELD_REQUIRES_MANAGE_MEMBERS", held.id, before);
        expectHeldLogOnly(warn, held.id, "updateRole");
      } finally {
        warn.mockRestore();
      }
    });

    it("D034-R14 · M on R_T held by T: rename-only and a no-op → 403 ROLE_HELD_REQUIRES_MANAGE_MEMBERS (no short-circuit)", async () => {
      const { org, m, held } = await designerShop();
      const before = await roleRow(held.id);
      const warn = rolesLogger();
      try {
        for (const body of [
          { version: 1, name: `Renamed ${unique()}` },
          { version: 1, name: before.name, capabilities: before.capabilities },
        ]) {
          sink.clear();
          warn.mockClear();
          const res = await patchRole(org, held.id, m.id, body);
          await expectRefused(res, 403, "ROLE_HELD_REQUIRES_MANAGE_MEMBERS", held.id, before);
          expectHeldLogOnly(warn, held.id, "updateRole");
        }
      } finally {
        warn.mockRestore();
      }
    });

    it("D034-R15 · M DELETEs R_T held by T → 403 ROLE_HELD_REQUIRES_MANAGE_MEMBERS (before ROLE_IN_USE)", async () => {
      const { org, m, held } = await designerShop();
      const before = await roleRow(held.id);
      const warn = rolesLogger();
      try {
        sink.clear();
        const res = await delRole(org, held.id, m.id);
        await expectRefused(res, 403, "ROLE_HELD_REQUIRES_MANAGE_MEMBERS", held.id, before);
        expect(res.body.error.details).toBeUndefined();
        expectHeldLogOnly(warn, held.id, "deleteRole");
      } finally {
        warn.mockRestore();
      }
    });

    it("D034-R16 · R = M exactly, held by T → M lowers it → 403 ROLE_HELD_REQUIRES_MANAGE_MEMBERS (the floor before the target axis)", async () => {
      const { org, m, held } = await designerShop(SPECS.R_MR);
      const before = await roleRow(held.id);
      const warn = rolesLogger();
      try {
        sink.clear();
        const res = await patchRole(org, held.id, m.id, {
          version: 1,
          capabilities: without(SPECS.R_MR, "manage_products"),
        });
        await expectRefused(res, 403, "ROLE_HELD_REQUIRES_MANAGE_MEMBERS", held.id, before);
        expectHeldLogOnly(warn, held.id, "updateRole");
      } finally {
        warn.mockRestore();
      }
    });

    it("D034-R17 · R ⊄ M held by T → 403 ROLE_EXCEEDS_ACTOR (before the manage_members floor) + event", async () => {
      const { org, m, held } = await designerShop(["manage_members", "manage_orders"]);
      const before = await roleRow(held.id);
      sink.clear();
      const res = await patchRole(org, held.id, m.id, {
        version: 1,
        capabilities: ["manage_orders"],
      });
      await expectRefused(res, 403, "ROLE_EXCEEDS_ACTOR", held.id, before);
      expectEscalation(held.id, "update_role", "exceeds_actor", ["manage_members"]);
    });

    it("D034-R18 · M lowers R ⊊ M with NO other active holder (nobody · M alone · T revoked · only a pending link) → 200", async () => {
      const variants = ["nobody", "M alone", "T revoked", "pending link only"] as const;
      for (const variant of variants) {
        const { org, u } = await shop({ own: "Owner" });
        const rMR = await custom(org, SPECS.R_MR);
        const m = await holder(org, rMR);
        let target: SeededRole;
        if (variant === "M alone") {
          target = rMR; // lowering M's OWN role (keeps manage_roles): before = M, holders = 0
        } else {
          target = await custom(org, ["manage_orders", "manage_products"]);
          if (variant === "T revoked") await holder(org, target, "revoked");
          if (variant === "pending link only") await pendingFor(org, target, u.own!);
        }
        const next =
          variant === "M alone" ? without(SPECS.R_MR, "manage_products") : ["manage_orders"];
        const res = await patchRole(org, target.id, m.id, { version: 1, capabilities: next });
        expect(res.status, `${variant}: ${JSON.stringify(res.body)}`).toBe(200);
        expect([...(await roleRow(target.id)).capabilities].sort()).toEqual([...next].sort());
      }
    });

    it("D034-R19 · M clones R_T (held by T) → 201 — a new role has no holder", async () => {
      const { org, m, held } = await designerShop();
      const res = await send("post", `/orgs/${org.id}/roles`, m.id, {
        name: `Clone ${unique()}`,
        capabilities: held.capabilities,
      });
      expect(res.status, JSON.stringify(res.body)).toBe(201);
      expect([...res.body.capabilities].sort()).toEqual([...held.capabilities].sort());
    });

    it("D034-R20 · control of R13: M′ = M + manage_members lowers R_T held by T → 200", async () => {
      const { org, u } = await shop({ own: "Owner" });
      const rMRp = await custom(org, [...SPECS.R_MR, "manage_members"]);
      const mPrime = await holder(org, rMRp);
      const held = await custom(org, ["manage_orders", "manage_products"]);
      await holder(org, held);
      void u;
      const res = await patchRole(org, held.id, mPrime.id, {
        version: 1,
        capabilities: ["manage_orders"],
      });
      expect(res.status, JSON.stringify(res.body)).toBe(200);
    });

    it("D034-R21 · the Owner lowers R_T held by T → 200 (bypass — full_access ⇒ manage_members)", async () => {
      const { org, u, held } = await designerShop();
      const res = await patchRole(org, held.id, u.own!.id, {
        version: 1,
        capabilities: ["manage_orders"],
      });
      expect(res.status, JSON.stringify(res.body)).toBe(200);
    });
  });

  // ── I3-32 · AC-5.4b through the role-edit path ─────────────────────────────

  describe("I3-32 ★ AC-5.4b (the role-edit path): lower → reset → raise dies at step 1", () => {
    for (const variant of ["custom R_B = Admin caps", "the Admin role, two Admins"] as const) {
      it(`${variant}: (1) 403 · caps/version unchanged (2) reset B = 404, password unchanged (3) nothing to undo`, async () => {
        const { org, u } = await shop({ own: "Owner", a: "Admin" });
        let r: SeededRole;
        let b: SeededUser;
        if (variant === "custom R_B = Admin caps") {
          r = await custom(org, SPECS.R_B);
          b = await holder(org, r);
        } else {
          r = org.roles.Admin!;
          b = await holder(org, r);
        }
        const roleBefore = await roleRow(r.id);
        const hashBefore = await hashOf(b.id);

        const step1 = await patchRole(org, r.id, u.a!.id, {
          version: roleBefore.version,
          capabilities: without(roleBefore.capabilities, "view_financials"),
        });
        expect([step1.status, step1.body.error?.code]).toEqual([403, "TARGET_NOT_BELOW_ACTOR"]);
        expect(await roleRow(r.id)).toEqual(roleBefore);

        const step2 = await reset(org, u.a!.id, b.id);
        expect(step2.status, JSON.stringify(step2.body)).toBe(404);
        expect(await hashOf(b.id)).toBe(hashBefore);

        // (3) B still holds exactly what they held — there is nothing to "raise back".
        const m = await prisma.membership.findFirstOrThrow({
          where: { organizationId: org.id, userId: b.id },
          select: { roleId: true, status: true },
        });
        expect(m).toEqual({ roleId: r.id, status: "active" });
        expect(await roleRow(r.id)).toEqual(roleBefore);
      });
    }

    it("control · the Owner's step 1 passes — and THEN Admin A's reset of B goes through (the threat is real)", async () => {
      const { org, u } = await shop({ own: "Owner", a: "Admin" });
      const rB = await custom(org, SPECS.R_B);
      const b = await holder(org, rB);
      const hashBefore = await hashOf(b.id);
      const step1 = await patchRole(org, rB.id, u.own!.id, {
        version: 1,
        capabilities: without(SPECS.R_B, "view_financials"),
      });
      expect(step1.status, JSON.stringify(step1.body)).toBe(200);
      const step2 = await reset(org, u.a!.id, b.id);
      expect(step2.status, JSON.stringify(step2.body)).toBe(200);
      expect(await hashOf(b.id)).not.toBe(hashBefore);
    });

    it("control · Admin A edits a role A holds ALONE → 200", async () => {
      const { org, u } = await shop({ own: "Owner" });
      const rA = await custom(org, SPECS.R_B);
      const a = await holder(org, rA);
      void u;
      const res = await patchRole(org, rA.id, a.id, {
        version: 1,
        capabilities: without(SPECS.R_B, "view_financials"),
      });
      expect(res.status, JSON.stringify(res.body)).toBe(200);
    });
  });

  // ── I3-33 · the two-person collusion (SR-17 · AC-5.8) ──────────────────────

  describe("I3-33 ★ SR-17 · two insiders through a held role (AC-5.8)", () => {
    /** MR, MM and T (R_T = {manage_orders}) in ONE shop — T is in no other shop (C-2 cannot help). */
    async function collusionShop(designerCaps: readonly string[]) {
      const { org, u } = await shop({ own: "Owner" });
      const designerRole = await custom(org, designerCaps);
      const mr = await holder(org, designerRole);
      const mm = await holder(org, await custom(org, SPECS.R_MM));
      const rT = await custom(org, SPECS.R_T);
      const t = await holder(org, rT);
      return { org, u, mr, mm, rT, t };
    }

    it("(1) MR PATCH R_T → {manage_products} = 403 ROLE_HELD_REQUIRES_MANAGE_MEMBERS · (2) MM reset T = 404 · (3) R_T unchanged", async () => {
      const { org, mr, mm, rT, t } = await collusionShop(SPECS.R_MR);
      const roleBefore = await roleRow(rT.id);
      const hashBefore = await hashOf(t.id);
      sink.clear();
      const step1 = await patchRole(org, rT.id, mr.id, {
        version: 1,
        capabilities: ["manage_products"],
      });
      await expectRefused(step1, 403, "ROLE_HELD_REQUIRES_MANAGE_MEMBERS", rT.id, roleBefore);
      const step2 = await reset(org, mm.id, t.id);
      expect(step2.status, JSON.stringify(step2.body)).toBe(404);
      expect(await hashOf(t.id)).toBe(hashBefore);
      expect(await roleRow(rT.id)).toEqual(roleBefore);
    });

    it("control · MR′ (MR + manage_members) passes step 1 — and MM's reset of T then succeeds (the attack is real)", async () => {
      const { org, mr, mm, rT, t } = await collusionShop([...SPECS.R_MR, "manage_members"]);
      const hashBefore = await hashOf(t.id);
      const step1 = await patchRole(org, rT.id, mr.id, {
        version: 1,
        capabilities: ["manage_products"],
      });
      expect(step1.status, JSON.stringify(step1.body)).toBe(200);
      const step2 = await reset(org, mm.id, t.id);
      expect(step2.status, JSON.stringify(step2.body)).toBe(200);
      expect(await hashOf(t.id)).not.toBe(hashBefore);
    });
  });

  // ── I3-34 · MR's verdict ───────────────────────────────────────────────────

  describe("I3-34 · the verdict MR sees on a role others hold", () => {
    it("canEdit/canDelete = in_use_requires_manage_members · canClone allowed · reason recomputable from usage + myMembership · GET /members = 403", async () => {
      const { org } = await shop({ own: "Owner" });
      const rMR = await custom(org, SPECS.R_MR);
      const mr = await holder(org, rMR);
      const rT = await custom(org, SPECS.R_T);
      await holder(org, rT);
      const unheld = await custom(org, ["manage_products"]);

      const detail = (await get(`/orgs/${org.id}/roles/${rT.id}`, mr.id).expect(200)).body;
      expect(detail.viewer).toEqual({
        canEdit: { allowed: false, reason: "in_use_requires_manage_members" },
        canDelete: { allowed: false, reason: "in_use_requires_manage_members" },
        canClone: { allowed: true, reason: null },
      });

      // No new bit: the reason follows from facts MR already reads.
      const me = (await get(`/orgs/${org.id}`, mr.id).expect(200)).body.myMembership;
      const othersHold = detail.usage.activeMembers - (me.roleId === rT.id ? 1 : 0) > 0;
      const recomputed =
        othersHold && !me.capabilities.includes("manage_members")
          ? "in_use_requires_manage_members"
          : null;
      expect(recomputed).toBe(detail.viewer.canEdit.reason);
      expect(detail.usage).toEqual({ activeMembers: 1, pendingInvitations: 0 });
      // …and the body names nobody: numbers only.
      const json = JSON.stringify(detail);
      for (const k of ["userId", "email", "members"]) expect(json).not.toContain(`"${k}"`);

      // control: a role nobody holds → MR may edit and delete it.
      const free = (await get(`/orgs/${org.id}/roles/${unheld.id}`, mr.id).expect(200)).body;
      expect(free.viewer.canEdit).toEqual({ allowed: true, reason: null });
      expect(free.viewer.canDelete).toEqual({ allowed: true, reason: null });

      const members = await get(`/orgs/${org.id}/members`, mr.id);
      expect([members.status, members.body.error?.code]).toEqual([403, "FORBIDDEN"]);
    });
  });

  // ── I3-56 part 2 · Role.key on the F-003 routes ────────────────────────────

  describe("I3-56 ★ part 2 (AC-10.1 · I-45) — Role.key decides nothing on the role routes", () => {
    it("keys swapped (Staff.key=owner, Owner.key=staff): Staff still cannot write roles · the Owner role is still ROLE_LOCKED (verdict role_locked) · the Staff role wearing key=owner is edited (200) and deleted like any held role (ROLE_IN_USE)", async () => {
      const { org, u } = await shop({ own: "Owner", stf: "Staff" });
      const { Owner, Staff } = org.roles;
      await kit.setRoleKey(Owner!.id, null);
      await kit.setRoleKey(Staff!.id, "owner");
      await kit.setRoleKey(Owner!.id, "staff");
      const ownerBefore = await roleRow(Owner!.id);
      const staffBefore = await roleRow(Staff!.id);

      const stfEdit = await patchRole(org, Staff!.id, u.stf!.id, { version: 1, name: "x" });
      expect([stfEdit.status, stfEdit.body.error?.code]).toEqual([403, "FORBIDDEN"]);
      const stfCreate = await send("post", `/orgs/${org.id}/roles`, u.stf!.id, {
        name: `S ${unique()}`,
        capabilities: ["manage_orders"],
      });
      expect([stfCreate.status, stfCreate.body.error?.code]).toEqual([403, "FORBIDDEN"]);

      for (const res of [
        await patchRole(org, Owner!.id, u.own!.id, { version: 1, name: "Boss" }),
        await delRole(org, Owner!.id, u.own!.id),
      ]) {
        expect([res.status, res.body.error?.code]).toEqual([409, "ROLE_LOCKED"]);
      }
      expect(await roleRow(Owner!.id)).toEqual(ownerBefore);
      expect(await roleRow(Staff!.id)).toEqual(staffBefore);

      const view = (await get(`/orgs/${org.id}/roles/${Owner!.id}`, u.own!.id).expect(200)).body;
      expect(view.key).toBe("staff");
      expect(view.viewer.canEdit).toEqual({ allowed: false, reason: "role_locked" });
      // The Staff role wearing "owner" is an ordinary role to the Owner.
      const staffView = (await get(`/orgs/${org.id}/roles/${Staff!.id}`, u.own!.id).expect(200))
        .body;
      expect(staffView.viewer.canEdit).toEqual({ allowed: true, reason: null });

      // …and on the WRITE side (review B26 L-1): the Owner renames it (200, not ROLE_LOCKED)
      // and deleting it answers in-use (Staff still holds it), not ROLE_LOCKED.
      const rename = await patchRole(org, Staff!.id, u.own!.id, {
        version: staffBefore.version,
        name: `Crew ${unique()}`,
      });
      expect(rename.status, JSON.stringify(rename.body)).toBe(200);
      expect(rename.body.key).toBe("owner");
      const del = await delRole(org, Staff!.id, u.own!.id);
      expect([del.status, del.body.error?.code]).toEqual([409, "ROLE_IN_USE"]);
    });

    it("a CUSTOM role with key=owner is not ROLE_LOCKED (Owner and Admin edit it, the Owner deletes it) · TTL follows caps, not key", async () => {
      const { org, u } = await shop({ own: "Owner", adm: "Admin" });
      const { Owner, Admin, Staff } = org.roles;
      await kit.setRoleKey(Owner!.id, null);
      const wearsOwner = await custom(org, ["manage_orders"], "owner");
      expect((await roleRow(wearsOwner.id)).key).toBe("owner");

      const byOwner = await patchRole(org, wearsOwner.id, u.own!.id, {
        version: 1,
        name: `Packer ${unique()}`,
      });
      expect(byOwner.status, JSON.stringify(byOwner.body)).toBe(200);
      const byAdmin = await patchRole(org, wearsOwner.id, u.adm!.id, {
        version: 2,
        capabilities: ["manage_orders", "manage_products"],
      });
      expect(byAdmin.status, JSON.stringify(byAdmin.body)).toBe(200);
      const view = (await get(`/orgs/${org.id}/roles/${wearsOwner.id}`, u.adm!.id).expect(200))
        .body;
      expect(view.viewer.canEdit).toEqual({ allowed: true, reason: null });

      // TTL: elevated by CAPABILITIES (isElevatedRole). Admin wearing "staff" is still 24h;
      // the custom role wearing "owner" is an ordinary 168h link.
      await kit.setRoleKey(Staff!.id, null);
      await kit.setRoleKey(Admin!.id, "staff");
      const ttlOf = async (roleId: string) => {
        const res = await send("post", `/orgs/${org.id}/invitations`, u.own!.id, {
          email: `b26a-ttl-${unique()}@seed.test`,
          roleId,
        });
        expect(res.status, JSON.stringify(res.body)).toBe(201);
        const row = await prisma.invitation.findFirstOrThrow({
          where: { organizationId: org.id, roleId, status: "pending" },
          orderBy: { createdAt: "desc" },
          select: { expiresAt: true, tokenIssuedAt: true },
        });
        return Math.round((row.expiresAt.getTime() - row.tokenIssuedAt.getTime()) / HOUR);
      };
      expect(await ttlOf(Admin!.id)).toBe(24);
      expect(await ttlOf(wearsOwner.id)).toBe(168);

      // and it can be deleted like any custom role once its link is gone
      await prisma.invitation.deleteMany({
        where: { organizationId: org.id, roleId: wearsOwner.id },
      });
      const gone = await delRole(org, wearsOwner.id, u.own!.id);
      expect(gone.status, JSON.stringify(gone.body)).toBe(200);
    });
  });
});
