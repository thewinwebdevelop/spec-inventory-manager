// F-003 · T-003-QA06 — unit meta-tests for the F-003 seed kit (test-plan §7, §0).
//
// No database: a recording fake. What these prove is what the kit ASKS the
// database to store and what it refuses BEFORE asking. The DB-side proof (CHECKs,
// triggers, unique indexes actually accepting the seeded state) is in
// `f003-seed.kit.int.test.ts`.
import { describe, it, expect } from "vitest";
import {
  CAPABILITY_FULL_ACCESS,
  SYSTEM_ROLE_BLUEPRINT,
  validateRoleCapabilities,
} from "@omnistock/core-domain";
import type { SeedPrismaClient } from "./f002-seed.kit";
import {
  F003_SCENARIOS,
  PERSONA_KEYS,
  createF003SeedKit,
  personaRoleSpecs,
  personaRoleName,
} from "./f003-seed.kit";

// ── a recording fake (enforces nothing; records what is asked) ───────────────

interface Row {
  [k: string]: unknown;
}
type Args = { data?: Row; where?: Row };

/** Honours the WHERE the way Postgres would: id AND (when given) organizationId. */
function match(table: Map<string, Row>, where: Row): Row | undefined {
  const row = table.get(where.id as string);
  if (!row) return undefined;
  if (where.organizationId !== undefined && row.organizationId !== where.organizationId) {
    return undefined;
  }
  if (where.deletedAt === null && row.deletedAt != null) return undefined;
  return row;
}

function recordingPrisma(opts: { updateCount?: number } = {}) {
  const roles = new Map<string, Row>();
  const invitations = new Map<string, Row>();
  const memberships = new Map<string, Row>();
  const orgs = new Map<string, Row>();
  const calls: string[] = [];
  const updateMany: Array<{ where: Row; data: Row }> = [];
  let n = 0;
  const id = (p: string): string => `${p}-${++n}`;
  const prisma = {
    user: {
      create: async ({ data }: Args) => {
        calls.push("user.create");
        return { id: id("user"), email: data!.email };
      },
    },
    organization: {
      create: async ({ data }: Args) => {
        calls.push("organization.create");
        const row = { id: id("org"), name: data!.name };
        orgs.set(row.id, row);
        return row;
      },
    },
    role: {
      create: async ({ data }: Args) => {
        calls.push("role.create");
        const row = { ...data!, id: id("role") };
        roles.set(row.id as string, row);
        return row;
      },
      updateMany: async (args: { where: Row; data: Row }) => {
        calls.push("role.updateMany");
        updateMany.push(args);
        const row = match(roles, args.where);
        const count = opts.updateCount ?? (row ? 1 : 0);
        if (row && count > 0) Object.assign(row, args.data);
        return { count };
      },
      findFirstOrThrow: async ({ where }: Args) => {
        const row = roles.get(where!.id as string);
        if (!row) throw new Error("fake: no such role");
        return row;
      },
    },
    membership: {
      create: async ({ data }: Args) => {
        calls.push("membership.create");
        const row = { ...data!, id: id("m") };
        memberships.set(row.id as string, row);
        return row;
      },
    },
    invitation: {
      create: async ({ data }: Args) => {
        calls.push("invitation.create");
        const row = { ...data!, id: id("inv") };
        invitations.set(row.id as string, row);
        return row;
      },
      updateMany: async (args: { where: Row; data: Row }) => {
        calls.push("invitation.updateMany");
        updateMany.push(args);
        const row = match(invitations, args.where);
        const count = opts.updateCount ?? (row ? 1 : 0);
        if (row && count > 0) Object.assign(row, args.data);
        return { count };
      },
    },
  } as unknown as SeedPrismaClient;
  return { prisma, roles, invitations, memberships, orgs, calls, updateMany };
}

const dbModule = { hashInvitationToken: (t: string) => `h:${t}` };

