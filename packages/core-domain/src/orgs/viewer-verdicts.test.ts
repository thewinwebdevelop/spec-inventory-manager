// F-003 · T-003-B22 ★ — the viewer verdicts on shipped routes (api-spec §3.1,
// §4.1–§4.2b · architecture §1.2). Every verdict must be the SAME decision the
// write route makes — never a second copy of the rule — so each block below
// compares the verdict against `decideMemberAuthority` called the way the write
// calls it, over every pair of a fixture set (non-vacuity counted).
import { describe, it, expect } from "vitest";
import { decideMemberAuthority } from "../rbac/member-authority";
import { decideAdminResetVisible } from "./admin-reset-authz";
import {
  decideInvitationManageVisible,
  decideMemberManageVisible,
  decideRoleAssignVisible,
  isRoleNameCustomized,
  viewerVerdictAudience,
} from "./viewer-verdicts";

const OWNER = ["full_access"];
const ADMIN = ["manage_members", "manage_org_settings", "manage_products", "manage_roles"];
const MM = ["manage_members", "manage_products"];
const MR = ["manage_roles", "manage_orders", "manage_products"];
const STAFF = ["manage_products", "manage_stock", "manage_orders"];

/** Small fixture: equal / superset / subset / incomparable pairs all occur. */
const SETS: readonly (readonly string[])[] = [
  OWNER,
  ADMIN,
  MM,
  MR,
  STAFF,
  ["manage_members"],
  ["manage_members", "manage_orders"],
  ["manage_members", "manage_roles"],
  ["manage_members", "manage_roles", "manage_products", "manage_orders"],
  ["manage_products"],
  ["manage_orders"],
  ["full_access", "manage_members"],
];
const MANAGERS = SETS.filter((s) => viewerVerdictAudience(s).assign);

describe("isRoleNameCustomized — api-spec §4.1 (`key === null || Role.nameCustomized`)", () => {
  it("custom role (key null) is always customized", () => {
    expect(isRoleNameCustomized({ key: null, nameCustomized: false })).toBe(true);
    expect(isRoleNameCustomized({ key: null, nameCustomized: true })).toBe(true);
  });
  it("system role: only when the shop renamed it", () => {
    expect(isRoleNameCustomized({ key: "staff", nameCustomized: false })).toBe(false);
    expect(isRoleNameCustomized({ key: "staff", nameCustomized: true })).toBe(true);
  });
});

describe("viewerVerdictAudience — who sees which verdict (architecture §1.2 · AC-6.4)", () => {
  it("manage_members only: role assign + invitation verdicts, NOT member-row verdicts", () => {
    expect(viewerVerdictAudience(MM)).toEqual({
      assign: true,
      memberRows: false,
      invitations: true,
    });
  });
  it("manage_members ∧ manage_roles: everything", () => {
    expect(viewerVerdictAudience(ADMIN)).toEqual({
      assign: true,
      memberRows: true,
      invitations: true,
    });
  });
  it("Owner (full_access, through expansion): everything", () => {
    expect(viewerVerdictAudience(OWNER)).toEqual({
      assign: true,
      memberRows: true,
      invitations: true,
    });
  });
  it("manage_roles without manage_members: nothing (the routes are manage_members-gated)", () => {
    expect(viewerVerdictAudience(MR)).toEqual({
      assign: false,
      memberRows: false,
      invitations: false,
    });
  });
  it("Staff: nothing", () => {
    expect(viewerVerdictAudience(STAFF)).toEqual({
      assign: false,
      memberRows: false,
      invitations: false,
    });
  });
});

describe("decideRoleAssignVisible — RoleRow.viewerCanAssign (grant axis, AC-2.2)", () => {
  it("equals the invite create / reissue / PATCH-grant decision for every viewer × role", () => {
    let pairs = 0;
    let refused = 0;
    for (const viewer of MANAGERS) {
      for (const role of SETS) {
        const verdict = decideRoleAssignVisible(viewer, role);
        for (const op of ["invite_create", "invite_reissue"] as const) {
          const write = decideMemberAuthority({
            op,
            actorCapabilities: viewer,
            actorIsTarget: false,
            grantCapabilities: role,
          });
          expect(verdict.allowed).toBe(write.ok);
        }
        pairs++;
        if (!verdict.allowed) refused++;
      }
    }
    expect(pairs).toBeGreaterThan(50);
    expect(refused).toBeGreaterThan(10);
  });

  it("reasons: owner_only → exceeds_your_permissions · null when allowed", () => {
    expect(decideRoleAssignVisible(ADMIN, OWNER)).toEqual({ allowed: false, reason: "owner_only" });
    expect(decideRoleAssignVisible(MM, ADMIN)).toEqual({
      allowed: false,
      reason: "exceeds_your_permissions",
    });
    expect(decideRoleAssignVisible(ADMIN, ADMIN)).toEqual({ allowed: true, reason: null });
    expect(decideRoleAssignVisible(OWNER, OWNER)).toEqual({ allowed: true, reason: null });
  });

  it("fails loud for a viewer outside the audience — never invents a reason", () => {
    expect(() => decideRoleAssignVisible(STAFF, STAFF)).toThrow(/manage_members/);
  });
});

