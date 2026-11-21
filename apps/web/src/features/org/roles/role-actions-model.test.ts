// T-003-W08 / W09 · CW3-03 (R4/R5 half) — what the clone and delete controls
// do on R3/R4, decided ONLY from the server's verdicts (`viewer.*`) and the
// server's `isSystem` — never from the viewer's local capabilities.
import { describe, it, expect } from "vitest";
import { cloneAffordance, deleteAffordance, inUseCountLine } from "./role-actions-model";

const ok = { allowed: true, reason: null };
const no = (reason: string) => ({ allowed: false, reason });
const viewer = (
  canEdit: { allowed: boolean; reason: string | null },
  canDelete: { allowed: boolean; reason: string | null },
  canClone: { allowed: boolean; reason: string | null },
) => ({ canEdit, canDelete, canClone });

describe("cloneAffordance (R4 — ux R4 table + §0.3 order)", () => {
  it("the Owner role (isSystem) never shows clone, whatever the verdicts say (AC-3.2)", () => {
    expect(
      cloneAffordance(
        viewer(no("writes_disabled"), no("writes_disabled"), no("writes_disabled")),
        true,
      ),
    ).toEqual({ kind: "hidden" });
    expect(cloneAffordance(viewer(no("role_locked"), no("role_locked"), ok), true)).toEqual({
      kind: "hidden",
    });
  });

  it("canClone allowed → a link inside the reason banner", () => {
    expect(
      cloneAffordance(
        viewer(no("equal_permissions_in_use"), no("equal_permissions_in_use"), ok),
        false,
      ),
    ).toEqual({ kind: "link", place: "banner" });
  });

  it("role_limit_reached → disabled + the limit sentence (no limit in hand on R4)", () => {
    const a = cloneAffordance(
      viewer(no("in_use_requires_manage_members"), no("x"), no("role_limit_reached")),
      false,
    );
    expect(a).toEqual({
      kind: "disabled",
      place: "banner",
      note: "ร้านนี้มีบทบาทครบจำนวนสูงสุดแล้ว ลบบทบาทที่ไม่ใช้ก่อน จึงจะสร้างใหม่ได้",
    });
  });

  it("writes_disabled → disabled with no note (the top banner explains), in 'การจัดการอื่น'", () => {
    expect(
      cloneAffordance(
        viewer(no("writes_disabled"), no("writes_disabled"), no("writes_disabled")),
        false,
      ),
    ).toEqual({ kind: "disabled", place: "section" });
  });

  it("any other reason (exceeds_your_permissions, unknown) → hidden — the main banner covers it", () => {
    expect(
      cloneAffordance(
        viewer(
          no("exceeds_your_permissions"),
          no("exceeds_your_permissions"),
          no("exceeds_your_permissions"),
        ),
        false,
      ),
    ).toEqual({ kind: "hidden" });
    expect(
      cloneAffordance(viewer(no("brand_new"), no("brand_new"), no("brand_new")), false),
    ).toEqual({ kind: "hidden" });
  });
});

describe("deleteAffordance (R3 + R4 — §0.3 'ลำดับบนจอ R4')", () => {
  it("isSystem → hidden", () => {
    expect(deleteAffordance(viewer(no("role_locked"), ok, no("owner_role")), true)).toEqual({
      kind: "hidden",
    });
  });

  it("canDelete allowed → enabled (R3, and R4 with an edit-only reason)", () => {
    expect(deleteAffordance(viewer(ok, ok, ok), false)).toEqual({ kind: "enabled" });
    expect(deleteAffordance(viewer(no("brand_new_edit_reason"), ok, ok), false)).toEqual({
      kind: "enabled",
    });
  });

  it("same reason as canEdit → hidden (the main banner already said it)", () => {
    for (const r of [
      "exceeds_your_permissions",
      "in_use_requires_manage_members",
      "equal_permissions_in_use",
      "something_new",
    ]) {
      expect(deleteAffordance(viewer(no(r), no(r), ok), false)).toEqual({ kind: "hidden" });
    }
  });

  it("writes_disabled → disabled, no note (the single top banner explains)", () => {
    expect(
      deleteAffordance(
        viewer(no("writes_disabled"), no("writes_disabled"), no("writes_disabled")),
        false,
      ),
    ).toEqual({ kind: "disabled" });
  });

  it("in_use → the (ข) panel under the disabled button", () => {
    expect(deleteAffordance(viewer(ok, no("in_use"), ok), false)).toEqual({ kind: "in-use" });
  });

  it("history_limit_reached → disabled + 'ลบเพิ่มไม่ได้'", () => {
    expect(deleteAffordance(viewer(ok, no("history_limit_reached"), ok), false)).toEqual({
      kind: "blocked",
      copy: {
        title: "ลบเพิ่มไม่ได้",
        body: "ร้านนี้ลบบทบาทไปครบจำนวนที่ระบบเก็บประวัติได้แล้ว กรุณาติดต่อทีมงาน OmniStock",
      },
    });
  });

  it("an unknown delete-only reason → disabled + the generic sentence (never a raw key)", () => {
    expect(deleteAffordance(viewer(ok, no("future_reason"), ok), false)).toEqual({
      kind: "blocked",
      copy: {
        title: "ดูได้อย่างเดียว",
        body: "ตอนนี้คุณทำรายการนี้กับบทบาทนี้ไม่ได้ ถ้าคิดว่าไม่ถูกต้อง ติดต่อเจ้าของร้าน",
      },
    });
  });

  it("control: a delete reason that DIFFERS from the edit reason is shown, not hidden", () => {
    expect(
      deleteAffordance(viewer(no("equal_permissions_in_use"), no("in_use"), ok), false),
    ).toEqual({
      kind: "in-use",
    });
  });
});

describe("inUseCountLine (§0.2 — parts that are 0 are dropped)", () => {
  it("both parts", () => {
    expect(inUseCountLine({ activeMembers: 2, pendingInvitations: 1 }, false)).toBe(
      "สมาชิก 2 คน · คำเชิญที่ยังไม่ปิด 1 ใบ",
    );
  });
  it("members only, my role → (รวมคุณ)", () => {
    expect(inUseCountLine({ activeMembers: 3, pendingInvitations: 0 }, true)).toBe(
      "สมาชิก 3 คน (รวมคุณ)",
    );
  });
  it("invitations only — no 'ยังไม่มีสมาชิกใช้' in a sentence about who still uses it", () => {
    expect(inUseCountLine({ activeMembers: 0, pendingInvitations: 2 }, false)).toBe(
      "คำเชิญที่ยังไม่ปิด 2 ใบ",
    );
  });
  it("nothing → empty (the caller shows no count line)", () => {
    expect(inUseCountLine({ activeMembers: 0, pendingInvitations: 0 }, false)).toBe("");
  });
});