describe("personaRoleSpecs — derived from production, never retyped", () => {
  const specs = personaRoleSpecs();

  it("R_B holds exactly the Admin blueprint's capabilities (read from SYSTEM_ROLE_BLUEPRINT)", () => {
    const admin = SYSTEM_ROLE_BLUEPRINT.find((r) => r.key === "admin")!;
    expect([...specs.R_B].sort()).toEqual([...admin.capabilities].sort());
  });

  it("MMS and R_BILL are incomparable: neither capability set contains the other (§0)", () => {
    const mms = new Set(specs.R_MMS);
    const bill = new Set(specs.R_BILL);
    expect([...bill].every((c) => mms.has(c))).toBe(false);
    expect([...mms].every((c) => bill.has(c))).toBe(false);
  });

  it("R_MMS = Staff blueprint + manage_members (and nothing else)", () => {
    const staff = SYSTEM_ROLE_BLUEPRINT.find((r) => r.key === "staff")!;
    expect([...specs.R_MMS].sort()).toEqual([...staff.capabilities, "manage_members"].sort());
  });

  it("the §0 persona sets are the ones the plan states", () => {
    expect([...specs.R_MR].sort()).toEqual(["manage_orders", "manage_products", "manage_roles"]);
    expect([...specs.R_MM].sort()).toEqual(["manage_members", "manage_products"]);
    expect([...specs.R_T]).toEqual(["manage_orders"]);
    expect([...specs.R_BILL].sort()).toEqual(["manage_billing", "manage_orders"]);
  });

  it("★ every persona role is accepted by the PRODUCTION validator (non-vacuous: >= 7 roles)", () => {
    const entries = Object.entries(specs);
    expect(entries.length).toBeGreaterThanOrEqual(7);
    for (const [name, caps] of entries) {
      const verdict = validateRoleCapabilities(caps);
      expect(verdict.ok, `${name} refused: ${JSON.stringify(verdict)}`).toBe(true);
    }
  });

  it("RED control: the validator the kit uses does refuse a role that holds full_access", () => {
    expect(validateRoleCapabilities([CAPABILITY_FULL_ACCESS]).ok).toBe(false);
  });

  it("shop B role names never collide with shop A's, case-insensitively (I3-53 needs a leak to be visible)", () => {
    const a = Object.keys(specs).map((k) =>
      personaRoleName(k as keyof typeof specs, "A").toLowerCase(),
    );
    const b = Object.keys(specs).map((k) =>
      personaRoleName(k as keyof typeof specs, "B").toLowerCase(),
    );
    expect(a.length).toBe(b.length);
    expect(a.filter((x) => b.includes(x))).toEqual([]);
    expect(new Set(a).size).toBe(a.length);
  });
});

describe("createCustomRole", () => {
  it.each([
    ["ROLE_EMPTY", [] as string[]],
    ["FULL_ACCESS_RESERVED", ["manage_orders", CAPABILITY_FULL_ACCESS]],
    ["UNKNOWN_CAPABILITY", ["manage_orders", "not_a_real_capability"]],
  ])("refuses %s BEFORE touching the database", async (code, caps) => {
    const { prisma, calls } = recordingPrisma();
    const kit = createF003SeedKit(prisma, { dbModule });
    await expect(
      kit.createCustomRole({ organizationId: "org-1", name: "X", capabilities: caps }),
    ).rejects.toThrow(new RegExp(code));
    expect(calls).toEqual([]);
  });

  it("writes the validator's canonical capabilities, for this org, as a non-system keyless role", async () => {
    const { prisma, roles } = recordingPrisma();
    const kit = createF003SeedKit(prisma, { dbModule });
    const verdict = validateRoleCapabilities(["manage_orders", "manage_products"]);
    if (!verdict.ok) throw new Error("fixture invalid");
    const role = await kit.createCustomRole({
      organizationId: "org-9",
      name: "Packers",
      capabilities: ["manage_products", "manage_orders"],
    });
    const row = roles.get(role.id)!;
    expect(row.organizationId).toBe("org-9");
    expect(row.isSystem).toBe(false);
    expect(row.key).toBeNull();
    expect(row.capabilities).toEqual([...verdict.capabilities]);
    expect(role.capabilities).toEqual([...verdict.capabilities]);
  });

  it("passes an explicit key through (I-45 style fixtures)", async () => {
    const { prisma, roles } = recordingPrisma();
    const kit = createF003SeedKit(prisma, { dbModule });
    const role = await kit.createCustomRole({
      organizationId: "o",
      name: "Keyed",
      key: "keyed",
      capabilities: ["manage_orders"],
    });
    expect(roles.get(role.id)!.key).toBe("keyed");
  });
});

