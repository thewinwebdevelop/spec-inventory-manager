// T-003-W10 ★ — CW3-03 / R3-06: the row's actions follow the SERVER's verdict,
// in both directions, and fall back to F-002 only when the field is absent.
//
// "Both directions" is the lesson from client-invented server facts: a guard
// that only ever HIDES is still the client deciding. So every case below pairs
// a verdict with the local capability picture that would have said the
// opposite, and asserts the verdict won.
import { describe, it, expect } from "vitest";
import {
  invitationActionsFor,
  memberActionsFor,
  reinviteRoleIdFor,
  CAPABILITY_FULL_ACCESS,
} from "./member-actions";

const owner = new Set([CAPABILITY_FULL_ACCESS]);
const admin = new Set(["manage_members", "manage_roles"]);

function row(over: Partial<Parameters<typeof memberActionsFor>[0]> = {}) {
  return memberActionsFor({
    myCapabilities: admin,
    targetIsOwner: false,
    isSelf: false,
    targetStatus: "active",
    ...over,
  });
}

describe("memberActionsFor — R7 server verdict", () => {
  it("★ verdict=false beats local caps that say yes (Owner caps, ordinary target)", () => {
    const a = row({
      myCapabilities: owner,
      verdict: { viewerCanManage: false, manageBlockedReason: "equal_permissions" },
    });
    expect(a).toMatchObject({ changeRole: false, removeFromOrg: false, leaveOrg: false });
    expect(a.ownerOnlyNotice).toBe(false);
    expect(a.serverBlock).toEqual({ reason: "equal_permissions" });
  });

  it("★ verdict=true beats local caps that say no (Admin caps, target flagged Owner)", () => {
    const a = row({
      myCapabilities: admin,
      targetIsOwner: true,
      verdict: { viewerCanManage: true, manageBlockedReason: null },
    });
    expect(a).toMatchObject({ changeRole: true, removeFromOrg: true, leaveOrg: false });
    expect(a.ownerOnlyNotice).toBe(false);
    expect(a.serverBlock).toBeNull();
  });

  it("★ AC-5.4b / B17 L-5 — Admin looking at another Admin: no change, no remove", () => {
    const a = row({
      myCapabilities: admin,
      verdict: { viewerCanManage: false, manageBlockedReason: "equal_permissions" },
    });
    expect(a.changeRole).toBe(false);
    expect(a.removeFromOrg).toBe(false);
  });

  it.each([
    "owner_only",
    "equal_permissions",
    "exceeds_your_permissions",
    "reason_from_the_future",
  ])("passes reason %s through untouched (copy is the screen's job, open set)", (reason) => {
    const a = row({ verdict: { viewerCanManage: false, manageBlockedReason: reason } });
    expect(a.serverBlock).toEqual({ reason });
  });

  it("verdict=false with no reason still blocks (reason null → generic copy downstream)", () => {
    const a = row({ verdict: { viewerCanManage: false } });
    expect(a.changeRole).toBe(false);
    expect(a.serverBlock).toEqual({ reason: null });
  });

  it("own row with verdict=true: change role + leave, never remove (D-029)", () => {
    const a = row({ isSelf: true, verdict: { viewerCanManage: true, manageBlockedReason: null } });
    expect(a).toMatchObject({ changeRole: true, removeFromOrg: false, leaveOrg: true });
  });

  it("own row with verdict=false: leaving stays available (D-029 is not a manage verdict)", () => {
    const a = row({ isSelf: true, verdict: { viewerCanManage: false, manageBlockedReason: "x" } });
    expect(a).toMatchObject({ changeRole: false, removeFromOrg: false, leaveOrg: true });
  });

  it("a non-active row has no actions even if a verdict were present", () => {
    const a = row({ targetStatus: "revoked", verdict: { viewerCanManage: true } });
    expect(a).toMatchObject({ changeRole: false, removeFromOrg: false, leaveOrg: false });
    expect(a.serverBlock).toBeNull();
  });

  it("★ field absent → F-002 behaviour (api-spec §3.1: viewer without manage_roles / old server)", () => {
    expect(row({ verdict: {} })).toMatchObject({ changeRole: true, removeFromOrg: true });
    const onOwner = row({ verdict: {}, targetIsOwner: true });
    expect(onOwner).toMatchObject({ changeRole: false, ownerOnlyNotice: true, serverBlock: null });
  });
});

describe("invitationActionsFor — R7 + api-spec amendment 2026-10-25", () => {
  it("pending + verdict=true → reissue and cancel", () => {
    expect(invitationActionsFor({ status: "pending", viewerCanManage: true })).toEqual({
      reissue: true,
      cancel: true,
      inviteAgain: false,
      serverBlock: null,
    });
  });

  it("★ pending + verdict=false → neither, plus the reason", () => {
    expect(
      invitationActionsFor({
        status: "pending",
        viewerCanManage: false,
        manageBlockedReason: "owner_only",
      }),
    ).toEqual({
      reissue: false,
      cancel: false,
      inviteAgain: false,
      serverBlock: { reason: "owner_only" },
    });
  });

  it("★ expired + verdict=true → cancel and invite-again, but NEVER reissue (route 409s)", () => {
    expect(invitationActionsFor({ status: "expired", viewerCanManage: true })).toEqual({
      reissue: false,
      cancel: true,
      inviteAgain: true,
      serverBlock: null,
    });
  });

  it("expired + verdict=false → invite-again only, plus the reason", () => {
    expect(
      invitationActionsFor({
        status: "expired",
        viewerCanManage: false,
        manageBlockedReason: "exceeds_your_permissions",
      }),
    ).toEqual({
      reissue: false,
      cancel: false,
      inviteAgain: true,
      serverBlock: { reason: "exceeds_your_permissions" },
    });
  });

  it("field absent → F-002: pending offers both; expired offers invite-again only", () => {
    expect(invitationActionsFor({ status: "pending" })).toMatchObject({
      reissue: true,
      cancel: true,
    });
    expect(invitationActionsFor({ status: "expired" })).toEqual({
      reissue: false,
      cancel: false,
      inviteAgain: true,
      serverBlock: null,
    });
  });

  it("cancelled → invite-again · accepted / unknown status → nothing", () => {
    expect(invitationActionsFor({ status: "cancelled" }).inviteAgain).toBe(true);
    for (const status of ["accepted", "status_from_the_future"]) {
      expect(invitationActionsFor({ status })).toEqual({
        reissue: false,
        cancel: false,
        inviteAgain: false,
        serverBlock: null,
      });
    }
  });
});

describe("reinviteRoleIdFor — R7 'เชิญใหม่อีกครั้ง' pre-fill", () => {
  const roles = [
    { id: "rol_a", viewerCanAssign: true },
    { id: "rol_b", viewerCanAssign: false },
    { id: "rol_c" },
  ];

  it("★ viewerCanAssign=true pre-fills even when the local fallback would refuse", () => {
    expect(reinviteRoleIdFor("rol_a", roles, () => false)).toBe("rol_a");
  });

  it("★ viewerCanAssign=false never pre-fills even when the local fallback would allow", () => {
    expect(reinviteRoleIdFor("rol_b", roles, () => true)).toBeUndefined();
  });

  it("field absent (or role not in the list) → the F-002 fallback decides", () => {
    expect(reinviteRoleIdFor("rol_c", roles, () => true)).toBe("rol_c");
    expect(reinviteRoleIdFor("rol_c", roles, () => false)).toBeUndefined();
    expect(reinviteRoleIdFor("rol_gone", roles, () => true)).toBe("rol_gone");
  });
});
