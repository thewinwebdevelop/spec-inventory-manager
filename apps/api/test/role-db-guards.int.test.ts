// F-003 · T-003-B10 ★ — I3-16: the DATABASE refuses what the service must never
// write (test-plan §4.12 I3-16 · data-model §3 · architecture §2 "ชั้นที่ 4").
//
// Every write here goes through `SYSTEM_PRISMA` — the unscoped client an
// allowlisted file really holds — and bypasses every service check on purpose.
// What stops it must be the CHECK / unique / trigger from `*_f003_role_expand`,
// so each refusal is asserted by the constraint or trigger message it carries
// AND by the row being unchanged afterwards (a refusal that had already written
// would still be a hole).
//
// Also pins the two soft-delete triggers of data-model §3.3 (non-concurrent
// halves — the barrier cases are IC3-07) and `provolatile = 'v'` of their
// functions (SR-06: a STABLE function would read with the caller's pre-lock
// snapshot and let the write-skew through).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@omnistock/db";
import { SYSTEM_PRISMA, type SystemPrismaClient } from "../src/tenancy";
import { INT_LANE_ENABLED, applyTestEnv, createTestApp, type TestApp } from "./app.kit";
import { DEFAULT_ROLE_SPECS, createSeedKit, type SeedKit, type SeededOrg } from "./f002-seed.kit";

const d = INT_LANE_ENABLED ? describe : describe.skip;
if (!INT_LANE_ENABLED) {
  console.warn(
    "[T-003-B10] SKIPPING I3-16: TEST_DATABASE_URL / TEST_REDIS_URL are not set. " +
      "The DB-level Role guards (AC-4.1/4.2/3.6) are NOT verified in this run.",
  );
}

const CUSTOM = { name: "Packer", key: null, capabilities: ["manage_stock"], isSystem: false };