describe("role / invitation mutators are org-scoped and fail loudly", () => {
  it("softDeleteRole writes deletedAt+deletedByUserId, scoped by organizationId and not-already-deleted", async () => {
    const { prisma, roles, updateMany } = recordingPrisma();
    const kit = createF003SeedKit(prisma, { dbModule });
    const role = await kit.createCustomRole({
      organizationId: "o1",
      name: "Doomed",
      capabilities: ["manage_orders"],
    });
    const at = new Date("2026-10-01T00:00:00.000Z");
    await kit.softDeleteRole("o1", role.id, { deletedAt: at, deletedByUserId: "u1" });
    expect(updateMany[0].where).toMatchObject({
      id: role.id,
      organizationId: "o1",
      deletedAt: null,
    });
    expect(roles.get(role.id)).toMatchObject({ deletedAt: at, deletedByUserId: "u1" });
  });

  it("RED: a role / invitation that belongs to ANOTHER org is never touched (throws, row unchanged)", async () => {
    const { prisma, roles, invitations } = recordingPrisma();
    const kit = createF003SeedKit(prisma, { dbModule });
    const role = await kit.createCustomRole({
      organizationId: "o2",
      name: "Theirs",
      capabilities: ["manage_orders"],
    });
    const inv = await kit.createInvitation({
      organizationId: "o2",
      email: "t@y.test",
      roleId: role.id,
      issuedByUserId: "u",
    });
    const roleBefore = { ...roles.get(role.id)! };
    const expiryBefore = invitations.get(inv.id)!.expiresAt;

    await expect(kit.softDeleteRole("o1", role.id)).rejects.toThrow(/softDeleteRole/);
    await expect(kit.setRoleVersion("o1", role.id, 5)).rejects.toThrow(/setRoleVersion/);
    await expect(
      kit.setLastEdited("o1", role.id, { at: new Date(), byUserId: "u" }),
    ).rejects.toThrow(/setLastEdited/);
    await expect(kit.setInvitationExpiry("o1", inv.id, new Date(0))).rejects.toThrow(
      /setInvitationExpiry/,
    );
    expect(roles.get(role.id)).toEqual(roleBefore);
    expect(invitations.get(inv.id)!.expiresAt).toEqual(expiryBefore);
    // control: the same call with the right org succeeds
    await kit.setRoleVersion("o2", role.id, 5);
    expect(roles.get(role.id)!.version).toBe(5);
  });

  it("setRoleVersion rejects a non-integer / < 1 version instead of writing it", async () => {
    const { prisma, calls } = recordingPrisma();
    const kit = createF003SeedKit(prisma, { dbModule });
    await expect(kit.setRoleVersion("o", "r", 0)).rejects.toThrow(/version/);
    await expect(kit.setRoleVersion("o", "r", 1.5)).rejects.toThrow(/version/);
    expect(calls).toEqual([]);
  });

  it("setLastEdited writes both columns; null/null resets to 'system default'", async () => {
    const { prisma, roles } = recordingPrisma();
    const kit = createF003SeedKit(prisma, { dbModule });
    const role = await kit.createCustomRole({
      organizationId: "o",
      name: "Edited",
      capabilities: ["manage_orders"],
    });
    const at = new Date("2026-09-30T01:02:03.000Z");
    await kit.setLastEdited("o", role.id, { at, byUserId: "editor" });
    expect(roles.get(role.id)).toMatchObject({ lastEditedAt: at, lastEditedByUserId: "editor" });
    await kit.setLastEdited("o", role.id, { at: null, byUserId: null });
    expect(roles.get(role.id)).toMatchObject({ lastEditedAt: null, lastEditedByUserId: null });
  });

  it("setInvitationExpiry writes the exact instant — no 24h/168h clamp (I3-43)", async () => {
    const { prisma, invitations } = recordingPrisma();
    const kit = createF003SeedKit(prisma, { dbModule });
    const inv = await kit.createInvitation({
      organizationId: "o",
      email: "a@b.test",
      roleId: "r",
      issuedByUserId: "u",
    });
    const far = new Date(Date.now() + 365 * 86_400_000);
    await kit.setInvitationExpiry("o", inv.id, far);
    expect(invitations.get(inv.id)!.expiresAt).toEqual(far);
  });
});

