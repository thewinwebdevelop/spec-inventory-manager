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
import { RolesService } from "./roles.service";

interface FakeRole {
  id: string;
  name: string;
  key: string | null;
  isSystem: boolean;
  capabilities: string[];
}

function serviceOver(roles: FakeRole[]): RolesService {
  const prisma = {
    role: { findMany: async () => roles },
  };
  return new RolesService(prisma as never);
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
    return serviceOver([OWNER, ADMIN]).list().then(({ items }) => {
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
    ]);
    expect(JSON.stringify(items[0])).not.toContain("full_access");
  });

  it("keeps the F-002 pagination shape", async () => {
    const { nextCursor } = await serviceOver([OWNER]).list();
    expect(nextCursor).toBeNull();
  });
});
