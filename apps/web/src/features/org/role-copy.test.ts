/**
 * T-003-W03 — reason→copy กลาง + กติกาแสดงผล §0.2 (ux-wireframe §0.2, §0.3, §E).
 *
 * Every table row in ux §0.3 gets an assertion, plus the "ค่าที่ไม่รู้จัก"
 * fallback row for each lookup (non-vacuity — a reason the server has never
 * sent yet must still render something safe, never a blank banner or a raw
 * key).
 */
import { describe, it, expect } from "vitest";
import {
  assignBlockedReasonCopy,
  bannerReasonCopy,
  createOrCloneBlockedReasonCopy,
  deleteBlockedReasonCopy,
  displayRoleName,
  invitationManageBlockedReasonCopy,
  lastEditedLine,
  memberActionErrorMessage,
  memberManageBlockedReasonCopy,
  ROLE_FORBIDDEN_PANEL_COPY,
  roleBadgeLabel,
  roleFormErrorMessage,
  roleNameFieldErrorMessage,
  usageLine,
} from "./role-copy";

describe("§0.2 — displayRoleName", () => {
  it("nameCustomized=true always wins, even for a system role key", () => {
    expect(displayRoleName({ name: "แพ็คของ", roleKey: "staff", nameCustomized: true })).toBe(
      "แพ็คของ",
    );
  });

  it("nameCustomized=false translates a known key", () => {
    expect(displayRoleName({ name: "ผู้ดูแล", roleKey: "admin", nameCustomized: false })).toBe(
      "ผู้ดูแล",
    );
  });

  it("nameCustomized absent (old server) behaves like false — the 'กติกาเดิม'", () => {
    expect(displayRoleName({ name: "ผู้ดูแล", roleKey: "admin" })).toBe("ผู้ดูแล");
  });

  it("unknown roleKey falls back to `name` (a F-003 custom role)", () => {
    expect(
      displayRoleName({ name: "บัญชีภายนอก", roleKey: "custom-1", nameCustomized: false }),
    ).toBe("บัญชีภายนอก");
  });
});

describe("§0.2 — usageLine", () => {
  it("0 members → 'ยังไม่มีสมาชิกใช้', no invite suffix at 0", () => {
    expect(usageLine({ activeMembers: 0, pendingInvitations: 0, isViewerRole: false })).toBe(
      "ยังไม่มีสมาชิกใช้",
    );
  });

  it("counts the viewer's own role with '(รวมคุณ)'", () => {
    expect(usageLine({ activeMembers: 1, pendingInvitations: 0, isViewerRole: true })).toBe(
      "สมาชิก 1 คน (รวมคุณ)",
    );
  });

  it("appends pending invitations only when > 0", () => {
    expect(usageLine({ activeMembers: 3, pendingInvitations: 1, isViewerRole: false })).toBe(
      "สมาชิก 3 คน · คำเชิญที่ยังไม่ปิด 1 ใบ",
    );
  });
});

describe("§0.2 — lastEditedLine", () => {
  const AT = "2026-06-23T07:30:00.000Z"; // 14:30 Asia/Bangkok

  it("null → ค่าเริ่มต้นของระบบ", () => {
    expect(lastEditedLine(null)).toBe("ค่าเริ่มต้นของระบบ");
  });

  it("kind=me", () => {
    expect(lastEditedLine({ kind: "me", at: AT })).toContain("แก้ไขล่าสุดโดยคุณ · ");
  });

  it('kind=member with roleName quotes it: โดยคนในบทบาท "…"', () => {
    const line = lastEditedLine({ kind: "member", at: AT, by: { roleName: "เจ้าของร้าน" } });
    expect(line).toContain('แก้ไขล่าสุดโดยคนในบทบาท "เจ้าของร้าน" · ');
  });

  it("kind=member WITHOUT roleName drops 'โดย' instead of printing an empty name", () => {
    const line = lastEditedLine({ kind: "member", at: AT });
    expect(line.startsWith("แก้ไขล่าสุด · ")).toBe(true);
    expect(line).not.toContain("โดย");
  });

  it("kind=former_member", () => {
    expect(lastEditedLine({ kind: "former_member", at: AT })).toContain(
      "แก้ไขล่าสุดโดยอดีตสมาชิก · ",
    );
  });

  it("★ unknown kind never renders the raw key — same fallback as missing roleName", () => {
    const line = lastEditedLine({ kind: "some_future_kind", at: AT });
    expect(line.startsWith("แก้ไขล่าสุด · ")).toBe(true);
    expect(line).not.toContain("some_future_kind");
  });
});