describe("createInvitation sets issuedByUserId (D-035)", () => {
  it("writes issuedByUserId, and invitedByUserId defaults to the same person", async () => {
    const { prisma, invitations } = recordingPrisma();
    const kit = createF003SeedKit(prisma, { dbModule });
    const inv = await kit.createInvitation({
      organizationId: "o",
      email: "X@Y.test",
      roleId: "r",
      issuedByUserId: "adm",
    });
    expect(invitations.get(inv.id)).toMatchObject({
      issuedByUserId: "adm",
      invitedByUserId: "adm",
      email: "x@y.test",
      tokenHash: `h:${inv.rawToken}`,
    });
  });

  it("a reissue is expressible: invitedBy ≠ issuedBy", async () => {
    const { prisma, invitations } = recordingPrisma();
    const kit = createF003SeedKit(prisma, { dbModule });
    const inv = await kit.createInvitation({
      organizationId: "o",
      email: "r@y.test",
      roleId: "r",
      invitedByUserId: "adm",
      issuedByUserId: "own",
    });
    expect(invitations.get(inv.id)).toMatchObject({
      invitedByUserId: "adm",
      issuedByUserId: "own",
    });
  });

  it("RED: omitting issuedByUserId is refused (a fixture must decide who issued the link)", async () => {
    const { prisma, calls } = recordingPrisma();
    const kit = createF003SeedKit(prisma, { dbModule });
    await expect(
      kit.createInvitation({
        organizationId: "o",
        email: "q@y.test",
        roleId: "r",
      } as unknown as Parameters<typeof kit.createInvitation>[0]),
    ).rejects.toThrow(/issuedByUserId/);
    expect(calls).toEqual([]);
  });

  it("null is allowed (the F-002 legacy row: no issuer ⇒ fallback to invitedBy)", async () => {
    const { prisma, invitations } = recordingPrisma();
    const kit = createF003SeedKit(prisma, { dbModule });
    const inv = await kit.createInvitation({
      organizationId: "o",
      email: "n@y.test",
      roleId: "r",
      invitedByUserId: "adm",
      issuedByUserId: null,
    });
    expect(invitations.get(inv.id)).toMatchObject({ issuedByUserId: null, invitedByUserId: "adm" });
  });
});

