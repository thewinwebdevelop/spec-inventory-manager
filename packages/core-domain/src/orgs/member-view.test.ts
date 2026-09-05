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
    role: { name: "Staff", key: "staff", capabilities: ["view_reports"] },
    user: { email: "somchai@example.com" },
    viewerUserId: "usr_viewer",
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
      source({ role: { name: "Owner", key: "owner", capabilities: ["manage_members"] } }),
    );
    expect(impostor.isOwner).toBe(false);

    const realOwner = toMemberRow(
      source({ role: { name: "ผู้จัดการใหญ่", key: null, capabilities: ["full_access"] } }),
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

  it("does not mutate its input", () => {
    const input = source();
    const snapshot = JSON.stringify(input);
    toMemberRow(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