d("I3-16 — Role guards at the DB layer, written through SYSTEM_PRISMA", () => {
  let app: TestApp;
  let seedClient: PrismaClient;
  let db: SystemPrismaClient;
  let kit: SeedKit;

  beforeAll(async () => {
    applyTestEnv();
    app = await createTestApp();
    db = app.app.get<SystemPrismaClient>(SYSTEM_PRISMA, { strict: false });
    seedClient = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
    kit = createSeedKit(seedClient, { label: "b10-i316" });
  });

  afterAll(async () => {
    if (kit) await kit.cleanup();
    if (seedClient) await seedClient.$disconnect();
    if (app) await app.close();
  });

  const shop = (): Promise<SeededOrg> => kit.createOrg({ roles: [...DEFAULT_ROLE_SPECS, CUSTOM] });
  const snapshot = (id: string) =>
    db.role.findUniqueOrThrow({
      where: { id },
      select: { name: true, capabilities: true, isSystem: true, deletedAt: true, key: true },
    });

  /** The write must be refused with `pattern` in the error AND leave the row as it was. */
  async function refused(roleId: string, write: () => Promise<unknown>, pattern: RegExp) {
    const before = await snapshot(roleId);
    await expect(write()).rejects.toThrow(pattern);
    expect(await snapshot(roleId)).toEqual(before);
  }

  // ── the system row (Owner) is locked — AC-4.1 ─────────────────────────────

  it("UPDATE name / capabilities / deletedAt / isSystem of the isSystem row → refused by role_system_row_lock", async () => {
    const org = await shop();
    const owner = org.roles.Owner.id;
    const upd = (data: Record<string, unknown>) => () =>
      db.role.update({ where: { id: owner }, data });
    await refused(owner, upd({ name: "Boss" }), /f003_role_system_row_locked/);
    await refused(
      owner,
      upd({ capabilities: ["full_access", "manage_members"] }),
      /f003_role_system_row_locked/,
    );
    await refused(owner, upd({ capabilities: ["manage_members"] }), /f003_role_system_row_locked/);
    await refused(owner, upd({ deletedAt: new Date() }), /f003_role_system_row_locked/);
    await refused(owner, upd({ isSystem: false }), /f003_role_system_row_locked/);
  });

  it("control: `key` of the isSystem row CAN change (I-45 swaps keys) and so can version", async () => {
    const org = await shop();
    const owner = org.roles.Owner.id;
    await db.role.update({ where: { id: owner }, data: { key: null, version: { increment: 1 } } });
    const row = await db.role.findUniqueOrThrow({
      where: { id: owner },
      select: { key: true, version: true },
    });
    expect(row).toEqual({ key: null, version: 2 });
  });

  // ── a custom role never becomes a system role — SR-07 ─────────────────────

  it("custom `SET isSystem=true, capabilities='{full_access}'` → refused by role_system_flag_guard", async () => {
    const org = await shop();
    const packer = org.roles.Packer.id;
    await refused(
      packer,
      () =>
        db.role.update({
          where: { id: packer },
          data: { isSystem: true, capabilities: ["full_access"] },
        }),
      /f003_role_system_flag_forbidden/,
    );
    // the flag alone, too (the CHECK would have let this one through)
    await refused(
      packer,
      () => db.$executeRawUnsafe(`UPDATE "Role" SET "isSystem" = true WHERE id = $1`, packer),
      /f003_role_system_flag_forbidden/,
    );
  });

  it("INSERT a second isSystem role in a shop → unique Role_one_system_per_org", async () => {
    const org = await shop();
    const count = () => db.role.count({ where: { organizationId: org.id } });
    const n = await count();
    await expect(
      db.role.create({
        data: {
          organizationId: org.id,
          name: "Owner 2",
          isSystem: true,
          capabilities: ["full_access"],
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
    expect(await count()).toBe(n);
  });

  // ── CHECKs — AC-4.2 · AC-3.6 · AC-3.4/SR-04 ───────────────────────────────

  it("custom role holding full_access → CHECK Role_full_access_system_only (insert and update)", async () => {
    const org = await shop();
    await expect(
      db.role.create({
        data: { organizationId: org.id, name: "Root", capabilities: ["full_access"] },
      }),
    ).rejects.toThrow(/Role_full_access_system_only/);
    const packer = org.roles.Packer.id;
    await refused(
      packer,
      () =>
        db.role.update({
          where: { id: packer },
          data: { capabilities: ["manage_stock", "full_access"] },
        }),
      /Role_full_access_system_only/,
    );
  });

  it("capabilities '{}' → CHECK Role_capabilities_nonempty (insert and update)", async () => {
    const org = await shop();
    await expect(
      db.role.create({ data: { organizationId: org.id, name: "Empty", capabilities: [] } }),
    ).rejects.toThrow(/Role_capabilities_nonempty/);
    const packer = org.roles.Packer.id;
    await refused(
      packer,
      () => db.role.update({ where: { id: packer }, data: { capabilities: [] } }),
      /Role_capabilities_nonempty/,
    );
  });

  it("name with a forbidden code point (Cc/Cf/Default_Ignorable/Co/filler), untrimmed, a double space, or > 50 chars → CHECK Role_name_shape", async () => {
    const org = await shop();
    for (const name of [
      "Pa\u200Bcker",
      "\u202Eนาหร",
      "พนัก\u2060งาน",
      "Owner\uFEFF",
      "เจ้าของ\u3164ร้าน",
      "Staff\uFE0F",
      "\uE000Lead",
      "Tab\there",
      " Lead",
      "Two  spaces",
      "x".repeat(51),
    ]) {
      await expect(
        db.role.create({ data: { organizationId: org.id, name, capabilities: ["manage_stock"] } }),
        JSON.stringify(name),
      ).rejects.toThrow(/Role_name_shape/);
    }
    // control: Thai + single spaces + exactly 50 chars is fine
    await db.role.create({
      data: { organizationId: org.id, name: "แพ็ค ของ", capabilities: ["manage_stock"] },
    });
    await db.role.create({
      data: { organizationId: org.id, name: "y".repeat(50), capabilities: ["manage_stock"] },
    });
  });

  it("case-insensitive unique among LIVE roles; a soft-deleted name is reusable", async () => {
    const org = await shop();
    await expect(
      db.role.create({
        data: { organizationId: org.id, name: "packer", capabilities: ["manage_stock"] },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
    await db.role.update({ where: { id: org.roles.Packer.id }, data: { deletedAt: new Date() } });
    const again = await db.role.create({
      data: { organizationId: org.id, name: "PACKER", capabilities: ["manage_stock"] },
    });
    expect(again.name).toBe("PACKER");
  });

  // ── soft-delete triggers (data-model §3.3 · SR-06, sequential halves) ──────

  it("role_soft_delete_guard: an active member or a pending invitation blocks the soft-delete", async () => {
    const org = await shop();
    const packer = org.roles.Packer.id;
    const u = await kit.createUser();
    const m = await kit.addMember({ organizationId: org.id, userId: u.id, roleId: packer });
    const del = () => db.role.update({ where: { id: packer }, data: { deletedAt: new Date() } });
    await refused(packer, del, /f003_role_in_use/);

    await seedClient.membership.update({
      where: { id: m.id },
      data: { status: "revoked", revokedAt: new Date() },
    });
    const inv = await kit.createInvitation({
      organizationId: org.id,
      email: `b10-${u.id}@x.test`,
      roleId: packer,
    });
    await refused(packer, del, /f003_role_in_use/);

    // control: revoked member + cancelled invitation = history only → delete goes through
    await seedClient.invitation.update({
      where: { id: inv.id },
      data: { status: "cancelled", cancelledAt: new Date() },
    });
    await del();
    expect((await snapshot(packer)).deletedAt).not.toBeNull();
  });

  it("role_live_reference_guard: nothing live may point at a soft-deleted role (history may)", async () => {
    const org = await shop();
    const packer = org.roles.Packer.id;
    const u = await kit.createUser();
    const history = await kit.addMember({
      organizationId: org.id,
      userId: u.id,
      roleId: packer,
      status: "revoked",
      revokedAt: new Date(),
    });
    await db.role.update({ where: { id: packer }, data: { deletedAt: new Date() } });

    const u2 = await kit.createUser();
    await expect(
      kit.addMember({ organizationId: org.id, userId: u2.id, roleId: packer }),
    ).rejects.toThrow(/f003_role_deleted/);
    await expect(
      kit.createInvitation({
        organizationId: org.id,
        email: `b10-live-${u2.id}@x.test`,
        roleId: packer,
      }),
    ).rejects.toThrow(/f003_role_deleted/);
    await expect(
      db.membership.update({
        where: { id: history.id },
        data: { status: "active", revokedAt: null },
      }),
    ).rejects.toThrow(/f003_role_deleted/);
    // control: the revoked (history) row still points at it, and a live role still works
    expect((await db.membership.findUniqueOrThrow({ where: { id: history.id } })).status).toBe(
      "revoked",
    );
    await kit.addMember({ organizationId: org.id, userId: u2.id, roleId: org.roles.Staff.id });
  });

  it("SR-06: both soft-delete trigger functions are VOLATILE (provolatile = 'v')", async () => {
    const rows = await db.$queryRawUnsafe<Array<{ proname: string; provolatile: string }>>(
      `SELECT proname, provolatile FROM pg_proc
        WHERE proname IN ('omnistock_role_soft_delete_guard', 'omnistock_role_live_reference_guard')
        ORDER BY proname`,
    );
    expect(rows).toEqual([
      { proname: "omnistock_role_live_reference_guard", provolatile: "v" },
      { proname: "omnistock_role_soft_delete_guard", provolatile: "v" },
    ]);
  });
});
