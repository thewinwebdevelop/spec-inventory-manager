// T-003-W09 · CW3-06 (R5 half) — a refused DELETE /roles/{id} → what R5 shows
// and what it re-reads (ux-wireframe R5 + §E).
import { describe, it, expect } from "vitest";
import { ApiRequestError } from "../../../lib/api/error";
import { classifyRoleDeleteFailure } from "./role-delete-failure";

const err = (status: number, code: string, details?: Record<string, unknown>) =>
  new ApiRequestError(status, { error: { code, message: "server text", details } });

describe("classifyRoleDeleteFailure", () => {
  it("409 ROLE_IN_USE → the (ข) variant with the numbers from details", () => {
    expect(
      classifyRoleDeleteFailure(
        err(409, "ROLE_IN_USE", { activeMembers: 2, pendingInvitations: 1 }),
      ),
    ).toEqual({ kind: "in-use", usage: { activeMembers: 2, pendingInvitations: 1 } });
  });

  it("409 ROLE_IN_USE without usable numbers → (ข) with null usage (no invented counts)", () => {
    expect(classifyRoleDeleteFailure(err(409, "ROLE_IN_USE", { activeMembers: "2" }))).toEqual({
      kind: "in-use",
      usage: null,
    });
  });

  it("409 ROLE_HISTORY_LIMIT_REACHED → in-dialog message with details.limit; confirm closed", () => {
    expect(
      classifyRoleDeleteFailure(err(409, "ROLE_HISTORY_LIMIT_REACHED", { limit: 500 })),
    ).toEqual({
      kind: "history-limit",
      message:
        "ลบเพิ่มไม่ได้ — ร้านนี้ลบบทบาทไปครบ 500 ครั้งที่ระบบเก็บประวัติได้แล้ว กรุณาติดต่อทีมงาน OmniStock",
    });
  });

  it("404 → gone (toast 'บทบาทนี้ถูกลบไปแล้ว' + R1 — the screen decides)", () => {
    expect(classifyRoleDeleteFailure(err(404, "NOT_FOUND"))).toEqual({ kind: "gone" });
  });

  it("403 TARGET_NOT_BELOW_ACTOR / ROLE_HELD_REQUIRES_MANAGE_MEMBERS → banner + re-read the role (stay)", () => {
    expect(classifyRoleDeleteFailure(err(403, "TARGET_NOT_BELOW_ACTOR"))).toEqual({
      kind: "banner",
      message:
        "บทบาทนี้มีสิทธิ์เท่ากับของคุณ และมีสมาชิกคนอื่นใช้อยู่ จึงต้องให้เจ้าของร้านเป็นคนแก้หรือลบ — หรือทำสำเนาไปปรับเป็นบทบาทใหม่",
      refetch: ["role", "list"],
    });
    expect(classifyRoleDeleteFailure(err(403, "ROLE_HELD_REQUIRES_MANAGE_MEMBERS"))).toMatchObject({
      kind: "banner",
      refetch: ["role", "list"],
    });
  });

  it("403 FORBIDDEN → forbidden (leave the roles screens)", () => {
    expect(classifyRoleDeleteFailure(err(403, "FORBIDDEN"))).toEqual({ kind: "forbidden" });
  });

  it("503 ROLE_WRITES_DISABLED → the writes_disabled sentence + re-read", () => {
    expect(classifyRoleDeleteFailure(err(503, "ROLE_WRITES_DISABLED"))).toEqual({
      kind: "banner",
      message:
        "ระบบกำลังทยอยเปิดให้ทุกร้าน ระหว่างนี้ดูรายละเอียดได้ตามปกติ และยังมอบบทบาทที่มีอยู่ให้สมาชิกได้เหมือนเดิม",
      refetch: ["role", "list"],
    });
  });

  it("409 ROLE_LOCKED → banner + re-read", () => {
    expect(classifyRoleDeleteFailure(err(409, "ROLE_LOCKED"))).toMatchObject({
      kind: "banner",
      refetch: ["role", "list"],
    });
  });

  it("429 → throttled with Retry-After", () => {
    const e = new ApiRequestError(429, { error: { code: "RATE_LIMITED", message: "x" } }, 42);
    expect(classifyRoleDeleteFailure(e)).toEqual({ kind: "throttled", seconds: 42 });
  });

  it("busy → 'ร้านนี้กำลังมีการแก้ไขอื่นอยู่…'", () => {
    expect(classifyRoleDeleteFailure(err(409, "CONFLICT", { reason: "busy" }))).toEqual({
      kind: "banner",
      message: "ร้านนี้กำลังมีการแก้ไขอื่นอยู่ ลองใหม่อีกครั้งในไม่กี่วินาที",
      refetch: [],
    });
  });

  it("anything else (LAST_OWNER, 5xx, a code never seen) → the DELETE generic sentence, not the save one", () => {
    for (const e of [err(409, "LAST_OWNER"), err(500, "INTERNAL"), err(409, "NEW_CODE")]) {
      expect(classifyRoleDeleteFailure(e)).toEqual({
        kind: "banner",
        message: "ลบบทบาทไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
        refetch: [],
      });
    }
    expect(classifyRoleDeleteFailure(new TypeError("offline"))).toMatchObject({
      message: "ลบบทบาทไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
    });
  });
});
