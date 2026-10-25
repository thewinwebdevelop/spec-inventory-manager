// F-003 · T-003-B21 ★ — what the role READ routes publish about a role
// (api-spec §3 · §3 "ลำดับ reason" · AC-6.4 · AC-7.4 · AC-9.6).
//
// Expectations are written from api-spec §3 by hand. The decider is the REAL
// `decideRoleWrite` unless a test injects a spy to prove what is asked of it.
import { describe, it, expect, vi } from "vitest";
import {
  capabilityCatalog,
  lastEditedBy,
  roleDetailViewer,
  roleListViewer,
  wireNameCustomized,
  type RoleDetailViewerInput,
} from "./role-view";
import { CAPABILITY_REGISTRY } from "./registry";
import { decideRoleWrite } from "./role-write";

const ADMIN = [
  "manage_channels",
  "manage_members",
  "manage_orders",
  "manage_org_settings",
  "manage_products",
  "manage_roles",
  "manage_stock",
  "view_financials",
];
const MR = ["manage_orders", "manage_products", "manage_roles"];
const OWNER_ROLE = { isSystem: true, capabilities: ["full_access"] };

function input(over: Partial<RoleDetailViewerInput> = {}): RoleDetailViewerInput {
  return {
    writesEnabled: true,
    actorCapabilities: ADMIN,
    role: { isSystem: false, capabilities: ["manage_orders"] },
    otherActiveHolders: 0,
    usage: { activeMembers: 0, pendingInvitations: 0 },
    liveRoleCount: 5,
    maxRoles: 30,
    deletedRoleCount: 0,
    maxDeletedRoles: 500,
    ...over,
  };
}
const ok = { allowed: true, reason: null };
const no = (reason: string) => ({ allowed: false, reason });