describe("§0.2 (R1) — roleBadgeLabel", () => {
  it("isSystem wins over everything else", () => {
    expect(
      roleBadgeLabel({
        isSystem: true,
        canEditAllowed: false,
        canEditReason: "exceeds_your_permissions",
      }),
    ).toBe("ล็อก");
  });

  it("read-only role (blocked for an ordinary reason) shows the badge", () => {
    expect(
      roleBadgeLabel({
        isSystem: false,
        canEditAllowed: false,
        canEditReason: "exceeds_your_permissions",
      }),
    ).toBe("ดูได้อย่างเดียว");
  });

  it("writes_disabled is a temporary platform state, not a per-role badge", () => {
    expect(
      roleBadgeLabel({ isSystem: false, canEditAllowed: false, canEditReason: "writes_disabled" }),
    ).toBe(null);
  });

  it("editable role has no badge", () => {
    expect(roleBadgeLabel({ isSystem: false, canEditAllowed: true })).toBe(null);
  });
});

describe("§0.3 (ก) — bannerReasonCopy", () => {
  it.each([
    ["writes_disabled", "ยังสร้างหรือแก้บทบาทไม่ได้ในตอนนี้"],
    ["role_locked", "บทบาทเจ้าของร้านถูกล็อกไว้"],
    ["exceeds_your_permissions", "ดูได้อย่างเดียว — บทบาทนี้มีสิทธิ์ที่คุณไม่มี"],
    ["in_use_requires_manage_members", "ดูได้อย่างเดียว — มีสมาชิกคนอื่นใช้บทบาทนี้อยู่"],
    ["equal_permissions_in_use", "ดูได้อย่างเดียว — มีคนที่สิทธิ์เท่าคุณใช้บทบาทนี้อยู่"],
  ])("%s → title %s", (reason, title) => {
    expect(bannerReasonCopy(reason).title).toBe(title);
  });

  it("★ an unrecognised reason falls back, never a blank banner", () => {
    const copy = bannerReasonCopy("some_future_reason");
    expect(copy.title).toBe("ดูได้อย่างเดียว");
    expect(copy.body).toContain("ติดต่อเจ้าของร้าน");
  });

  it("null/undefined also fall back (never throws)", () => {
    expect(bannerReasonCopy(null).title).toBe("ดูได้อย่างเดียว");
    expect(bannerReasonCopy(undefined).title).toBe("ดูได้อย่างเดียว");
  });
});

describe("§0.3 (ก) — deleteBlockedReasonCopy", () => {
  it("in_use embeds the caller's usage line and names the fix", () => {
    const copy = deleteBlockedReasonCopy("in_use", "สมาชิก 2 คน");
    expect(copy.title).toBe("ลบไม่ได้ตอนนี้ — ยังมีคนใช้บทบาทนี้อยู่");
    expect(copy.body).toBe(
      "สมาชิก 2 คน · ย้ายสมาชิกไปบทบาทอื่นและยกเลิกคำเชิญเหล่านี้ก่อน แล้วค่อยลบ",
    );
  });

  it("history_limit_reached", () => {
    expect(deleteBlockedReasonCopy("history_limit_reached", "").title).toBe("ลบเพิ่มไม่ได้");
  });

  it("★ unrecognised reason falls back", () => {
    expect(deleteBlockedReasonCopy("some_future_reason", "สมาชิก 1 คน").title).toBe(
      "ดูได้อย่างเดียว",
    );
  });
});