describe("scenario f003-personas (fake DB: shape + org ownership)", () => {
  it("is registered", () => {
    expect(F003_SCENARIOS).toContain("f003-personas");
  });

  it("★ seeds shops A and B with every persona; every row carries its own shop's organizationId", async () => {
    const { prisma, roles, memberships, invitations, orgs } = recordingPrisma();
    const kit = createF003SeedKit(prisma, { dbModule });
    const res = await kit.scenario("f003-personas");
    expect(orgs.size).toBe(2);
    const [idA, idB] = [res.shops.A.org.id, res.shops.B.org.id];
    expect(idA).not.toBe(idB);

    for (const shop of ["A", "B"] as const) {
      const s = res.shops[shop];
      // non-vacuity: every persona is present
      expect(Object.keys(s.users).sort()).toEqual([...PERSONA_KEYS].sort());
      expect(Object.keys(s.memberships).sort()).toEqual([...PERSONA_KEYS].sort());
      for (const m of Object.values(s.memberships)) {
        expect(memberships.get(m.id)!.organizationId).toBe(s.org.id);
        // the role a membership points at belongs to the same shop
        expect(roles.get(m.roleId)!.organizationId).toBe(s.org.id);
      }
      for (const r of Object.values(s.customRoles)) {
        expect(roles.get(r.id)!.organizationId).toBe(s.org.id);
      }
      for (const i of Object.values(s.invitations)) {
        expect(invitations.get(i.id)!.organizationId).toBe(s.org.id);
        expect(roles.get(i.roleId)!.organizationId).toBe(s.org.id);
      }
    }
    expect(Object.keys(res.shops.A.invitations).sort()).toEqual(
      ["accepted", "byAdmA", "cancelled", "expired", "pending", "reissuedByOwn"].sort(),
    );
  });

  it("personas hold the roles the plan names; REV is revoked and holds R_HIST", async () => {
    const { prisma, memberships } = recordingPrisma();
    const kit = createF003SeedKit(prisma, { dbModule });
    const { shops } = await kit.scenario("f003-personas");
    const a = shops.A;
    const roleOf = (p: (typeof PERSONA_KEYS)[number]): string => a.memberships[p].roleId;
    expect(roleOf("OWN")).toBe(a.org.roles.Owner.id);
    expect(roleOf("OWN2")).toBe(a.org.roles.Owner.id);
    expect(roleOf("ADM_A")).toBe(a.org.roles.Admin.id);
    expect(roleOf("ADM_B")).toBe(a.customRoles.R_B.id);
    expect(roleOf("STF")).toBe(a.org.roles.Staff.id);
    expect(roleOf("T")).toBe(a.customRoles.R_T.id);
    expect(roleOf("MMS")).toBe(a.customRoles.R_MMS.id);
    expect(roleOf("REV")).toBe(a.customRoles.R_HIST.id);
    expect(memberships.get(a.memberships.REV.id)).toMatchObject({
      status: "revoked",
      revokedByUserId: a.users.OWN.id,
    });
    expect(memberships.get(a.memberships.REV.id)!.revokedAt).toBeInstanceOf(Date);
  });

  it("invitations: issuer fields follow the plan (byAdmA, reissuedByOwn); expired is in the past", async () => {
    const { prisma, invitations } = recordingPrisma();
    const kit = createF003SeedKit(prisma, { dbModule });
    const { shops } = await kit.scenario("f003-personas");
    const a = shops.A;
    const row = (k: keyof typeof a.invitations): Row => invitations.get(a.invitations[k].id)!;
    expect(row("byAdmA")).toMatchObject({
      issuedByUserId: a.users.ADM_A.id,
      invitedByUserId: a.users.ADM_A.id,
      status: "pending",
    });
    expect(row("reissuedByOwn")).toMatchObject({
      issuedByUserId: a.users.OWN.id,
      invitedByUserId: a.users.ADM_A.id,
      status: "pending",
    });
    expect((row("expired").expiresAt as Date).getTime()).toBeLessThan(Date.now());
    expect(row("expired").status).toBe("pending");
    expect(row("accepted")).toMatchObject({ status: "accepted", acceptedByUserId: a.users.STF.id });
    expect(row("accepted").acceptedAt).toBeInstanceOf(Date);
    expect(row("cancelled")).toMatchObject({ status: "cancelled" });
    expect(row("cancelled").cancelledAt).toBeInstanceOf(Date);
  });

  it("activeInBoth is Admin in A and Staff in B; the moved editor edited A's role but belongs to B only", async () => {
    const { prisma, memberships, roles } = recordingPrisma();
    const kit = createF003SeedKit(prisma, { dbModule });
    const res = await kit.scenario("f003-personas");
    const both = res.activeInBoth;
    expect(memberships.get(both.membershipA.id)).toMatchObject({
      organizationId: res.shops.A.org.id,
      roleId: res.shops.A.org.roles.Admin.id,
    });
    expect(memberships.get(both.membershipB.id)).toMatchObject({
      organizationId: res.shops.B.org.id,
      roleId: res.shops.B.org.roles.Staff.id,
    });
    const moved = res.movedEditor;
    expect(roles.get(moved.editedRoleId)!.organizationId).toBe(res.shops.A.org.id);
    expect(roles.get(moved.editedRoleId)!.lastEditedByUserId).toBe(moved.user.id);
    expect(memberships.get(moved.membershipB.id)!.organizationId).toBe(res.shops.B.org.id);
    const inA = [...memberships.values()].filter(
      (m) => m.userId === moved.user.id && m.organizationId === res.shops.A.org.id,
    );
    expect(inA).toEqual([]);
  });
});
