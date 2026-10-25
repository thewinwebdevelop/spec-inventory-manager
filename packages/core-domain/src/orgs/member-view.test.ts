// F-002 · T-002-18 — `toMemberRow` (api-spec §3.7). D-014: the test lands with
// the code.
import { describe, it, expect } from "vitest";
import { toMemberRow, type MemberRowSource } from "./member-view";

const CREATED = new Date("2026-07-01T03:04:05.000Z");
const ACTIVATED = new Date("2026-07-02T00:00:00.000Z");

function source(overrides: Partial<MemberRowSource> = {}): MemberRowSource {
  return {
    membership: {
      userId: "usr_target",
      roleId: "rol_staff",
      status: "active",
      activatedAt: ACTIVATED,
      revokedAt: null,
      createdAt: CREATED,
    },
    role: { name: "Staff", key: "staff", capabilities: ["view_reports"], nameCustomized: false },
    user: { email: "somchai@example.com" },
    viewerUserId: "usr_viewer",
    viewerCapabilities: [],
    ...overrides,
  };
}

describe("toMemberRow — the §3.7 row", () => {
  it("projects every documented field, with ISO-8601 dates", () => {
    expect(toMemberRow(source())).toEqual({
      userId: "usr_target",
      email: "somchai@example.com",
      roleId: "rol_staff",
      roleName: "Staff",
      roleKey: "staff",
      status: "active",
      activatedAt: "2026-07-02T00:00:00.000Z",
      revokedAt: null,
      createdAt: "2026-07-01T03:04:05.000Z",
      isMe: false,
      isOwner: false,
      roleNameCustomized: false,
    });
  });

  it("emits NOTHING beyond the documented keys", () => {
    // The row carries another person's email; a widened projection is a PDPA
    // incident, not a formatting change.
    expect(Object.keys(toMemberRow(source())).sort()).toEqual(
      [
        "activatedAt",
        "createdAt",
        "email",
        "isMe",
        "isOwner",
        "roleId",
        "roleKey",
        "roleName",
        "roleNameCustomized",
        "revokedAt",
        "status",
        "userId",
      ].sort(),
    );
  });

  it("★ isOwner is decided by `full_access`, never by the role name or key", () => {
    // I-45's fixture, exactly: a role NAMED/KEYED like the owner but without the
    // capability, and a custom role that holds it under a different name.
    const impostor = toMemberRow(
      source({
        role: {
          name: "Owner",
          key: "owner",
          capabilities: ["manage_members"],
          nameCustomized: false,
        },
      }),
    );
    expect(impostor.isOwner).toBe(false);

    const realOwner = toMemberRow(
      source({
        role: {
          name: "ผู้จัดการใหญ่",
          key: null,
          capabilities: ["full_access"],
          nameCustomized: false,
        },
      }),
    );
    expect(realOwner.isOwner).toBe(true);
    expect(realOwner.roleKey).toBeNull();
  });

  it("isMe compares the row's user to the CALLER", () => {
    expect(toMemberRow(source({ viewerUserId: "usr_target" })).isMe).toBe(true);
    expect(toMemberRow(source({ viewerUserId: "usr_other" })).isMe).toBe(false);
  });

  it("keeps a revoked row readable (?status=revoked|all)", () => {
    const revokedAt = new Date("2026-07-10T09:00:00.000Z");
    const row = toMemberRow(
      source({
        membership: {
          userId: "usr_target",
          roleId: "rol_staff",
          status: "revoked",
          activatedAt: ACTIVATED,
          revokedAt,
          createdAt: CREATED,
        },
      }),
    );
    expect(row.status).toBe("revoked");
    expect(row.revokedAt).toBe("2026-07-10T09:00:00.000Z");
  });

  it("F-003 roleNameCustomized: custom role (key null) or a renamed system role", () => {
    const role = (key: string | null, nameCustomized: boolean) =>
      toMemberRow(source({ role: { name: "x", key, capabilities: [], nameCustomized } }));
    expect(role("staff", false).roleNameCustomized).toBe(false);
    expect(role("staff", true).roleNameCustomized).toBe(true);
    expect(role(null, false).roleNameCustomized).toBe(true);
  });

  it("does not mutate its input", () => {
    const input = source();
    const snapshot = JSON.stringify(input);
    toMemberRow(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

// F-003 · T-003-B22 ★ — who sees the verdict, and that it is the write's rule
// (api-spec §3.1(3) · architecture §1.2).
describe("toMemberRow — F-003 viewer verdicts", () => {
  const ADMIN = ["manage_members", "manage_products", "manage_roles"];
  const MM_ONLY = ["manage_members", "manage_products"];
  const VERDICT_KEYS = [
    "manageBlockedReason",
    "resetBlockedReason",
    "viewerCanManage",
    "viewerCanResetPassword",
  ];
  const row = (viewerCapabilities: readonly string[], over: Partial<MemberRowSource> = {}) =>
    toMemberRow(source({ viewerCapabilities, ...over }));

  it("★ manage_members WITHOUT manage_roles: verdict keys ABSENT (no ⊆∧¬⊊ oracle)", () => {
    const keys = Object.keys(row(MM_ONLY));
    expect(keys).toContain("roleNameCustomized");
    for (const k of VERDICT_KEYS) expect(keys).not.toContain(k);
  });

  it("manage_members ∧ manage_roles: all four keys, below-me row = allowed", () => {
    const r = row(ADMIN, {
      role: { name: "s", key: "staff", capabilities: ["manage_products"], nameCustomized: false },
    });
    expect(r).toMatchObject({
      viewerCanManage: true,
      manageBlockedReason: null,
      viewerCanResetPassword: true,
      resetBlockedReason: null,
    });
  });

  it("equal role → equal_permissions on both; Owner row → owner_only on both", () => {
    const equal = row(ADMIN, {
      role: { name: "a", key: "admin", capabilities: [...ADMIN], nameCustomized: false },
    });
    expect(equal).toMatchObject({
      viewerCanManage: false,
      manageBlockedReason: "equal_permissions",
      viewerCanResetPassword: false,
      resetBlockedReason: "equal_permissions",
    });
    const owner = row(ADMIN, {
      role: { name: "o", key: "owner", capabilities: ["full_access"], nameCustomized: false },
    });
    expect(owner).toMatchObject({
      manageBlockedReason: "owner_only",
      resetBlockedReason: "owner_only",
    });
  });

  it("own row: manage allowed (self-exempt) but reset = self", () => {
    const me = row(ADMIN, {
      viewerUserId: "usr_target",
      role: { name: "a", key: "admin", capabilities: [...ADMIN], nameCustomized: false },
    });
    expect(me).toMatchObject({
      isMe: true,
      viewerCanManage: true,
      manageBlockedReason: null,
      viewerCanResetPassword: false,
      resetBlockedReason: "self",
    });
  });

  it("revoked row: no verdict even for the full audience", () => {
    const revoked = row(ADMIN, {
      membership: {
        userId: "usr_target",
        roleId: "rol_staff",
        status: "revoked",
        activatedAt: ACTIVATED,
        revokedAt: new Date("2026-07-10T00:00:00.000Z"),
        createdAt: CREATED,
      },
    });
    const keys = Object.keys(revoked);
    for (const k of VERDICT_KEYS) expect(keys).not.toContain(k);
  });
});