describe("§0.3 (ก) — createOrCloneBlockedReasonCopy", () => {
  it("role_limit_reached WITH a limit interpolates it, never hard-codes 30", () => {
    expect(createOrCloneBlockedReasonCopy("role_limit_reached", 30)!.body).toBe(
      "ร้านนี้มีบทบาทครบ 30 บทบาทแล้ว ลบบทบาทที่ไม่ใช้ก่อน จึงจะสร้างใหม่ได้",
    );
  });

  it("role_limit_reached WITHOUT a limit (open R4 directly) uses the generic line", () => {
    expect(createOrCloneBlockedReasonCopy("role_limit_reached")!.body).toBe(
      "ร้านนี้มีบทบาทครบจำนวนสูงสุดแล้ว ลบบทบาทที่ไม่ใช้ก่อน จึงจะสร้างใหม่ได้",
    );
  });

  it("★ owner_role hides the button entirely (AC-3.2) — null, not copy", () => {
    expect(createOrCloneBlockedReasonCopy("owner_role")).toBe(null);
  });

  it("unrecognised reason still returns copy (button stays, disabled)", () => {
    expect(createOrCloneBlockedReasonCopy("some_future_reason")!.title).toBe("ดูได้อย่างเดียว");
  });
});

describe("§0.3 (ข) — assignBlockedReasonCopy (RoleRow.assignBlockedReason)", () => {
  it.each([
    ["owner_only", "เฉพาะเจ้าของร้านเท่านั้นที่ตั้งเจ้าของร้านคนใหม่ได้"],
    ["exceeds_your_permissions", "บทบาทนี้มีสิทธิ์ที่คุณไม่มี จึงมอบให้คนอื่นไม่ได้"],
    ["anything_else", "คุณมอบบทบาทนี้ไม่ได้"],
  ])("%s", (reason, expected) => {
    expect(assignBlockedReasonCopy(reason)).toBe(expected);
  });
});

describe("§0.3 (ข) — memberManageBlockedReasonCopy (MemberRow.manageBlockedReason)", () => {
  it.each([
    ["owner_only", "เฉพาะเจ้าของร้านเท่านั้นที่เปลี่ยนบทบาทหรือถอดเจ้าของร้านคนอื่นได้"],
    ["equal_permissions", "คนนี้มีสิทธิ์เท่ากับคุณ — ให้เจ้าของร้านเปลี่ยนบทบาทหรือถอดออก"],
    [
      "exceeds_your_permissions",
      "คนนี้มีสิทธิ์บางอย่างที่คุณไม่มี — ให้เจ้าของร้านเปลี่ยนบทบาทหรือถอดออก",
    ],
    ["anything_else", "คุณจัดการสมาชิกคนนี้ไม่ได้ — ให้เจ้าของร้านช่วย"],
  ])("%s", (reason, expected) => {
    expect(memberManageBlockedReasonCopy(reason)).toBe(expected);
  });
});

describe("§0.3 (ข) — invitationManageBlockedReasonCopy (Invitation.manageBlockedReason)", () => {
  it.each([
    ["owner_only", "เฉพาะเจ้าของร้านเท่านั้นที่ยกเลิกหรือออกลิงก์ใหม่ให้คำเชิญเจ้าของร้านได้"],
    [
      "exceeds_your_permissions",
      "คำเชิญนี้ให้บทบาทที่มีสิทธิ์ที่คุณไม่มี — ให้เจ้าของร้านยกเลิกหรือออกลิงก์ใหม่",
    ],
    ["anything_else", "คุณจัดการคำเชิญนี้ไม่ได้ — ให้เจ้าของร้านช่วย"],
  ])("%s", (reason, expected) => {
    expect(invitationManageBlockedReasonCopy(reason)).toBe(expected);
  });
});

describe("§E — roleNameFieldErrorMessage (422 VALIDATION_FAILED + fieldErrors.name)", () => {
  it("returns the ux §E copy for an invalid role name", () => {
    expect(roleNameFieldErrorMessage()).toBe(
      "ชื่อนี้มีอักขระที่ใช้ไม่ได้ (เช่น อักขระที่มองไม่เห็นซึ่งติดมาจากการคัดลอก) ลองพิมพ์ชื่อใหม่เอง",
    );
  });
});