describe("roleDetailViewer — canEdit / canDelete / canClone (api-spec §3)", () => {
  it("a free role below the viewer: everything allowed", () => {
    expect(roleDetailViewer(input())).toEqual({ canEdit: ok, canDelete: ok, canClone: ok });
  });

  it("Owner role: role_locked ×2 and owner_role on clone — the Owner viewer included (AC-4.1)", () => {
    for (const actor of [ADMIN, ["full_access"]]) {
      expect(roleDetailViewer(input({ actorCapabilities: actor, role: OWNER_ROLE }))).toEqual({
        canEdit: no("role_locked"),
        canDelete: no("role_locked"),
        canClone: no("owner_role"),
      });
    }
  });

  it("role above the viewer: exceeds_your_permissions on all three", () => {
    const v = roleDetailViewer(
      input({ role: { isSystem: false, capabilities: ["manage_billing", "manage_orders"] } }),
    );
    expect(v).toEqual({
      canEdit: no("exceeds_your_permissions"),
      canDelete: no("exceeds_your_permissions"),
      canClone: no("exceeds_your_permissions"),
    });
  });

  it("held by someone else, viewer lacks manage_members: in_use_requires_manage_members — clone unaffected", () => {
    const v = roleDetailViewer(
      input({
        actorCapabilities: MR,
        otherActiveHolders: 1,
        usage: { activeMembers: 1, pendingInvitations: 0 },
      }),
    );
    expect(v).toEqual({
      canEdit: no("in_use_requires_manage_members"),
      canDelete: no("in_use_requires_manage_members"),
      canClone: ok,
    });
  });

  it("equal to the viewer and held by someone else: equal_permissions_in_use — clone allowed", () => {
    const v = roleDetailViewer(
      input({
        role: { isSystem: false, capabilities: ADMIN },
        otherActiveHolders: 1,
        usage: { activeMembers: 2, pendingInvitations: 0 },
      }),
    );
    expect(v).toEqual({
      canEdit: no("equal_permissions_in_use"),
      canDelete: no("equal_permissions_in_use"),
      canClone: ok,
    });
  });

  it("equal to the viewer but held by NOBODY else (the viewer's own role): edit ok, delete in_use", () => {
    const v = roleDetailViewer(
      input({
        role: { isSystem: false, capabilities: ADMIN },
        otherActiveHolders: 0,
        usage: { activeMembers: 1, pendingInvitations: 0 },
      }),
    );
    expect(v.canEdit).toEqual(ok);
    expect(v.canDelete).toEqual(no("in_use"));
  });

  it("in_use counts pending invitations too (expired included — AC-3.9)", () => {
    const v = roleDetailViewer(input({ usage: { activeMembers: 0, pendingInvitations: 1 } }));
    expect(v.canDelete).toEqual(no("in_use"));
    expect(v.canEdit).toEqual(ok);
  });

  it("history_limit_reached comes after in_use, at the cap (≥)", () => {
    expect(roleDetailViewer(input({ deletedRoleCount: 500 })).canDelete).toEqual(
      no("history_limit_reached"),
    );
    expect(roleDetailViewer(input({ deletedRoleCount: 499 })).canDelete).toEqual(ok);
    expect(
      roleDetailViewer(
        input({ deletedRoleCount: 500, usage: { activeMembers: 1, pendingInvitations: 0 } }),
      ).canDelete,
    ).toEqual(no("in_use"));
  });

  it("role_limit_reached on clone at the live ceiling (≥) — after exceeds", () => {
    expect(roleDetailViewer(input({ liveRoleCount: 30 })).canClone).toEqual(
      no("role_limit_reached"),
    );
    expect(roleDetailViewer(input({ liveRoleCount: 29 })).canClone).toEqual(ok);
    expect(
      roleDetailViewer(
        input({
          liveRoleCount: 30,
          role: { isSystem: false, capabilities: ["manage_billing"] },
        }),
      ).canClone,
    ).toEqual(no("exceeds_your_permissions"));
  });

  it("★ writes_disabled outranks every other reason, on every verdict", () => {
    for (const over of [
      {},
      { role: OWNER_ROLE },
      { role: { isSystem: false, capabilities: ["manage_billing"] } },
      { usage: { activeMembers: 3, pendingInvitations: 3 }, otherActiveHolders: 3 },
      { liveRoleCount: 30, deletedRoleCount: 500 },
    ]) {
      expect(roleDetailViewer(input({ writesEnabled: false, ...over }))).toEqual({
        canEdit: no("writes_disabled"),
        canDelete: no("writes_disabled"),
        canClone: no("writes_disabled"),
      });
    }
  });

  it("asks the decider with the role's OWN caps ('unchanged') and the other-holder count — never a forged next", () => {
    const decide = vi.fn(decideRoleWrite);
    roleDetailViewer(input({ otherActiveHolders: 2 }), decide);
    const ops = decide.mock.calls.map(([i]) => i);
    expect(ops).toEqual([
      expect.objectContaining({ op: "update", next: "unchanged", otherActiveHolders: 2 }),
      expect.objectContaining({ op: "delete", otherActiveHolders: 2 }),
      // clone = "source ⊆ me": same question with nobody holding the new role
      expect.objectContaining({ op: "update", next: "unchanged", otherActiveHolders: 0 }),
    ]);
  });

  it("fails loud when the decider says the viewer lacks manage_roles (route guard bypassed)", () => {
    expect(() => roleDetailViewer(input({ actorCapabilities: ["manage_orders"] }))).toThrow(
      /manage_roles/,
    );
  });

  it("refuses a negative / non-integer count instead of guessing", () => {
    expect(() => roleDetailViewer(input({ liveRoleCount: -1 }))).toThrow();
    expect(() =>
      roleDetailViewer(input({ usage: { activeMembers: 0.5, pendingInvitations: 0 } })),
    ).toThrow();
  });
});

describe("roleListViewer — canCreate + limit", () => {
  it("below the ceiling: allowed · at it: role_limit_reached · flag off: writes_disabled first", () => {
    expect(roleListViewer({ writesEnabled: true, liveRoleCount: 29, maxRoles: 30 })).toEqual({
      canCreate: ok,
      limit: 30,
    });
    expect(roleListViewer({ writesEnabled: true, liveRoleCount: 30, maxRoles: 30 })).toEqual({
      canCreate: no("role_limit_reached"),
      limit: 30,
    });
    expect(roleListViewer({ writesEnabled: false, liveRoleCount: 30, maxRoles: 30 })).toEqual({
      canCreate: no("writes_disabled"),
      limit: 30,
    });
  });
});