describe("decideInvitationManageVisible — Invitation.viewerCanManage (invite_cancel, ⊆)", () => {
  it("equals the cancel AND reissue decision for every viewer × invitation role", () => {
    let pairs = 0;
    for (const viewer of MANAGERS) {
      for (const role of SETS) {
        const verdict = decideInvitationManageVisible(viewer, role);
        for (const op of ["invite_cancel", "invite_reissue"] as const) {
          const write = decideMemberAuthority({
            op,
            actorCapabilities: viewer,
            actorIsTarget: false,
            grantCapabilities: role,
          });
          expect(verdict.allowed).toBe(write.ok);
        }
        pairs++;
      }
    }
    expect(pairs).toBeGreaterThan(50);
  });

  it("Admin may cancel an equal Admin invitation (⊆ not ⊊) but not an Owner one", () => {
    expect(decideInvitationManageVisible(ADMIN, ADMIN)).toEqual({ allowed: true, reason: null });
    expect(decideInvitationManageVisible(ADMIN, OWNER)).toEqual({
      allowed: false,
      reason: "owner_only",
    });
    expect(decideInvitationManageVisible(MM, ADMIN)).toEqual({
      allowed: false,
      reason: "exceeds_your_permissions",
    });
  });

  it("fails loud for a viewer without manage_members", () => {
    expect(() => decideInvitationManageVisible(MR, STAFF)).toThrow(/manage_members/);
  });
});

describe("decideMemberManageVisible — MemberRow.viewerCanManage (target axis, api §3.1(3))", () => {
  it("equals BOTH the PATCH-to-current-role and the DELETE decision, every viewer × row × self", () => {
    let triples = 0;
    let equal = 0;
    for (const viewer of SETS.filter((s) => viewerVerdictAudience(s).memberRows)) {
      for (const row of SETS) {
        for (const self of [false, true]) {
          if (self && row !== viewer) continue;
          const verdict = decideMemberManageVisible(
            { userId: "v", capabilities: viewer },
            { userId: self ? "v" : "t", capabilities: row },
          );
          const remove = decideMemberAuthority({
            op: "remove",
            actorCapabilities: viewer,
            actorIsTarget: self,
            targetCurrentCapabilities: row,
          });
          const patchNoop = decideMemberAuthority({
            op: "change_role",
            actorCapabilities: viewer,
            actorIsTarget: self,
            targetCurrentCapabilities: row,
            grantCapabilities: row,
          });
          expect(verdict.ok).toBe(remove.ok);
          expect(verdict.ok).toBe(patchNoop.ok);
          if (!verdict.ok && verdict.reason === "equal_permissions") equal++;
          triples++;
        }
      }
    }
    expect(triples).toBeGreaterThan(30);
    expect(equal).toBeGreaterThan(0);
  });

  it("reason order: owner_only → equal_permissions → exceeds_your_permissions", () => {
    const v = { userId: "v", capabilities: ADMIN };
    expect(decideMemberManageVisible(v, { userId: "t", capabilities: OWNER })).toEqual({
      ok: false,
      reason: "owner_only",
    });
    expect(decideMemberManageVisible(v, { userId: "t", capabilities: [...ADMIN] })).toEqual({
      ok: false,
      reason: "equal_permissions",
    });
    expect(
      decideMemberManageVisible(v, { userId: "t", capabilities: [...ADMIN, "manage_orders"] }),
    ).toEqual({ ok: false, reason: "exceeds_your_permissions" });
    expect(decideMemberManageVisible(v, { userId: "t", capabilities: ["manage_orders"] })).toEqual({
      ok: false,
      reason: "exceeds_your_permissions",
    });
    expect(decideMemberManageVisible(v, { userId: "t", capabilities: STAFF.slice(0, 1) })).toEqual({
      ok: true,
    });
  });

  it("own row: true (target axis self-exempt) — while reset says `self`", () => {
    const me = { userId: "v", capabilities: ADMIN };
    expect(decideMemberManageVisible(me, { userId: "v", capabilities: ADMIN })).toEqual({
      ok: true,
    });
    expect(decideAdminResetVisible(me, { userId: "v", capabilities: ADMIN })).toEqual({
      ok: false,
      reason: "self",
    });
  });

  it("fails loud for a viewer without manage_members", () => {
    expect(() =>
      decideMemberManageVisible(
        { userId: "v", capabilities: MR },
        { userId: "t", capabilities: [] },
      ),
    ).toThrow(/manage_members/);
  });
});
