// ★ B-9 — `grantsOwnership`, and the two things it must not become.
//
// The flag exists because a client could not tell which role is the Owner role
// unless the viewer held it: `capabilities` is deliberately unpublished, so
// ux-wireframe §10.1's rule (show the Owner option, disabled, with the reason)
// was unimplementable for an Admin and S7's filter filtered nothing.
//
// Two properties matter more than the happy path:
//
//   1. it is derived from CAPABILITIES, never from `key`. `key` is a display
//      slug, F-003 lets people mint roles, and @qa's I-45 flips a Staff role's
//      key to "owner" in the database exactly to prove they can disagree.
//   2. adding it must not publish `capabilities`. The row is read with the
//      array and answered without it, and a spread would undo that silently —
//      the M-10 lesson, which this file's subject already carries a warning
//      about.
import { describe, it, expect } from "vitest";
import { OrgContextStore } from "../tenancy";
import { RolesService } from "./roles.service";

interface FakeRole {
  id: string;
  name: string;
  key: string | null;
  isSystem: boolean;
  capabilities: string[];
  nameCustomized?: boolean;
  deletedAt?: Date | null;
}

/** A viewer with no `manage_members` (Staff) unless a test says otherwise. */
const STAFF_VIEWER: readonly string[] = ["view_products"];

function serviceOver(roles: FakeRole[], viewerCapabilities: readonly string[] = STAFF_VIEWER) {
  const prisma = {
    role: {
      // Honours `deletedAt: null` like Postgres (F-003 · LIVE_ROLE_WHERE).
      findMany: async (args: { where?: { deletedAt?: null } } = {}) =>
        (args.where && "deletedAt" in args.where && args.where.deletedAt === null
          ? roles.filter((r) => !r.deletedAt)
          : roles
        ).map((r) => ({ nameCustomized: false, ...r })),
    },
  };
  const store = new OrgContextStore();
  const service = new RolesService(prisma as never, store);
  // The verdict reads the caller from the request's org context (ALS).
  return {
    list: () =>
      store.run(
        { organizationId: "org_1", userId: "usr_v", capabilities: viewerCapabilities },
        () => service.list(),
      ),
  };
}

const OWNER: FakeRole = {
  id: "rol_owner",
  name: "Owner",
  key: "owner",
  isSystem: true,
  capabilities: ["full_access"],
};
const ADMIN: FakeRole = {
  id: "rol_admin",
  name: "Admin",
  key: "admin",
  isSystem: true,
  capabilities: ["manage_members", "manage_org_settings"],
};

describe("RolesService.list — grantsOwnership", () => {
  it("★ true for the role that carries full_access, false for the rest", () => {
    return serviceOver([OWNER, ADMIN])
      .list()
      .then(({ items }) => {
        expect(items.map((r) => [r.name, r.grantsOwnership])).toEqual([
          ["Owner", true],
          ["Admin", false],
        ]);
      });
  });

  it("★ a Staff role whose KEY says owner does not grant ownership (I-45)", async () => {
    // The whole reason the flag is derived rather than inferred. If this ever
    // returns true, every client that trusts the flag has been handed the bug
    // the golden rule exists to prevent.
    const impostor: FakeRole = {
      id: "rol_staff",
      name: "Staff",
      key: "owner",
      isSystem: false,
      capabilities: ["view_products"],
    };
    const { items } = await serviceOver([impostor]).list();

    expect(items[0].grantsOwnership).toBe(false);
  });

  it("★ an Owner role with a NULL key still grants ownership", async () => {
    // The other direction: F-003's custom roles have no key at all, so a client
    // guessing by key would call this one "not the owner" and offer it freely.
    const custom: FakeRole = {
      id: "rol_custom",
      name: "ผู้จัดการใหญ่",
      key: null,
      isSystem: false,
      capabilities: ["full_access"],
    };
    const { items } = await serviceOver([custom]).list();

    expect(items[0].grantsOwnership).toBe(true);
  });

  it("★ the capability list itself is still NOT on the wire", async () => {
    const { items } = await serviceOver([OWNER]).list();

    // Checked as keys, not as a value comparison: a spread would add the field
    // and every `toMatchObject` in the suite would still pass.
    expect(Object.keys(items[0]).sort()).toEqual([
      "grantsOwnership",
      "id",
      "isSystem",
      "key",
      "name",
      "nameCustomized",
    ]);
    expect(JSON.stringify(items[0])).not.toContain("full_access");
  });

  it("keeps the F-002 pagination shape", async () => {
    const { nextCursor } = await serviceOver([OWNER]).list();
    expect(nextCursor).toBeNull();
  });
});

// F-003 · T-003-B22 ★ — `nameCustomized` + `viewerCanAssign` (api-spec §4.1 · AC-2.2).
describe("RolesService.list — F-003 RoleRow fields", () => {
  const STAFF_ROLE: FakeRole = {
    id: "rol_staff",
    name: "แพ็คของ",
    key: "staff",
    isSystem: false,
    capabilities: ["manage_products"],
    nameCustomized: true,
  };
  const CUSTOM: FakeRole = {
    id: "rol_c",
    name: "บัญชี",
    key: null,
    isSystem: false,
    capabilities: ["manage_billing"],
  };

  it("nameCustomized = key null || the column", async () => {
    const { items } = await serviceOver([OWNER, STAFF_ROLE, CUSTOM]).list();
    expect(items.map((r) => [r.id, r.nameCustomized])).toEqual([
      ["rol_owner", false],
      ["rol_staff", true],
      ["rol_c", true],
    ]);
  });

  it("★ viewerCanAssign / assignBlockedReason ABSENT for a viewer without manage_members", async () => {
    const { items } = await serviceOver([OWNER, ADMIN], ["manage_roles", "manage_orders"]).list();
    for (const row of items) {
      expect(Object.keys(row)).not.toContain("viewerCanAssign");
      expect(Object.keys(row)).not.toContain("assignBlockedReason");
    }
  });

  it("★ Admin viewer: Owner = owner_only · equal Admin = allowed · wider role = exceeds", async () => {
    const wider: FakeRole = { ...CUSTOM, capabilities: ["manage_members", "manage_billing"] };
    const { items } = await serviceOver([OWNER, ADMIN, wider], ADMIN.capabilities).list();
    expect(items.map((r) => [r.id, r.viewerCanAssign, r.assignBlockedReason])).toEqual([
      ["rol_owner", false, "owner_only"],
      ["rol_admin", true, null],
      ["rol_c", false, "exceeds_your_permissions"],
    ]);
    // The reason never names the missing capability (AC-6.4).
    expect(JSON.stringify(items)).not.toContain("manage_billing");
  });

  it("Owner viewer may assign every role", async () => {
    const { items } = await serviceOver([OWNER, ADMIN, CUSTOM], OWNER.capabilities).list();
    expect(items.every((r) => r.viewerCanAssign === true && r.assignBlockedReason === null)).toBe(
      true,
    );
  });
});

describe("RolesService.list — live roles only (F-003 · data-model §2.2 · MUT-10)", () => {
  it("★ a soft-deleted role is not offered in the dropdown", async () => {
    const deleted: FakeRole = {
      id: "rol_gone",
      name: "Packer",
      key: null,
      isSystem: false,
      capabilities: ["view_products"],
      deletedAt: new Date("2026-10-01T00:00:00Z"),
    };
    const { items } = await serviceOver([OWNER, ADMIN, deleted]).list();
    expect(items.map((r) => r.id)).toEqual([OWNER.id, ADMIN.id]);
  });
});
