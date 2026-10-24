// F-003 · T-003-QA06 — DB-backed proof that the F-003 seed kit produces the
// states test-plan §7 / §0 promise, against a real Postgres carrying the
// `f003_role_expand` migration (CHECKs, partial unique indexes, triggers).
//
// Requires TEST_DATABASE_URL. Postgres is SHARED with the other suites: every
// row here is created through the kit and deleted by id via `cleanup()` — never
// a TRUNCATE, never a `deleteMany({})`.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, hashInvitationToken } from "@omnistock/db";
import { SYSTEM_ROLE_BLUEPRINT, validateRoleCapabilities } from "@omnistock/core-domain";
import {
  PERSONA_KEYS,
  createF003SeedKit,
  personaRoleName,
  personaRoleSpecs,
  type F003PersonasResult,
  type F003SeedKit,
} from "./f003-seed.kit";
import { applyTestEnv } from "./app.kit";

const TEST_DB = process.env.TEST_DATABASE_URL;
const d = TEST_DB ? describe : describe.skip;

d("f003-seed.kit (DB)", () => {
  let prisma: PrismaClient;
  let kit: F003SeedKit;
  let personas: F003PersonasResult;

  beforeAll(async () => {
    applyTestEnv(); // hashInvitationToken reads INVITATION_TOKEN_SECRET
    prisma = new PrismaClient({ datasources: { db: { url: TEST_DB } } });
    await prisma.$connect();
    kit = createF003SeedKit(prisma, { label: "f003-int" });
    personas = await kit.scenario("f003-personas");
  }, 120_000);

  afterAll(async () => {
    if (kit) await kit.cleanup();
    if (prisma) await prisma.$disconnect();
  });

  const shops = (): Array<["A" | "B", F003PersonasResult["shops"]["A"]]> => [
    ["A", personas.shops.A],
    ["B", personas.shops.B],
  ];

  it("f003-personas: every persona exists in BOTH shops, as the right membership state", async () => {
    for (const [, shop] of shops()) {
      expect(Object.keys(shop.memberships)).toHaveLength(PERSONA_KEYS.length);
      const rows = await prisma.membership.findMany({
        where: { organizationId: shop.org.id },
        select: { userId: true, status: true, roleId: true },
      });
      const byUser = new Map(rows.map((r) => [r.userId, r]));
      for (const p of PERSONA_KEYS) {
        const row = byUser.get(shop.users[p].id);
        expect(row, `${p} has no membership`).toBeDefined();
        expect(row!.status).toBe(p === "REV" ? "revoked" : "active");
        expect(row!.roleId).toBe(shop.memberships[p].roleId);
      }
    }
  });

  it("★ every seeded row carries ITS shop's organizationId (read back, not trusted from the kit)", async () => {
    for (const [, shop] of shops()) {
      const roleIds = [...Object.values(shop.org.roles), ...Object.values(shop.customRoles)].map(
        (r) => r.id,
      );
      const memberIds = Object.values(shop.memberships).map((m) => m.id);
      const invIds = Object.values(shop.invitations).map((i) => i.id);
      // non-vacuity: 3 system + 7 custom roles, 10 personas, 6 invitations
      expect(roleIds).toHaveLength(10);
      expect(memberIds).toHaveLength(10);
      expect(invIds).toHaveLength(6);
      const stray = {
        roles: await prisma.role.count({
          where: { id: { in: roleIds }, NOT: { organizationId: shop.org.id } },
        }),
        memberships: await prisma.membership.count({
          where: { id: { in: memberIds }, NOT: { organizationId: shop.org.id } },
        }),
        invitations: await prisma.invitation.count({
          where: { id: { in: invIds }, NOT: { organizationId: shop.org.id } },
        }),
      };
      expect(stray).toEqual({ roles: 0, memberships: 0, invitations: 0 });
    }
  });

  it("custom role names: B shares none with A (case-insensitive), within the live-name unique index", async () => {
    const names = async (orgId: string): Promise<string[]> =>
      (
        await prisma.role.findMany({ where: { organizationId: orgId }, select: { name: true } })
      ).map((r) => r.name.toLowerCase());
    const a = (await names(personas.shops.A.org.id)).filter((n) => n.startsWith("r_"));
    const b = (await names(personas.shops.B.org.id)).filter((n) => n.startsWith("r_"));
    expect(a).toHaveLength(7);
    expect(b).toHaveLength(7);
    expect(a.filter((n) => b.includes(n))).toEqual([]);
  });

  it("R_B holds exactly the Admin row's capabilities, read from the database", async () => {
    for (const [, shop] of shops()) {
      const admin = await prisma.role.findFirstOrThrow({
        where: { organizationId: shop.org.id, id: shop.org.roles.Admin.id },
      });
      const rb = await prisma.role.findFirstOrThrow({
        where: { organizationId: shop.org.id, id: shop.customRoles.R_B.id },
      });
      expect([...rb.capabilities].sort()).toEqual([...admin.capabilities].sort());
      expect([...rb.capabilities].sort()).toEqual(
        [...SYSTEM_ROLE_BLUEPRINT.find((r) => r.key === "admin")!.capabilities].sort(),
      );
      expect(rb.isSystem).toBe(false);
      expect(rb.key).toBeNull();
      expect(rb.deletedAt).toBeNull();
      expect(rb.version).toBe(1);
    }
  });

  it("stored custom capabilities are the production validator's canonical output", async () => {
    const specs = personaRoleSpecs();
    for (const [shopTag, shop] of shops()) {
      for (const key of Object.keys(specs) as Array<keyof typeof specs>) {
        const verdict = validateRoleCapabilities(specs[key]);
        if (!verdict.ok) throw new Error(`${key} refused`);
        const row = await prisma.role.findFirstOrThrow({
          where: { organizationId: shop.org.id, name: personaRoleName(key, shopTag) },
        });
        expect(row.capabilities).toEqual([...verdict.capabilities]);
      }
    }
  });

  it("★ read back: no seeded role is empty, none but the system row holds full_access, one system row per shop", async () => {
    const orgIds = [personas.shops.A.org.id, personas.shops.B.org.id];
    const rows = await prisma.role.findMany({
      where: { organizationId: { in: orgIds } },
      select: { isSystem: true, capabilities: true },
    });
    expect(rows.length).toBe(20);
    expect(rows.filter((r) => r.capabilities.length === 0)).toEqual([]);
    expect(rows.filter((r) => !r.isSystem && r.capabilities.includes("full_access"))).toEqual([]);
    expect(rows.filter((r) => r.isSystem)).toHaveLength(2); // one Owner per shop
  });

  it("REV is revoked (row kept, revokedAt/By set) and holds R_HIST, which only history references", async () => {
    const a = personas.shops.A;
    const rev = await prisma.membership.findUniqueOrThrow({ where: { id: a.memberships.REV.id } });
    expect(rev).toMatchObject({
      status: "revoked",
      roleId: a.customRoles.R_HIST.id,
      revokedByUserId: a.users.OWN.id,
    });
    expect(rev.revokedAt).not.toBeNull();
    const live = await prisma.membership.count({
      where: { organizationId: a.org.id, roleId: a.customRoles.R_HIST.id, status: "active" },
    });
    expect(live).toBe(0);
  });

  it("invitations: the six states A/B promise, with issuedByUserId read back from the DB", async () => {
    for (const [, shop] of shops()) {
      const rows = new Map(
        (
          await prisma.invitation.findMany({
            where: { id: { in: Object.values(shop.invitations).map((i) => i.id) } },
          })
        ).map((r) => [r.id, r]),
      );
      const row = (k: keyof typeof shop.invitations) => rows.get(shop.invitations[k].id)!;
      const now = Date.now();
      expect(row("pending")).toMatchObject({
        status: "pending",
        issuedByUserId: shop.users.OWN.id,
      });
      expect(row("pending").expiresAt.getTime()).toBeGreaterThan(now);
      expect(row("expired")).toMatchObject({ status: "pending" });
      expect(row("expired").expiresAt.getTime()).toBeLessThan(now);
      expect(row("accepted")).toMatchObject({
        status: "accepted",
        acceptedByUserId: shop.users.STF.id,
      });
      expect(row("accepted").acceptedAt).not.toBeNull();
      expect(row("cancelled").status).toBe("cancelled");
      expect(row("cancelled").cancelledAt).not.toBeNull();
      expect(row("byAdmA")).toMatchObject({
        issuedByUserId: shop.users.ADM_A.id,
        invitedByUserId: shop.users.ADM_A.id,
      });
      expect(row("reissuedByOwn")).toMatchObject({
        invitedByUserId: shop.users.ADM_A.id,
        issuedByUserId: shop.users.OWN.id,
      });
      // token hashes come from the PRODUCTION function (condition ก)
      for (const k of Object.keys(shop.invitations) as Array<keyof typeof shop.invitations>) {
        expect(row(k).tokenHash).toBe(hashInvitationToken(shop.invitations[k].rawToken));
      }
    }
  });

  it("activeInBoth is Admin in A and Staff in B; the moved editor's edit mark lives in A while membership lives only in B", async () => {
    const { activeInBoth: both, movedEditor: moved, shops: s } = personas;
    const ms = await prisma.membership.findMany({
      where: { userId: both.user.id },
      select: { organizationId: true, roleId: true, status: true },
    });
    expect(ms).toHaveLength(2);
    expect(ms.find((m) => m.organizationId === s.A.org.id)!.roleId).toBe(s.A.org.roles.Admin.id);
    expect(ms.find((m) => m.organizationId === s.B.org.id)!.roleId).toBe(s.B.org.roles.Staff.id);

    const role = await prisma.role.findFirstOrThrow({
      where: { organizationId: s.A.org.id, id: moved.editedRoleId },
    });
    expect(role.lastEditedByUserId).toBe(moved.user.id);
    expect(role.lastEditedAt).not.toBeNull();
    const editorMemberships = await prisma.membership.findMany({
      where: { userId: moved.user.id },
      select: { organizationId: true },
    });
    expect(editorMemberships.map((m) => m.organizationId)).toEqual([s.B.org.id]);
  });

  it("softDeleteRole: an unheld role is soft-deleted (row kept); the live-name index frees the name", async () => {
    const a = personas.shops.A;
    const at = new Date("2026-10-01T00:00:00.000Z");
    await kit.softDeleteRole(a.org.id, a.customRoles.R_BILL.id, {
      deletedAt: at,
      deletedByUserId: a.users.OWN.id,
    });
    const row = await prisma.role.findFirstOrThrow({
      where: { organizationId: a.org.id, id: a.customRoles.R_BILL.id },
    });
    expect(row.deletedAt?.toISOString()).toBe(at.toISOString());
    expect(row.deletedByUserId).toBe(a.users.OWN.id);
    // the same name can be re-created now (partial unique index: live rows only)
    const again = await kit.createCustomRole({
      organizationId: a.org.id,
      name: personaRoleName("R_BILL", "A"),
      capabilities: ["manage_orders"],
    });
    expect(again.id).not.toBe(a.customRoles.R_BILL.id);
  });

  it("RED: soft-deleting a role an ACTIVE member holds is refused by the database trigger, row unchanged", async () => {
    const a = personas.shops.A;
    await expect(kit.softDeleteRole(a.org.id, a.customRoles.R_T.id)).rejects.toThrow(
      /f003_role_in_use/,
    );
    const row = await prisma.role.findFirstOrThrow({
      where: { organizationId: a.org.id, id: a.customRoles.R_T.id },
    });
    expect(row.deletedAt).toBeNull();
  });

  it("setRoleVersion / setLastEdited write what they are given; null/null restores the system default", async () => {
    const b = personas.shops.B;
    const id = b.customRoles.R_MM.id;
    await kit.setRoleVersion(b.org.id, id, 7);
    const at = new Date("2026-09-30T08:00:00.000Z");
    await kit.setLastEdited(b.org.id, id, { at, byUserId: b.users.OWN.id });
    let row = await prisma.role.findFirstOrThrow({ where: { organizationId: b.org.id, id } });
    expect(row.version).toBe(7);
    expect(row.lastEditedAt?.toISOString()).toBe(at.toISOString());
    expect(row.lastEditedByUserId).toBe(b.users.OWN.id);
    await kit.setLastEdited(b.org.id, id, { at: null, byUserId: null });
    row = await prisma.role.findFirstOrThrow({ where: { organizationId: b.org.id, id } });
    expect(row.lastEditedAt).toBeNull();
    expect(row.lastEditedByUserId).toBeNull();
  });

  it("★ tenant guard: a mutator aimed at the OTHER shop's role throws and changes nothing", async () => {
    const a = personas.shops.A;
    const b = personas.shops.B;
    const target = a.customRoles.R_MR.id;
    await expect(kit.setRoleVersion(b.org.id, target, 99)).rejects.toThrow(/setRoleVersion/);
    await expect(
      kit.setLastEdited(b.org.id, target, { at: new Date(), byUserId: "x" }),
    ).rejects.toThrow(/setLastEdited/);
    await expect(kit.softDeleteRole(b.org.id, target)).rejects.toThrow(/softDeleteRole/);
    await expect(
      kit.setInvitationExpiry(b.org.id, a.invitations.pending.id, new Date()),
    ).rejects.toThrow(/setInvitationExpiry/);
    const role = await prisma.role.findFirstOrThrow({
      where: { organizationId: a.org.id, id: target },
    });
    expect(role).toMatchObject({ version: 1, deletedAt: null, lastEditedAt: null });
    const inv = await prisma.invitation.findFirstOrThrow({
      where: { organizationId: a.org.id, id: a.invitations.pending.id },
    });
    expect(inv.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("setInvitationExpiry reaches states the 168h TTL never would (I3-43): far future and far past", async () => {
    const a = personas.shops.A;
    const far = new Date(Date.now() + 400 * 86_400_000);
    await kit.setInvitationExpiry(a.org.id, a.invitations.pending.id, far);
    let row = await prisma.invitation.findUniqueOrThrow({
      where: { id: a.invitations.pending.id },
    });
    expect(row.expiresAt.toISOString()).toBe(far.toISOString());
    const past = new Date(Date.now() - 400 * 86_400_000);
    await kit.setInvitationExpiry(a.org.id, a.invitations.pending.id, past);
    row = await prisma.invitation.findUniqueOrThrow({ where: { id: a.invitations.pending.id } });
    expect(row.expiresAt.toISOString()).toBe(past.toISOString());
  });

  it("the F-002 scenarios still run through the F-003 kit (same base, one cleanup)", async () => {
    const res = await kit.scenario("two-orgs");
    expect(res.orgs).toHaveLength(2);
  });

  it("cleanup() removes exactly this kit's rows — soft-deleted roles included — and spares a bystander", async () => {
    const other = createF003SeedKit(prisma, { label: "f003-bystander" });
    const bystander = await other.scenario("f003-personas");

    const mine = personas.shops.A.org.id;
    const mineB = personas.shops.B.org.id;
    await kit.cleanup();

    for (const orgId of [mine, mineB]) {
      expect(await prisma.organization.findUnique({ where: { id: orgId } })).toBeNull();
      expect(await prisma.role.count({ where: { organizationId: orgId } })).toBe(0);
      expect(await prisma.membership.count({ where: { organizationId: orgId } })).toBe(0);
      expect(await prisma.invitation.count({ where: { organizationId: orgId } })).toBe(0);
    }
    expect(await prisma.role.count({ where: { organizationId: bystander.shops.A.org.id } })).toBe(
      10,
    );
    await other.cleanup();
  });
});