describe("§E — roleFormErrorMessage", () => {
  it("ROLE_LIMIT_REACHED interpolates details.limit", () => {
    expect(roleFormErrorMessage("ROLE_LIMIT_REACHED", { limit: 30 })).toContain("ครบ 30 บทบาทแล้ว");
  });

  it("ROLE_NAME_TAKEN names the reserved system names", () => {
    expect(roleFormErrorMessage("ROLE_NAME_TAKEN")).toContain("เจ้าของร้าน ผู้ดูแล พนักงาน");
  });

  it("save vs delete pick different generic fallbacks for an unmapped code", () => {
    expect(roleFormErrorMessage("SOME_5XX", { action: "save" })).toBe(
      "บันทึกบทบาทไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
    );
    expect(roleFormErrorMessage("SOME_5XX", { action: "delete" })).toBe(
      "ลบบทบาทไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
    );
  });

  it("ROLE_LOCKED / TARGET_NOT_BELOW_ACTOR / ROLE_HELD_REQUIRES_MANAGE_MEMBERS reuse the §0.3(ก) banner bodies", () => {
    expect(roleFormErrorMessage("ROLE_LOCKED")).toBe(bannerReasonCopy("role_locked").body);
    expect(roleFormErrorMessage("TARGET_NOT_BELOW_ACTOR")).toBe(
      bannerReasonCopy("equal_permissions_in_use").body,
    );
    expect(roleFormErrorMessage("ROLE_HELD_REQUIRES_MANAGE_MEMBERS")).toBe(
      bannerReasonCopy("in_use_requires_manage_members").body,
    );
  });
});

describe("§E — memberActionErrorMessage", () => {
  it("ROLE_EXCEEDS_ACTOR differs by context (changeRole vs reissue vs cancel)", () => {
    expect(memberActionErrorMessage("ROLE_EXCEEDS_ACTOR", "changeRole")).toContain(
      "มอบให้คนอื่นไม่ได้",
    );
    expect(memberActionErrorMessage("ROLE_EXCEEDS_ACTOR", "reissue")).toContain(
      "ออกลิงก์ใหม่ไม่ได้",
    );
    expect(memberActionErrorMessage("ROLE_EXCEEDS_ACTOR", "cancel")).toContain("ยกเลิกไม่ได้");
  });

  it("FORBIDDEN while cancelling an owner invitation is the one owner-only message", () => {
    expect(memberActionErrorMessage("FORBIDDEN", "cancel")).toBe(
      "เฉพาะเจ้าของร้านเท่านั้นที่ยกเลิกคำเชิญเจ้าของร้านได้",
    );
  });

  it("ROLE_INVALID while inviting", () => {
    expect(memberActionErrorMessage("ROLE_INVALID", "invite")).toBe(
      "บทบาทที่เลือกใช้ไม่ได้แล้ว กรุณาเลือกใหม่อีกครั้ง",
    );
  });

  it("★ unmapped code never throws or returns empty", () => {
    expect(memberActionErrorMessage("SOME_5XX", "changeRole")).not.toBe("");
  });
});

describe("UX01 — ForbiddenPanel copy of the roles screens (ux §0)", () => {
  it("has title, body and the back button, verbatim", () => {
    expect(ROLE_FORBIDDEN_PANEL_COPY).toEqual({
      title: "หน้านี้สำหรับคนที่จัดการบทบาทได้",
      body: 'ถ้าต้องการใช้ ให้เจ้าของร้านเปิดสิทธิ์ "จัดการบทบาทและสิทธิ์" ให้คุณ',
      back: "กลับไปหน้าข้อมูลร้าน",
    });
  });
  it("FORBIDDEN from roleFormErrorMessage carries the body too, not just the title", () => {
    const msg = roleFormErrorMessage("FORBIDDEN");
    expect(msg).toContain(ROLE_FORBIDDEN_PANEL_COPY.title);
    expect(msg).toContain(ROLE_FORBIDDEN_PANEL_COPY.body);
  });
});