describe("capabilityCatalog (AC-7.1 · AC-7.4 · D-037)", () => {
  const catalog = capabilityCatalog();

  it("hides every tier-`full` entry entirely, and publishes neither tier nor scope", () => {
    const hidden = CAPABILITY_REGISTRY.filter((c) => c.tier === "full").map((c) => c.key);
    expect(hidden).toContain("access_accounting"); // non-vacuity
    const keys = catalog.items.map((i) => i.key);
    for (const k of hidden) expect(keys).not.toContain(k);
    expect(keys).toEqual(CAPABILITY_REGISTRY.filter((c) => c.tier !== "full").map((c) => c.key));
    for (const item of catalog.items) {
      expect(Object.keys(item).sort()).toEqual(
        ["descriptionTh", "group", "implies", "key", "labelTh", "selectable", "status"].sort(),
      );
    }
  });

  it("full_access is present, selectable=false, group=null", () => {
    expect(catalog.items.find((i) => i.key === "full_access")).toMatchObject({
      selectable: false,
      group: null,
    });
  });

  it("copy comes from the registry verbatim, groups in display order", () => {
    const reg = CAPABILITY_REGISTRY.find((c) => c.key === "manage_roles")!;
    expect(catalog.items.find((i) => i.key === "manage_roles")).toMatchObject({
      labelTh: reg.labelTh,
      descriptionTh: reg.descriptionTh,
      status: "live",
    });
    expect(catalog.groups.map((g) => g.key)).toEqual([
      "team",
      "shop",
      "catalog_stock",
      "channels",
      "orders",
      "finance",
    ]);
  });

  it("returns fresh arrays — a caller mutating the response cannot reach the registry", () => {
    const a = capabilityCatalog();
    (a.items[0]!.implies as string[]).push("x");
    expect(capabilityCatalog().items[0]!.implies).toEqual([]);
  });
});

describe("lastEditedBy (AC-9.6 · SR-09)", () => {
  const role = { name: "R_T-A", key: null, nameCustomized: false };

  it("never edited ⇒ null", () => {
    expect(lastEditedBy({ editorUserId: null, viewerUserId: "u1", editorMembership: null })).toBe(
      null,
    );
  });

  it("the viewer ⇒ me (no role fields)", () => {
    expect(
      lastEditedBy({ editorUserId: "u1", viewerUserId: "u1", editorMembership: { role } }),
    ).toEqual({ kind: "me" });
  });

  it("an active member of this shop ⇒ member + their CURRENT role, display rule applied", () => {
    expect(
      lastEditedBy({ editorUserId: "u2", viewerUserId: "u1", editorMembership: { role } }),
    ).toEqual({ kind: "member", roleName: "R_T-A", roleKey: null, roleNameCustomized: true });
    expect(
      lastEditedBy({
        editorUserId: "u2",
        viewerUserId: "u1",
        editorMembership: { role: { name: "Staff", key: "staff", nameCustomized: false } },
      }),
    ).toEqual({ kind: "member", roleName: "Staff", roleKey: "staff", roleNameCustomized: false });
  });

  it("no active membership here ⇒ former_member, with no role fields at all", () => {
    expect(
      lastEditedBy({ editorUserId: "u2", viewerUserId: "u1", editorMembership: null }),
    ).toEqual({ kind: "former_member" });
  });
});

describe("wireNameCustomized (data-model §1 AC-1.5)", () => {
  it("key null ⇒ always true · system key ⇒ the column", () => {
    expect(wireNameCustomized({ key: null, nameCustomized: false })).toBe(true);
    expect(wireNameCustomized({ key: "admin", nameCustomized: false })).toBe(false);
    expect(wireNameCustomized({ key: "admin", nameCustomized: true })).toBe(true);
  });
});
